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
      chunks.forEach((id) => {
        const chunk = chunkRegistry.get(id);
        if (chunk) chunk.notify();
      });
    }
  }
}

export function chunk<T>(
  initialValue: T,
  middleware: Middleware<T>[] = []
): Chunk<T> {
  if (initialValue === undefined || initialValue === null) {
    throw new Error("Initial value cannot be undefined or null.");
  }

  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>();
  const chunkId = chunkIdCounter++;

  const notify = () => {
    subscribers.forEach((subscriber) => subscriber(value));
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

    if (typeof newValueOrUpdater === "function") {
      // This is the key fix - ensuring the returned value from the updater function
      // is actually of type T without any additional properties
      const updatedValue = (newValueOrUpdater as (currentValue: T) => unknown)(
        value
      );

      // Type check to ensure the updated value conforms to type T
      if (!isValidType<T>(updatedValue, value)) {
        throw new TypeError(
          "Returned value from updater function does not match the chunk's type shape"
        );
      }

      newValue = updatedValue as T;
    } else {
      newValue = newValueOrUpdater;
    }

    const processedValue = processMiddleware(newValue, middleware);

    if (processedValue !== value) {
      // Ensure the processed value also matches the expected type structure
      if (!isValidType<T>(processedValue, initialValue)) {
        throw new TypeError(
          "Processed value from middleware does not match the chunk's type shape"
        );
      }

      value = processedValue as T & {}; // Use T & {} to maintain compatibility with existing code
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

/**
 * Helper function to validate that an updated value matches the expected type structure
 * This is a runtime check to complement the TypeScript type checking
 */
function isValidType<T>(value: unknown, template: T): value is T {
  // For primitive types
  if (typeof template !== "object" || template === null) {
    return typeof value === typeof template;
  }

  // For arrays
  if (Array.isArray(template)) {
    return Array.isArray(value);
  }

  // For objects
  if (typeof value !== "object" || value === null) {
    return false;
  }

  // Check that all keys in the value exist in the template
  // This prevents adding arbitrary properties
  const valueKeys = Object.keys(value as object);
  const templateKeys = Object.keys(template as object);

  for (const key of valueKeys) {
    if (!templateKeys.includes(key)) {
      return false; // Extra property found
    }
  }

  return true;
}
