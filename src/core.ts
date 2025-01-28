export type Subscriber<T> = (newValue: T) => void;

export interface Chunk<T> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (callback: Subscriber<T>) => () => void;
  derive: <D>(fn: (value: T) => D) => Chunk<D>; // Allows derived chunk based on another chunk
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
    subscribers.add(callback); // Add the callback to the Set
    callback(value); // Immediately notify on subscription

    // Return unsubscribe function
    return () => {
      subscribers.delete(callback); // Remove the callback from the Set
    };
  };

  const reset = () => {
    value = initialValue;
    subscribers.forEach((subscriber) => subscriber(value));
  };

  // Derive function -  This function allows you to create a derived chunk based on the current chunk.
  // This is a powerful feature that allows you to create derived state from the original state.
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
