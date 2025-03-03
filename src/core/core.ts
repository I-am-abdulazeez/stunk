import { processMiddleware } from "../utils";

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

let batchDepth = 0;
const batchQueue = new Set<() => void>();

export function batch(callback: () => void) {
  batchDepth++;
  try {
    callback();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      // Execute all queued updates
      batchQueue.forEach(update => update());
      batchQueue.clear();
    }
  }
}

export function chunk<T>(initialValue: T, middleware: Middleware<T>[] = []): Chunk<T> {
  if (initialValue === undefined || initialValue === null) {
    throw new Error("Initial value cannot be undefined or null.");
  }

  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>();
  let isDirty = false;

  const notifySubscribers = () => {
    if (batchDepth > 0) {
      if (!isDirty) {
        isDirty = true;
        batchQueue.add(() => {
          if (isDirty) {
            subscribers.forEach((subscriber) => subscriber(value));
            isDirty = false;
          }
        });
      }
    } else {
      subscribers.forEach((subscriber) => subscriber(value));
    }
  }

  const get = () => value;

  const set = (newValueOrUpdater: T | ((currentValue: T) => T)) => {
    let newValue: T;

    if (typeof newValueOrUpdater === 'function') {
      // Handle updater function
      newValue = (newValueOrUpdater as (currentValue: T) => T)(value);
    } else {
      // Handle direct value assignment
      newValue = newValueOrUpdater;
    }

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
    if (subscribers.has(callback)) {
      console.warn("Callback is already subscribed. This may lead to duplicate updates.");
    }
    subscribers.add(callback);
    callback(value);

    return () => subscribers.delete(callback);
  };

  const reset = () => {
    value = initialValue;
    subscribers.forEach((subscriber) => subscriber(value));
  };

  const destroy = () => {
    if (subscribers.size > 0) {
      console.warn("Destroying chunk with active subscribers. This may lead to memory leaks.");
    }
    // Just clear subscribers without calling unsubscribe
    subscribers.clear();
    value = initialValue;
  };


  const derive = <D>(fn: (value: T) => D) => {
    if (typeof fn !== "function") {
      throw new Error("Derive function must be a function.");
    }
    const derivedValue = fn(value);
    const derivedChunk = chunk(derivedValue);

    subscribe(() => {
      const newDerivedValue = fn(value);
      derivedChunk.set(newDerivedValue);
    });

    return derivedChunk;
  };

  return { get, set, subscribe, derive, reset, destroy };
}
