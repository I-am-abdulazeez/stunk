import { Chunk } from "../core/core";

export interface PersistOptions<T> {
  key: string;
  storage?: Storage;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

export function withPersistence<T>(
  baseChunk: Chunk<T>,
  options: PersistOptions<T>
): Chunk<T> {
  const {
    key,
    storage = localStorage,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = options;

  // Try to load initial state from storage
  try {
    const savedChunk = storage.getItem(key);
    if (savedChunk) {
      const parsed = deserialize(savedChunk);
      baseChunk.set(parsed)
    }
  } catch (error) {
    console.error('Failed to load persisted state:', error);
  }

  // Save to storage
  baseChunk.subscribe((newValue) => {
    try {
      const serialized = serialize(newValue);
      storage.setItem(key, serialized);

    } catch (error) {
      console.log('Failed to persist chunk', error)
    }
  })

  return baseChunk

}
