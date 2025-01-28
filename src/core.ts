export type Subscriber<T> = (newValue: T) => void;
export type Middleware<T> = (value: T, next: (newValue: T) => void) => void;

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
  /** Destroy the chunk and all its subscribers. */
  destroy: () => void;
}

export function chunk<T>(initialValue: T, middleware: Middleware<T>[] = []): Chunk<T> {
  if (initialValue === undefined || initialValue === null) {
    throw new Error("Initial value cannot be undefined or null.");
  }

  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>();

  const get = () => value;

  const set = (newValue: T) => {
    if (newValue === null || newValue === undefined) {
      throw new Error("Value cannot be null or undefined.");
    }

    const runMiddleware = (index: number, val: T) => {
      if (val === null || val === undefined) {
        throw new Error("Value cannot be null or undefined.");
      }
      if (index < middleware.length) {
        middleware[index](val, (nextValue) => runMiddleware(index + 1, nextValue));
      } else {
        if (val !== value) {
          value = val;
          subscribers.forEach((subscriber) => subscriber(value));
        }
      }
    };

    runMiddleware(0, newValue);
  };

  const subscribe = (callback: Subscriber<T>) => {
    if (typeof callback !== "function") {
      throw new Error("Callback must be a function.");
    }
    subscribers.add(callback);
    callback(value);

    return () => {
      subscribers.delete(callback);
    };
  };

  const reset = () => {
    value = initialValue;
    subscribers.forEach((subscriber) => subscriber(value));
  };

  const destroy = () => {
    subscribers.clear();
    value = initialValue;
  };

  const derive = <D>(fn: (value: T) => D) => {
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
