import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { chunk } from '../../src/core/core';
import { persist } from "../../src/middleware/persist";

describe('persist', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should persist state to localStorage', () => {
    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, { key: 'test-key' }); // ← Renamed function

    persistedChunk.set({ count: 1 });

    expect(JSON.parse(localStorage.getItem('test-key')!)).toEqual({ count: 1 });
  });

  it('should load persisted state on initialization', () => {
    localStorage.setItem('test-key', JSON.stringify({ count: 5 }));

    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, { key: 'test-key' });

    expect(persistedChunk.get()).toEqual({ count: 5 });
  });

  it('should use custom storage', () => {
    const mockStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    } as Storage;

    const baseChunk = chunk({ count: 0 });
    persist(baseChunk, {
      key: 'test-key',
      storage: mockStorage
    });

    expect(mockStorage.getItem).toHaveBeenCalledWith('test-key');
  });

  it('should use custom serializer/deserializer', () => {
    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, {
      key: 'test-key',
      serialize: value => btoa(JSON.stringify(value)),
      deserialize: value => JSON.parse(atob(value))
    });

    persistedChunk.set({ count: 1 });

    const stored = localStorage.getItem('test-key');
    expect(stored).toBe(btoa(JSON.stringify({ count: 1 })));

    // Verify deserialization works on load
    const baseChunk2 = chunk({ count: 0 });
    const persistedChunk2 = persist(baseChunk2, {
      key: 'test-key',
      serialize: value => btoa(JSON.stringify(value)),
      deserialize: value => JSON.parse(atob(value))
    });

    expect(persistedChunk2.get()).toEqual({ count: 1 });
  });

  // ✅ NEW TEST: Should not save during initialization
  it('should not trigger a save when loading from storage', () => {
    localStorage.setItem('test-key', JSON.stringify({ count: 10 }));

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const baseChunk = chunk({ count: 0 });
    persist(baseChunk, { key: 'test-key' });

    // setItem should not be called during initialization
    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
  });

  // ✅ NEW TEST: Should handle corrupted data gracefully
  it('should handle corrupted storage data gracefully', () => {
    localStorage.setItem('test-key', 'invalid json{{{');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, { key: 'test-key' });

    // Should fall back to initial value
    expect(persistedChunk.get()).toEqual({ count: 0 });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('persist: Failed to load state'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  // ✅ NEW TEST: Should handle type mismatch
  it('should warn on type mismatch and use initial value', () => {
    localStorage.setItem('test-key', JSON.stringify('wrong type'));

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, { key: 'test-key' });

    // Should use initial value due to type mismatch
    expect(persistedChunk.get()).toEqual({ count: 0 });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('persist: Type mismatch')
    );

    consoleWarnSpy.mockRestore();
  });

  // ✅ NEW TEST: Should clean up subscription on destroy
  it('should unsubscribe from chunk on destroy', () => {
    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, { key: 'test-key' });

    persistedChunk.set({ count: 1 });
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ count: 1 }));

    // Destroy the persisted chunk
    persistedChunk.destroy();

    // Storage should still have the data (persisted for next load)
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ count: 1 }));

    // But further updates to base chunk should NOT persist
    // (because we unsubscribed)
    baseChunk.set({ count: 999 });

    // Storage should still have old value (subscription was cleaned up)
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ count: 1 }));
  });

  // ✅ NEW TEST: Should work with sessionStorage
  it('should work with sessionStorage', () => {
    const baseChunk = chunk({ data: 'test' });
    const persistedChunk = persist(baseChunk, {
      key: 'session-key',
      storage: sessionStorage
    });

    persistedChunk.set({ data: 'updated' });

    expect(sessionStorage.getItem('session-key')).toBe(
      JSON.stringify({ data: 'updated' })
    );
    expect(localStorage.getItem('session-key')).toBeNull(); // Not in localStorage
  });

  // ✅ NEW TEST: Should handle complex types with custom serialization
  it('should handle Date objects with custom serialization', () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const baseChunk = chunk(now);

    const persistedChunk = persist(baseChunk, {
      key: 'date-key',
      serialize: (date) => date.toISOString(),
      deserialize: (str) => new Date(str)
    });

    persistedChunk.set(new Date('2024-12-31T23:59:59.999Z'));

    expect(localStorage.getItem('date-key')).toBe('2024-12-31T23:59:59.999Z');

    // Load in new chunk
    const baseChunk2 = chunk(new Date());
    const persistedChunk2 = persist(baseChunk2, {
      key: 'date-key',
      serialize: (date) => date.toISOString(),
      deserialize: (str) => new Date(str)
    });

    expect(persistedChunk2.get().toISOString()).toBe('2024-12-31T23:59:59.999Z');
  });

  // ✅ NEW TEST: Should call onError callback
  it('should call onError callback on save error', () => {
    const onError = vi.fn();
    const mockStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    } as Storage;

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, {
      key: 'test-key',
      storage: mockStorage,
      onError
    });

    persistedChunk.set({ count: 1 });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Storage quota exceeded' }),
      'save'
    );

    consoleErrorSpy.mockRestore();
  });

  // ✅ NEW TEST: Should call onError callback on load error
  it('should call onError callback on load error', () => {
    const onError = vi.fn();
    const mockStorage = {
      getItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage access denied');
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    } as Storage;

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const baseChunk = chunk({ count: 0 });
    persist(baseChunk, {
      key: 'test-key',
      storage: mockStorage,
      onError
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Storage access denied' }),
      'load'
    );

    consoleErrorSpy.mockRestore();
  });

  // ✅ NEW TEST: Should handle null values
  it('should persist and load null values', () => {
    const baseChunk = chunk<string | null>('initial');
    const persistedChunk = persist(baseChunk, { key: 'nullable-key' });

    persistedChunk.set(null);

    expect(localStorage.getItem('nullable-key')).toBe('null');

    // Load in new chunk
    const baseChunk2 = chunk<string | null>('initial');
    const persistedChunk2 = persist(baseChunk2, { key: 'nullable-key' });

    expect(persistedChunk2.get()).toBeNull();
  });

  // ✅ NEW TEST: Should work with arrays
  it('should persist and load arrays', () => {
    const baseChunk = chunk([1, 2, 3]);
    const persistedChunk = persist(baseChunk, { key: 'array-key' });

    persistedChunk.set([4, 5, 6]);

    expect(JSON.parse(localStorage.getItem('array-key')!)).toEqual([4, 5, 6]);

    // Load in new chunk
    const baseChunk2 = chunk<number[]>([]);
    const persistedChunk2 = persist(baseChunk2, { key: 'array-key' });

    expect(persistedChunk2.get()).toEqual([4, 5, 6]);
  });

  // ✅ NEW TEST: Should handle updater functions
  it('should persist state changes from updater functions', () => {
    const baseChunk = chunk(0);
    const persistedChunk = persist(baseChunk, { key: 'updater-key' });

    persistedChunk.set((prev) => prev + 1);
    persistedChunk.set((prev) => prev * 2);

    expect(JSON.parse(localStorage.getItem('updater-key')!)).toBe(2);
  });

  // ✅ NEW TEST: SSR safety (when storage is not available)
  it('should handle missing storage gracefully (SSR)', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, {
      key: 'test-key',
      storage: undefined as any
    });

    // Should still work (returns base chunk)
    expect(persistedChunk.get()).toEqual({ count: 0 });
    persistedChunk.set({ count: 5 });
    expect(persistedChunk.get()).toEqual({ count: 5 });

    // Check the exact warning message
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'persist: Storage not available for key "test-key". Persistence disabled.'
    );

    consoleWarnSpy.mockRestore();
  });

  // ✅ NEW TEST: Multiple persisted chunks with different keys
  it('should handle multiple persisted chunks independently', () => {
    const chunk1 = chunk({ name: 'Olamide' });
    const chunk2 = chunk({ name: 'Olalekan' });

    const persisted1 = persist(chunk1, { key: 'user-1' });
    const persisted2 = persist(chunk2, { key: 'user-2' });

    persisted1.set({ name: 'Fola' });
    persisted2.set({ name: 'Asake' });

    expect(JSON.parse(localStorage.getItem('user-1')!)).toEqual({ name: 'Fola' });
    expect(JSON.parse(localStorage.getItem('user-2')!)).toEqual({ name: 'Asake' });
  });

  it('should handle rapid consecutive updates', async () => {
    const persistedChunk = persist(chunk(0), { key: 'rapid-key' });

    for (let i = 0; i < 100; i++) {
      persistedChunk.set(i);
    }

    // Should have persisted the last value
    expect(JSON.parse(localStorage.getItem('rapid-key')!)).toBe(99);
  });
});
