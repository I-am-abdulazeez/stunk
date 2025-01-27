// Define the Chunk type
export type Chunk<T> = {
  get: () => T; // Get the value of the chunk
  set: (newValue: T) => void; // Set the value of the chunk
  subscribe: (callback: (value: T) => void) => () => void; // Subscribe to changes
};

// Chunk creation function
export function createChunk<T>(initialValue: T): Chunk<T> {
  let value = initialValue; // The current value of the chunk
  const subscribers = new Set<(value: T) => void>(); // Set of subscribers

  return {
    // Get the current value
    get() {
      return value;
    },
    // Set a new value and notify subscribers
    set(newValue: T) {
      value = newValue;
      subscribers.forEach((callback) => callback(value));
    },
    // Subscribe to changes
    subscribe(callback: (value: T) => void) {
      subscribers.add(callback);
      // Return an unsubscribe function
      return () => subscribers.delete(callback);
    },
  };
}
