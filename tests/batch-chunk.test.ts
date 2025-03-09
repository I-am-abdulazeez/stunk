import { describe, expect, it, vi } from "vitest"
import { chunk, batch } from '../src/core/core';


describe('Chunk batch updates', () => {
  it('should batch multiple updates into a single notification', () => {
    const countChunk = chunk(0);
    const callback = vi.fn();

    countChunk.subscribe(callback);
    callback.mockClear(); // Clear initial subscription call

    batch(() => {
      countChunk.set(1);
      countChunk.set(2);
      countChunk.set(3); // Should only notify once
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(3);
  });

  it('should handle nested batch calls', () => {
    const countChunk = chunk(0);
    const callback = vi.fn();

    countChunk.subscribe(callback);
    callback.mockClear();

    batch(() => {
      countChunk.set(1); // Should not notify yet
      batch(() => {
        countChunk.set(2);
        countChunk.set(3);
      });
      countChunk.set(4);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(4);
  });

  it('should handle errors in batch without breaking state', () => {
    const countChunk = chunk(0);
    const callback = vi.fn();

    countChunk.subscribe(callback);
    callback.mockClear();

    expect(() => {
      batch(() => {
        countChunk.set(1);
        throw new Error('Test error');
        // countChunk.set(2);
      });
    }).toThrow('Test error');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(1);
    expect(countChunk.get()).toBe(1);
  });

  it('should work with multiple chunks in the same batch', () => {
    const chunk1 = chunk(0);
    const chunk2 = chunk(0);
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    chunk1.subscribe(callback1);
    chunk2.subscribe(callback2);
    callback1.mockClear();
    callback2.mockClear();

    batch(() => {
      chunk1.set(1);
      chunk2.set(1);
      chunk1.set(2);
      chunk2.set(2);
    });

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenLastCalledWith(2);
    expect(callback2).toHaveBeenLastCalledWith(2);
  });

  it('should handle derived chunks in batch updates', () => {
    const sourceChunk = chunk(0);
    const derivedChunk = sourceChunk.derive(x => x * 2);
    const sourceCallback = vi.fn();
    const derivedCallback = vi.fn();

    sourceChunk.subscribe(sourceCallback);
    derivedChunk.subscribe(derivedCallback);
    sourceCallback.mockClear();
    derivedCallback.mockClear();

    batch(() => {
      sourceChunk.set(1);
      sourceChunk.set(2);
      sourceChunk.set(3);
    });

    expect(sourceCallback).toHaveBeenCalledTimes(1);
    expect(derivedCallback).toHaveBeenCalledTimes(1);
    expect(sourceCallback).toHaveBeenLastCalledWith(3);
    expect(derivedCallback).toHaveBeenLastCalledWith(6);
  });
});
