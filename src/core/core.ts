import { processMiddleware, shallowEqual } from "../utils";

export type Subscriber<T> = (newValue: T) => void;
export type Middleware<T> = (value: T, next: (newValue: T) => void) => void;

export interface Chunk<T> {
  /** Get the current value of the chunk. */
  get: () => T;
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

// Global state for batching
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

export function chunk<T>(initialValue: T, middleware: Middleware<T>[] = []): Chunk<T> {
  if (initialValue === undefined || initialValue === null) {
    throw new Error("Initial value cannot be undefined or null.");
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

  const get = () => value;

  const set = (newValueOrUpdater: T | ((currentValue: T) => T)) => {
    let newValue: T;

    if (typeof newValueOrUpdater === 'function') {
      newValue = (newValueOrUpdater as (currentValue: T) => T)(value);
    } else {
      newValue = newValueOrUpdater;
    }

    const processedValue = processMiddleware(newValue, middleware);

    const isObject = typeof processedValue === 'object' && processedValue !== null;
    const isValueObject = typeof value === 'object' && value !== null;
    if (
      (!isObject || !isValueObject || !shallowEqual(processedValue, value)) &&
      processedValue !== value
    ) {
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

  return { get, set, subscribe, derive, reset, destroy };
}
