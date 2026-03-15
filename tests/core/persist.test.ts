import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { chunk } from '../../src/core/core';
import { persist } from "../../src/middleware";

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
    const persistedChunk = persist(baseChunk, { key: 'test-key' });

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
    persist(baseChunk, { key: 'test-key', storage: mockStorage });

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

    const baseChunk2 = chunk({ count: 0 });
    const persistedChunk2 = persist(baseChunk2, {
      key: 'test-key',
      serialize: value => btoa(JSON.stringify(value)),
      deserialize: value => JSON.parse(atob(value))
    });

    expect(persistedChunk2.get()).toEqual({ count: 1 });
  });

  it('should not trigger a save when loading from storage', () => {
    localStorage.setItem('test-key', JSON.stringify({ count: 10 }));

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const baseChunk = chunk({ count: 0 });
    persist(baseChunk, { key: 'test-key' });

    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
  });

  it('should handle corrupted storage data gracefully', () => {
    localStorage.setItem('test-key', 'invalid json{{{');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, { key: 'test-key' });

    expect(persistedChunk.get()).toEqual({ count: 0 });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('persist: Failed to load state'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should warn on type mismatch and use initial value', () => {
    localStorage.setItem('test-key', JSON.stringify('wrong type'));

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, { key: 'test-key' });

    expect(persistedChunk.get()).toEqual({ count: 0 });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('persist: Type mismatch')
    );

    consoleWarnSpy.mockRestore();
  });

  it('should call onError on type mismatch in addition to console.warn', () => {
    localStorage.setItem('test-key', JSON.stringify([1, 2, 3])); // array vs object

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    const errors: Array<{ error: Error; op: string }> = [];

    const baseChunk = chunk({ count: 0 });
    persist(baseChunk, {
      key: 'test-key',
      onError: (error, op) => errors.push({ error, op }),
    });

    expect(baseChunk.get()).toEqual({ count: 0 });
    expect(errors).toHaveLength(1);
    expect(errors[0].op).toBe('load');
    expect(errors[0].error.message).toContain('Type mismatch');

    consoleWarnSpy.mockRestore();
  });

  it('should detect object vs array type mismatch', () => {
    localStorage.setItem('items', JSON.stringify({ name: 'not an array' }));

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

    const baseChunk = chunk([1, 2, 3]);
    persist(baseChunk, { key: 'items' });

    expect(baseChunk.get()).toEqual([1, 2, 3]); // initial value preserved
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Type mismatch')
    );

    consoleWarnSpy.mockRestore();
  });

  it('should unsubscribe from chunk on destroy', () => {
    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, { key: 'test-key' });

    persistedChunk.set({ count: 1 });
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ count: 1 }));

    persistedChunk.destroy();

    expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ count: 1 }));

    baseChunk.set({ count: 999 });

    expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ count: 1 }));
  });

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
    expect(localStorage.getItem('session-key')).toBeNull();
  });

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

    const baseChunk2 = chunk(new Date());
    const persistedChunk2 = persist(baseChunk2, {
      key: 'date-key',
      serialize: (date) => date.toISOString(),
      deserialize: (str) => new Date(str)
    });

    expect(persistedChunk2.get().toISOString()).toBe('2024-12-31T23:59:59.999Z');
  });

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

  it('should persist and load null values', () => {
    const baseChunk = chunk<string | null>('initial');
    const persistedChunk = persist(baseChunk, { key: 'nullable-key' });

    persistedChunk.set(null);

    expect(localStorage.getItem('nullable-key')).toBe('null');

    const baseChunk2 = chunk<string | null>('initial');
    const persistedChunk2 = persist(baseChunk2, { key: 'nullable-key' });

    expect(persistedChunk2.get()).toBeNull();
  });

  it('should persist and load arrays', () => {
    const baseChunk = chunk([1, 2, 3]);
    const persistedChunk = persist(baseChunk, { key: 'array-key' });

    persistedChunk.set([4, 5, 6]);

    expect(JSON.parse(localStorage.getItem('array-key')!)).toEqual([4, 5, 6]);

    const baseChunk2 = chunk<number[]>([]);
    const persistedChunk2 = persist(baseChunk2, { key: 'array-key' });

    expect(persistedChunk2.get()).toEqual([4, 5, 6]);
  });

  it('should persist state changes from updater functions', () => {
    const baseChunk = chunk(0);
    const persistedChunk = persist(baseChunk, { key: 'updater-key' });

    persistedChunk.set((prev) => prev + 1);
    persistedChunk.set((prev) => prev * 2);

    expect(JSON.parse(localStorage.getItem('updater-key')!)).toBe(2);
  });

  it('should handle missing storage gracefully (SSR)', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

    const baseChunk = chunk({ count: 0 });
    const persistedChunk = persist(baseChunk, {
      key: 'test-key',
      storage: undefined as any
    });

    expect(persistedChunk.get()).toEqual({ count: 0 });
    persistedChunk.set({ count: 5 });
    expect(persistedChunk.get()).toEqual({ count: 5 });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'persist: Storage not available for key "test-key". Persistence disabled.'
    );

    consoleWarnSpy.mockRestore();
  });

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

  it('should handle rapid consecutive updates', () => {
    const persistedChunk = persist(chunk(0), { key: 'rapid-key' });

    for (let i = 0; i < 100; i++) {
      persistedChunk.set(i);
    }

    expect(JSON.parse(localStorage.getItem('rapid-key')!)).toBe(99);
  });

  it('should remove persisted key from storage without destroying the chunk', () => {
    const baseChunk = chunk({ name: 'Alice' });
    const persisted = persist(baseChunk, { key: 'user' });

    persisted.set({ name: 'Bob' });
    expect(localStorage.getItem('user')).toBeDefined();

    persisted.clearStorage();
    expect(localStorage.getItem('user')).toBeNull();

    // Chunk still works after clearing storage
    expect(persisted.get()).toEqual({ name: 'Bob' });
    persisted.set({ name: 'Charlie' });
    expect(persisted.get()).toEqual({ name: 'Charlie' });
  });
});
