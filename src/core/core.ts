import { processMiddleware, validateObjectShape } from "../utils";

export type Subscriber<T> = (newValue: T) => void;
export type Middleware<T> = (value: T, next: (newValue: T) => void) => void;
export type NamedMiddleware<T> = {
  name?: string;
  fn: Middleware<T>;
};

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
  derive: <D>(fn: (value: T) => D) => Chunk<D>;
  /** Reset the chunk to its initial value. */
  reset: () => void;
  /** Destroy the chunk and all its subscribers. */
  destroy: () => void;
}

// ============================================================================
// DEPENDENCY TRACKING SYSTEM (for computed)
// ============================================================================

let activeEffect: Set<Chunk<any>> | null = null;

/**
 * Track dependencies during computed function execution
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

/**
 * Register that a chunk is being accessed (called internally by chunk.get())
 */
function trackChunkAccess(chunk: Chunk<any>) {
  if (activeEffect) {
    activeEffect.add(chunk);
  }
}

// ============================================================================
// BATCHING SYSTEM
// ============================================================================

let isBatching = false;
const dirtyChunks = new Set<number>();
const chunkRegistry = new Map<number, { notify: () => void }>();
let chunkIdCounter = 0;

/**
 * Batch multiple chunk updates into a single re-render.
 * Useful for updating multiple chunks at once without causing multiple re-renders.
 */
export function batch(callback: () => void) {
  const wasBatchingBefore = isBatching;
  isBatching = true;
  try {
    callback();
  } finally {
    if (!wasBatchingBefore) {
      isBatching = false;
      const chunks = Array.from(dirtyChunks); // Snapshot to avoid mutation issues
      dirtyChunks.clear(); // Clear early to prevent re-adds
      chunks.forEach(id => {
        const chunk = chunkRegistry.get(id);
        if (chunk) chunk.notify();
      });
    }
  }
}

// ============================================================================
// CHUNK IMPLEMENTATION
// ============================================================================

export function chunk<T>(initialValue: T, middleware: (Middleware<T> | NamedMiddleware<T>)[] = []): Chunk<T> {
  if (initialValue === null) {
    throw new Error("Initial value cannot be null.");
  }

  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>();
  const chunkId = chunkIdCounter++;

  const notify = () => {
    subscribers.forEach(subscriber => subscriber(value));
  };

  chunkRegistry.set(chunkId, { notify });

  const notifySubscribers = () => {
    if (subscribers.size === 0) return; // Skip if no subscribers
    if (isBatching) {
      dirtyChunks.add(chunkId);
    } else {
      notify();
    }
  };

  const get = () => {
    // Track this chunk access for computed dependency tracking
    trackChunkAccess(chunkInstance);
    return value;
  };

  const peek = () => {
    return value;
  }

  const set = (newValueOrUpdater: T | ((currentValue: T) => T)) => {
    let newValue: T;

    if (typeof newValueOrUpdater === 'function') {
      const updaterFn = newValueOrUpdater as (currentValue: T) => T;
      newValue = updaterFn(value);
    } else {
      newValue = newValueOrUpdater;
    }

    validateObjectShape(value, newValue);

    const processedValue = processMiddleware(newValue, middleware);

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
    callback(value);
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

  const derive = <D>(fn: (value: T) => D) => {
    if (typeof fn !== "function") {
      throw new Error("Derive function must be a function.");
    }

    const initialDerivedValue = fn(value);
    const derivedChunk = chunk(initialDerivedValue);

    const unsubscribe = subscribe(() => {
      const newDerivedValue = fn(value);
      derivedChunk.set(newDerivedValue);
    });

    // Add a cleanup method to the derived chunk
    const originalDestroy = derivedChunk.destroy;
    derivedChunk.destroy = () => {
      unsubscribe();
      originalDestroy();
    };

    return derivedChunk;
  };

  const chunkInstance: Chunk<T> = { get, peek, set, subscribe, derive, reset, destroy };

  return chunkInstance;
}
