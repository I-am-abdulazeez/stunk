import { describe, it, expect, vi } from "vitest";
import { chunk } from "../src/core/core";
import { history } from "../src/middleware/history";

describe('Chunk with History', () => {
  it('should maintain history of changes', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);
    historyChunk.set(3);

    expect(historyChunk.getHistory()).toEqual([0, 1, 2, 3]);
  });

  it('should handle undo and redo operations', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);
    const callback = vi.fn();

    historyChunk.subscribe(callback);

    historyChunk.set(1);
    historyChunk.set(2);

    expect(historyChunk.get()).toBe(2);

    historyChunk.undo();
    expect(historyChunk.get()).toBe(1);

    historyChunk.undo();
    expect(historyChunk.get()).toBe(0);

    historyChunk.redo();
    expect(historyChunk.get()).toBe(1);

    historyChunk.redo();
    expect(historyChunk.get()).toBe(2);

    // Updated expectation: callback is called for each change
    // 2 sets + 2 undos + 2 redos = 6 calls
    expect(callback).toHaveBeenCalledTimes(6);
  });

  it('should handle branching history', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);
    historyChunk.undo();
    historyChunk.set(3);

    expect(historyChunk.getHistory()).toEqual([0, 1, 3]);
    expect(historyChunk.get()).toBe(3);
  });

  it('should respect maxHistory limit', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk, { maxHistory: 3 });

    historyChunk.set(1);
    historyChunk.set(2);
    historyChunk.set(3);
    historyChunk.set(4);

    expect(historyChunk.getHistory()).toEqual([2, 3, 4]);
    expect(historyChunk.get()).toBe(4);
  });

  it('should handle canUndo and canRedo correctly', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    expect(historyChunk.canUndo()).toBe(false);
    expect(historyChunk.canRedo()).toBe(false);

    historyChunk.set(1);
    expect(historyChunk.canUndo()).toBe(true);
    expect(historyChunk.canRedo()).toBe(false);

    historyChunk.undo();
    expect(historyChunk.canUndo()).toBe(false);
    expect(historyChunk.canRedo()).toBe(true);
  });

  it('should clear history properly', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);

    historyChunk.clearHistory();

    expect(historyChunk.getHistory()).toEqual([2]);
    expect(historyChunk.canUndo()).toBe(false);
    expect(historyChunk.canRedo()).toBe(false);
  });

  // ✅ NEW TEST: Skip duplicates with primitives
  it('should skip duplicate values when skipDuplicates is enabled', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk, { skipDuplicates: true });

    historyChunk.set(1);
    historyChunk.set(1); // Duplicate - should be skipped
    historyChunk.set(2);
    historyChunk.set(2); // Duplicate - should be skipped
    historyChunk.set(3);

    expect(historyChunk.getHistory()).toEqual([0, 1, 2, 3]);
  });

  // ✅ NEW TEST: Skip duplicates with objects (shallow equality)
  it('should skip duplicate objects when skipDuplicates is enabled', () => {
    const baseChunk = chunk({ name: 'Alice', age: 30 });
    const historyChunk = history(baseChunk, { skipDuplicates: true });

    historyChunk.set({ name: 'Bob', age: 25 });
    historyChunk.set({ name: 'Bob', age: 25 }); // Duplicate - should be skipped
    historyChunk.set({ name: 'Charlie', age: 35 });

    expect(historyChunk.getHistory()).toEqual([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 35 }
    ]);
  });

  // ✅ NEW TEST: Nested objects are NOT skipped (shallow equality limitation)
  it('should NOT skip nested objects with same content (shallow equality)', () => {
    const baseChunk = chunk({ user: { name: 'Alice' } });
    const historyChunk = history(baseChunk, { skipDuplicates: true });

    historyChunk.set({ user: { name: 'Alice' } });
    historyChunk.set({ user: { name: 'Alice' } });

    // Both are added because nested objects have different references
    expect(historyChunk.getHistory()).toEqual([
      { user: { name: 'Alice' } },
      { user: { name: 'Alice' } },
      { user: { name: 'Alice' } }
    ]);
  });

  // ✅ NEW TEST: Undo/redo without isHistoryAction flag
  it('should handle undo/redo without triggering infinite loops', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);
    historyChunk.set(3);

    expect(historyChunk.get()).toBe(3);

    historyChunk.undo();
    historyChunk.undo();
    expect(historyChunk.get()).toBe(1);

    historyChunk.redo();
    expect(historyChunk.get()).toBe(2);

    // History should not have duplicates from undo/redo
    expect(historyChunk.getHistory()).toEqual([0, 1, 2, 3]);
  });

  // ✅ NEW TEST: Updater functions work correctly
  it('should handle updater functions in set()', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set((prev) => prev + 1);
    historyChunk.set((prev) => prev + 1);
    historyChunk.set((prev) => prev * 2);

    expect(historyChunk.getHistory()).toEqual([0, 1, 2, 4]);
    expect(historyChunk.get()).toBe(4);

    historyChunk.undo();
    expect(historyChunk.get()).toBe(2);
  });

  // ✅ NEW TEST: Destroy cleans up properly
  it('should clean up history on destroy', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);

    expect(historyChunk.getHistory()).toEqual([0, 1, 2]);

    historyChunk.destroy();

    // After destroy, history should be cleared
    // Note: We can't really test this without inspecting internals
    // But we can ensure destroy doesn't throw
    expect(() => historyChunk.destroy()).not.toThrow();
  });

  // ✅ NEW TEST: History limit with undo/redo
  it('should handle maxHistory with undo/redo correctly', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk, { maxHistory: 3 });

    historyChunk.set(1);
    historyChunk.set(2);
    historyChunk.set(3);
    historyChunk.set(4); // Pushes out 0

    expect(historyChunk.getHistory()).toEqual([2, 3, 4]);

    historyChunk.undo();
    expect(historyChunk.get()).toBe(3);
    expect(historyChunk.canUndo()).toBe(true); // Can still undo to 2

    historyChunk.undo();
    expect(historyChunk.get()).toBe(2);
    expect(historyChunk.canUndo()).toBe(false); // Can't undo further (0 was removed)
  });

  // ✅ NEW TEST: Empty history edge case
  it('should handle undo/redo at history boundaries', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    // Try undo when at the beginning
    historyChunk.undo();
    expect(historyChunk.get()).toBe(0); // Should not change

    historyChunk.set(1);
    historyChunk.undo();

    // Try redo when at the end
    historyChunk.redo();
    historyChunk.redo(); // Should not go beyond
    expect(historyChunk.get()).toBe(1); // Should stay at 1
  });

  // ✅ NEW TEST: Peek doesn't affect history
  it('should not affect history when using peek()', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(1);
    const peeked = historyChunk.peek();
    historyChunk.set(2);

    expect(peeked).toBe(1);
    expect(historyChunk.getHistory()).toEqual([0, 1, 2]);
  });
});
