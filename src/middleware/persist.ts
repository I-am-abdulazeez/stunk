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
  /** Called on load/save errors and type mismatches. */
  onError?: (error: Error, operation: 'load' | 'save') => void;
}

export interface PersistedChunk<T> extends Chunk<T> {
  /** Remove the persisted key from storage without destroying the chunk. */
  clearStorage: () => void;
}

/**
 * Wraps a chunk with automatic persistence to a storage engine.
 *
 * Loads any saved value on creation. Saves on every `set()`.
 * Gracefully disabled in SSR when no storage is available.
 *
 * @param baseChunk - The chunk to wrap.
 * @param options.key - Storage key (required).
 * @param options.storage - Storage engine (default: `localStorage`).
 * @param options.serialize - Custom serializer (default: `JSON.stringify`).
 * @param options.deserialize - Custom deserializer (default: `JSON.parse`).
 * @param options.onError - Called on load/save errors or type mismatches.
 *
 * @example
 * const user = chunk({ name: 'Alice' });
 * const persisted = persist(user, { key: 'user' });
 * persisted.set({ name: 'Bob' }); // saved to localStorage
 * persisted.clearStorage();       // removes the key
 */
export function persist<T>(
  baseChunk: Chunk<T>,
  options: PersistOptions<T>
): PersistedChunk<T> {
  const {
    key,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    onError,
  } = options;

  // Use explicitly provided storage, or fall back to localStorage in browser
  const storage = 'storage' in options
    ? options.storage
    : (typeof window !== 'undefined' ? localStorage : undefined);

  if (!storage) {
    console.warn(`persist: Storage not available for key "${key}". Persistence disabled.`);
    return {
      ...baseChunk,
      clearStorage: () => { },
    };
  }

  const initialValue = baseChunk.get();

  // Load persisted value on init
  try {
    const savedData = storage.getItem(key);
    if (savedData !== null) {
      const parsed = deserialize(savedData);

      const bothNonNull = parsed !== null && initialValue !== null;

      // Check for type mismatch — covers object vs array distinction too
      const typeMismatch = bothNonNull && (
        typeof parsed !== typeof initialValue ||
        Array.isArray(parsed) !== Array.isArray(initialValue)
      );

      if (typeMismatch) {
        const msg = `persist: Type mismatch for "${key}". ` +
          `Expected ${Array.isArray(initialValue) ? 'array' : typeof initialValue}, ` +
          `got ${Array.isArray(parsed) ? 'array' : typeof parsed}. ` +
          `Using initial value.`;
        console.warn(msg);
        onError?.(new Error(msg), 'load');
      } else {
        baseChunk.set(parsed);
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`persist: Failed to load state for "${key}":`, err);
    onError?.(err, 'load');
  }

  // Subscribe after init — no isInitializing flag needed since
  // subscribe is registered after the initial load block completes
  const unsubscribe = baseChunk.subscribe((newValue) => {
    try {
      storage.setItem(key, serialize(newValue));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`persist: Failed to save state for "${key}":`, err);
      onError?.(err, 'save');
    }
  });

  const persistedChunk: PersistedChunk<T> = {
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
    },

    clearStorage: () => {
      try {
        storage.removeItem(key);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`persist: Failed to clear storage for "${key}":`, err);
        onError?.(err, 'save');
      }
    },
  };

  return persistedChunk;
}
