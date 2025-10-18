import { Chunk } from "../core/core";

export interface PersistOptions<T> {
  /** Storage key (required). */
  key: string;
  /** Storage engine (default: localStorage). */
  storage?: Storage;
  /** Serialize value to string (default: JSON.stringify). */
  serialize?: (value: T) => string;
  /** Deserialize string to value (default: JSON.parse). */
  deserialize?: (value: string) => T;
  /** Called on load/save errors. */
  onError?: (error: Error, operation: 'load' | 'save') => void;
}

export function persist<T>(
  baseChunk: Chunk<T>,
  options: PersistOptions<T>
): Chunk<T> {
  const {
    key,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    onError,
  } = options;

  // Check if storage was explicitly provided
  const storage = 'storage' in options
    ? options.storage
    : (typeof window !== 'undefined' ? localStorage : undefined);

  // Check if storage is available (SSR safety)
  if (!storage) {
    console.warn(`persist: Storage not available for key "${key}". Persistence disabled.`);
    return baseChunk;
  }

  const initialValue = baseChunk.get();
  let isInitializing = true;

  try {
    const savedData = storage.getItem(key);
    if (savedData !== null) {
      const parsed = deserialize(savedData);

      const bothNonNull = parsed !== null && initialValue !== null;
      const typesMismatch = bothNonNull && typeof parsed !== typeof initialValue;

      if (typesMismatch) {
        console.warn(
          `persist: Type mismatch for "${key}". ` +
          `Expected ${typeof initialValue}, got ${typeof parsed}. ` +
          `Using initial value.`
        );
      } else {
        baseChunk.set(parsed);
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`persist: Failed to load state for "${key}":`, err);
    onError?.(err, 'load');
  }

  isInitializing = false;

  const unsubscribe = baseChunk.subscribe((newValue) => {
    if (isInitializing) return;

    try {
      const serialized = serialize(newValue);
      storage.setItem(key, serialized);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`persist: Failed to save state for "${key}":`, err);
      onError?.(err, 'save');
    }
  });

  const persistedChunk: Chunk<T> = {
    ...baseChunk,

    get: () => baseChunk.get(),
    peek: () => baseChunk.peek(),
    set: (newValueOrUpdater) => baseChunk.set(newValueOrUpdater),
    subscribe: (callback) => baseChunk.subscribe(callback),
    derive: (fn) => baseChunk.derive(fn),
    reset: () => baseChunk.reset(),

    destroy: () => {
      unsubscribe();
      baseChunk.destroy();
    }
  };

  return persistedChunk;
}
