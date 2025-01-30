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

  const get = () => value;

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

  const set = (newValue: T) => {
    if (newValue === null || newValue === undefined) {
      throw new Error("Value cannot be null or undefined.");
    }

    let currentValue = newValue;
    let index = 0;

    while (index < middleware.length) {
      const currentMiddleware = middleware[index];
      let nextCalled = false;
      let nextValue: T | null = null;

      currentMiddleware(currentValue, (val) => {
        nextCalled = true;
        nextValue = val;
      });

      if (!nextCalled) break;

      if (nextValue === null || nextValue === undefined) {
        throw new Error("Value cannot be null or undefined.");
      }

      currentValue = nextValue;
      index++;
    }

    if (currentValue !== value) {
      value = currentValue;
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

    return () => {
      subscribers.delete(callback);
    };
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
