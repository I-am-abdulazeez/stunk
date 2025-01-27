export type Subscriber<T> = (newValue: T) => void;

export interface Chunk<T> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (callback: Subscriber<T>) => () => void;
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

  return { get, set, subscribe };
}
