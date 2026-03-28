import { processMiddleware, validateObjectShape } from "../utils";

export type Subscriber<T> = (newValue: T) => void;
export type Middleware<T> = (value: T) => T | undefined;
export type NamedMiddleware<T> = {
  name?: string;
  fn: Middleware<T>;
};
export interface ChunkConfig<T> {
  name?: string;
  middleware?: (Middleware<T> | NamedMiddleware<T>)[];
  /**
   * When true, setting a value with keys not present in the initial
   * shape throws an error in development. Useful for catching accidental
   * shape mutations early. Has no effect in production. (default: false)
   */
  strict?: boolean;
}

export interface Chunk<T> {
  /** Get the current value of the chunk. */
  get: () => T;
  /** Peek at the current value without tracking dependencies. */
  peek: () => T;
  /** Set a new value for the chunk & Update existing value efficiently. */
  set: (newValueOrUpdater: T | ((currentValue: T) => T)) => void;
  /** Subscribe to changes in the chunk. Returns an unsubscribe function. */
  subscribe: (callback: Subscriber<T>) => () => void;
  /** Create a derived chunk based on this chunk's value. */
  derive: <D>(fn: (value: T) => D) => ReadOnlyChunk<D>;
  /** Reset the chunk to its initial value. */
  reset: () => void;
  /** Destroy the chunk and all its subscribers. */
  destroy: () => void;
}

export interface ReadOnlyChunk<T> extends Omit<Chunk<T>, 'set' | 'reset'> {
  derive: <D>(fn: (value: T) => D) => ReadOnlyChunk<D>;
}


// DEPENDENCY TRACKING SYSTEM (for computed)
let activeEffect: Set<Chunk<any>> | null = null;

/**
 * Executes a function while tracking which chunks call `.get()` inside it.
 * Used internally by `computed()` to discover dependencies automatically.
 *
 * @param fn - The function to execute and track.
 * @returns A tuple of `[result, dependencies]` where `dependencies` is the
 * list of chunks whose `.get()` was called during execution.
 *
 * @example
 * const a = chunk(1);
 * const b = chunk(2);
 *
 * const [result, deps] = trackDependencies(() => a.get() + b.get());
 * // result → 3
 * // deps   → [a, b]
 */
export function trackDependencies<T>(fn: () => T): [T, Chunk<any>[]] {
  const deps = new Set<Chunk<any>>();
  const previousEffect = activeEffect;
  activeEffect = deps;

  try {
    const result = fn();
    return [result, Array.from(deps)];
  } finally {
    activeEffect = previousEffect;
  }
}

function trackChunkAccess(chunk: Chunk<any>) {
  if (activeEffect) {
    activeEffect.add(chunk);
  }
}


// BATCHING SYSTEM
let isBatching = false;
const dirtyChunks = new Set<number>();
const chunkRegistry = new Map<number, { notify: () => void }>();
let chunkIdCounter = 0;

/**
 * Groups multiple chunk updates into a single notification pass.
 *
 * Without batching, each `set()` call notifies subscribers immediately.
 * Inside a `batch()`, all updates are collected and subscribers are notified
 * once after the callback completes — even if multiple chunks were updated.
 *
 * Batches can be nested safely. Notifications only flush when the outermost
 * batch completes.
 *
 * @param callback - A function containing one or more chunk `set()` calls.
 *
 * @example
 * const x = chunk(0);
 * const y = chunk(0);
 *
 * batch(() => {
 *   x.set(1);
 *   y.set(2);
 * });
 * // Subscribers of x and y are each notified once, not twice.
 */
export function batch(callback: () => void) {
  const wasBatchingBefore = isBatching;
  isBatching = true;
  try {
    callback();
  } finally {
    if (!wasBatchingBefore) {
      isBatching = false;
      // Snapshot dirty chunks BEFORE notifying — prevents mid-flush set() calls
      // from being visited in the same flush pass (Set.forEach visits entries
      // added during iteration, which would cause unexpected cascading notifications)
      const toFlush = [...dirtyChunks];
      dirtyChunks.clear();
      toFlush.forEach(id => {
        const c = chunkRegistry.get(id);
        if (c) c.notify();
      });
    }
  }
}


/**
 * Creates a reactive state unit — the core primitive of Stunk.
 *
 * A chunk holds a single value and notifies all subscribers whenever that
 * value changes. Values are compared by reference (`===`) for primitives and
 * by the result of middleware processing for objects — so setting the same
 * value twice does not trigger subscribers.
 *
 * @param initialValue - The starting value. Cannot be `undefined`.
 * @param config - Optional configuration for naming, middleware, and strict mode.
 * @returns A `Chunk<T>` with `get()`, `set()`, `peek()`, `subscribe()`, `derive()`, `reset()`, and `destroy()`.
 *
 * @throws If `initialValue` is `undefined`.
 *
 * @example
 * const count = chunk(0);
 * count.get();        // 0
 * count.set(1);       // subscribers notified
 * count.set(n => n + 1); // updater function
 * count.reset();      // back to 0
 *
 * @example
 * // Named chunk with strict mode — throws on unknown keys in dev
 * const user = chunk({ name: 'Alice', age: 30 }, { name: 'user', strict: true });
 *
 * @example
 * // With middleware
 * const positive = chunk(0, {
 *   middleware: [nonNegativeValidator]
 * });
 */
