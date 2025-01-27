export type Subscriber<T> = (newValue: T) => void;

export interface Chunk<T> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (callback: Subscriber<T>) => () => void;
  derive: <D>(fn: (value: T) => D) => Chunk<D>; // Allows derived chunk based on another chunk
}

export function chunk<T>(initialValue: T): Chunk<T> {
  let value = initialValue;
  const subscribers: Subscriber<T>[] = [];

  const get = () => value;

  const set = (newValue: T) => {
    if (newValue !== value) {
      value = newValue;
      subscribers.forEach((subscriber) => subscriber(value)); // Notify all subscribers
    }
  };

  const subscribe = (callback: Subscriber<T>) => {
    subscribers.push(callback);
    callback(value); // Immediately notify on subscription

    // Return unsubscribe function
    return () => {
      const index = subscribers.indexOf(callback);
      if (index >= 0) {
        subscribers.splice(index, 1);
      }
    };
  };

  // derive function - allows creating a derived chunk based on another chunk
  // This is a higher-order function that takes a function and returns a new chunk
  // The new chunk will have the value transformed by the function
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

  return { get, set, subscribe, derive };
}
