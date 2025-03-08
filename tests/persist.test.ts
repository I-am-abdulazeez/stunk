/**
 * @vi-environment jsdom
 */

import { describe, beforeEach, it, expect, vi } from 'vitest';
import { chunk } from '../src/core/core';
import { withPersistence } from "../src/middleware/persistence";

describe('withPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should persist state to localStorage', () => {
    const baseChunk = chunk({ count: 0 });
    const persistedChunk = withPersistence(baseChunk, { key: 'test-key' });

    persistedChunk.set({ count: 1 });
    expect(JSON.parse(localStorage.getItem('test-key')!)).toEqual({ count: 1 });
  });

  it('should load persisted state on initialization', () => {
    localStorage.setItem('test-key', JSON.stringify({ count: 5 }));

    const baseChunk = chunk({ count: 0 });
    const persistedChunk = withPersistence(baseChunk, { key: 'test-key' });

    expect(persistedChunk.get()).toEqual({ count: 5 });
  });

  it('should use custom storage', () => {
    const mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    const baseChunk = chunk({ count: 0 });
    withPersistence(baseChunk, {
      key: 'test-key',
      storage: mockStorage as unknown as Storage
    });

    expect(mockStorage.getItem).toHaveBeenCalledWith('test-key');
  });

  it('should use custom serializer/deserializer', () => {
    const baseChunk = chunk({ count: 0 });
    const persistedChunk = withPersistence(baseChunk, {
      key: 'test-key',
      serialize: value => btoa(JSON.stringify(value)),
      deserialize: value => JSON.parse(atob(value))
    });

    persistedChunk.set({ count: 1 });
    expect(localStorage.getItem('test-key')).toBe(btoa(JSON.stringify({ count: 1 })));
  });
});