export function chunk<T>(initialValue: T, config: ChunkConfig<T> = {}): Chunk<T> {
  const chunkId = chunkIdCounter++;
  const chunkName = __DEV__
    ? (config.name || `chunk_${chunkId}`)
    : `chunk_${chunkId}`;
  const middleware = config.middleware || [];
  const strict = config.strict ?? false;

  if (initialValue === undefined) {
    throw new Error(`[${chunkName}] Initial value cannot be undefined.`);
  }

  // Only build the allowed key set when actually needed — plain objects only.
  // null, arrays, and primitives are all excluded.
  const allowedKeys: Set<string> | null =
    __DEV__ &&
      initialValue !== null &&
      typeof initialValue === 'object' &&
      !Array.isArray(initialValue)
      ? new Set(Object.keys(initialValue as object))
      : null;

  // Fast path flag — skip all dev validation for the common case of a plain
  // chunk with no config (no name, no middleware, no strict mode). Most chunks
  // in a real app fall into this category.
  const hasMiddleware = middleware.length > 0;
  const hasDevChecks = __DEV__ && (strict || allowedKeys !== null);

  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>();

  const notify = () => {
    subscribers.forEach(subscriber => subscriber(value));
  };

  chunkRegistry.set(chunkId, { notify });

  const notifySubscribers = () => {
    if (subscribers.size === 0) {
      chunkRegistry.delete(chunkId);
      return;
    }
    if (isBatching) {
      dirtyChunks.add(chunkId);
    } else {
      notify();
    }
  };

  const get = () => {
    trackChunkAccess(chunkInstance);
    return value;
  };

  const peek = () => value;

  const set = (newValueOrUpdater: T | ((currentValue: T) => T)) => {
    let newValue: T;

    if (typeof newValueOrUpdater === 'function') {
      newValue = (newValueOrUpdater as (currentValue: T) => T)(value);
    } else {
      newValue = newValueOrUpdater;
    }

    // Dev validation — only runs when strict mode or shape checking is active.
    // Plain chunks with no config skip this block entirely.
    if (hasDevChecks) {
      validateObjectShape(value, newValue);

      if (
        allowedKeys &&
        newValue !== null &&
        typeof newValue === 'object' &&
        !Array.isArray(newValue)
      ) {
        const extraKeys = Object.keys(newValue as object).filter(
          k => !allowedKeys.has(k)
        );

        if (extraKeys.length > 0) {
          const msg = `[${chunkName}] Unexpected keys in set(): ${extraKeys.join(', ')}. ` +
            `These keys were not present in the initial shape.`;

          if (strict) {
            throw new Error(`🚨 Stunk: ${msg}`);
          } else {
            console.error(`🚨 Stunk: ${msg}`);
          }
        }
      }
    }

    // Middleware — skip the function call entirely when no middleware configured.
    // This is the common case for most chunks.
    const processedValue = hasMiddleware
      ? processMiddleware(newValue, middleware)
      : newValue;

    if (processedValue !== value) {
      value = processedValue as T & {};
      notifySubscribers();
    }
  };

  const subscribe = (callback: Subscriber<T>) => {
    if (typeof callback !== "function") {
      throw new Error("Callback must be a function.");
    }
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  };

  const reset = () => {
    value = initialValue;
    notifySubscribers();
  };

  const destroy = () => {
    subscribers.clear();
    value = initialValue;
    dirtyChunks.delete(chunkId);
    chunkRegistry.delete(chunkId);
  };

  const derive = <D>(fn: (value: T) => D): ReadOnlyChunk<D> => {
    if (typeof fn !== "function") {
      throw new Error("Derive function must be a function.");
    }

    const initialDerivedValue = fn(value);
    const derivedChunk = chunk(initialDerivedValue);

    const unsubscribe = subscribe(() => {
      const newDerivedValue = fn(value);
      derivedChunk.set(newDerivedValue);
    });

    const originalDestroy = derivedChunk.destroy;
    derivedChunk.destroy = () => {
      unsubscribe();
      originalDestroy();
    };

    return derivedChunk;
  };

  const chunkInstance: Chunk<T> = {
    get, peek, set, subscribe, derive, reset, destroy,
    ...__DEV__ && { [Symbol.for('stunk.meta')]: { name: chunkName, id: chunkId } }
  };

  return chunkInstance;
}
