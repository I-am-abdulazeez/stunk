export type Subscriber<T> = (newValue: T) => void;

export interface Chunk<T> {
  /** Get the current value of the chunk. */
  get: () => T;
  /** Set a new value for the chunk. */
  set: (value: T) => void;
  /** Subscribe to changes in the chunk. Returns an unsubscribe function. */
  subscribe: (callback: Subscriber<T>) => () => void;
  /** Create a derived chunk based on this chunk's value. */
  derive: <D>(fn: (value: T) => D) => Chunk<D>;
  /** Reset the chunk to its initial value. */
  reset: () => void;
}

export function chunk<T>(initialValue: T): Chunk<T> {
  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>(); // Use a Set instead of an array

  const get = () => value;

  const set = (newValue: T) => {
    if (newValue !== value) {
      value = newValue;
      subscribers.forEach((subscriber) => subscriber(value)); // Notify all subscribers
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

    return () => {
      if (!subscribers.has(callback)) {
        console.warn("Callback was not found in subscribers. It may have already been unsubscribed.");
      }
      subscribers.delete(callback);
    };
  };

  const reset = () => {
    value = initialValue;
    subscribers.forEach((subscriber) => subscriber(value));
  };

  // This is a powerful feature that allows you to create derived chunk from the original chunk.
  const derive = <D>(fn: (value: T) => D) => {
    const derivedValue = fn(value);
    const derivedChunk = chunk(derivedValue);

    // Subscribe to the original chunk, and whenever it updates, update the derived chunk
    subscribe(() => {
      const newDerivedValue = fn(value);
      derivedChunk.set(newDerivedValue);
    });

    return derivedChunk;
  };

  return { get, set, subscribe, derive, reset };
}
