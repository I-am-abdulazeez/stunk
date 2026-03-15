import { describe, it, expect, vi } from "vitest";
import { chunk } from "../../src/core/core";
import { history } from "../../src/middleware";

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

  it('should skip duplicate values when skipDuplicates is enabled', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk, { skipDuplicates: true });

    historyChunk.set(1);
    historyChunk.set(1); // duplicate — should be skipped
    historyChunk.set(2);
    historyChunk.set(2); // duplicate — should be skipped
    historyChunk.set(3);

    expect(historyChunk.getHistory()).toEqual([0, 1, 2, 3]);
  });

  it('should skip duplicate objects when skipDuplicates is enabled', () => {
    const baseChunk = chunk({ name: 'Alice', age: 30 });
    const historyChunk = history(baseChunk, { skipDuplicates: true });

    historyChunk.set({ name: 'Bob', age: 25 });
    historyChunk.set({ name: 'Bob', age: 25 }); // different object reference — NOT skipped with true
    historyChunk.set({ name: 'Charlie', age: 35 });

    // skipDuplicates: true only does strict equality (===)
    // new objects with same values are NOT skipped — use 'shallow' for that
    expect(historyChunk.getHistory()).toEqual([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 35 }
    ]);
  });

  it('should skip shallowly equal objects when skipDuplicates is shallow', () => {
    const baseChunk = chunk({ name: 'Alice', age: 30 });
    const historyChunk = history(baseChunk, { skipDuplicates: 'shallow' });

    historyChunk.set({ name: 'Bob', age: 25 });
    historyChunk.set({ name: 'Bob', age: 25 }); // shallowly equal — skipped
    historyChunk.set({ name: 'Charlie', age: 35 });

    expect(historyChunk.getHistory()).toEqual([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 35 }
    ]);
  });

  it('should NOT skip nested objects with same content (shallow equality limitation)', () => {
    const baseChunk = chunk({ user: { name: 'Alice' } });
    const historyChunk = history(baseChunk, { skipDuplicates: true });

    historyChunk.set({ user: { name: 'Alice' } });
    historyChunk.set({ user: { name: 'Alice' } });

    // Both added — nested objects have different references
    expect(historyChunk.getHistory()).toEqual([
      { user: { name: 'Alice' } },
      { user: { name: 'Alice' } },
      { user: { name: 'Alice' } }
    ]);
  });

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

    // undo/redo should not pollute history
    expect(historyChunk.getHistory()).toEqual([0, 1, 2, 3]);
  });

  it('should handle updater functions in set()', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(prev => prev + 1);
    historyChunk.set(prev => prev + 1);
    historyChunk.set(prev => prev * 2);

    expect(historyChunk.getHistory()).toEqual([0, 1, 2, 4]);
    expect(historyChunk.get()).toBe(4);

    historyChunk.undo();
    expect(historyChunk.get()).toBe(2);
  });

  it('should clean up history on destroy', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);

    expect(historyChunk.getHistory()).toEqual([0, 1, 2]);

    historyChunk.destroy();

    expect(() => historyChunk.destroy()).not.toThrow();
  });

  it('should handle maxHistory with undo/redo correctly', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk, { maxHistory: 3 });

    historyChunk.set(1);
    historyChunk.set(2);
    historyChunk.set(3);
    historyChunk.set(4); // pushes out 0

    expect(historyChunk.getHistory()).toEqual([2, 3, 4]);

    historyChunk.undo();
    expect(historyChunk.get()).toBe(3);
    expect(historyChunk.canUndo()).toBe(true);

    historyChunk.undo();
    expect(historyChunk.get()).toBe(2);
    expect(historyChunk.canUndo()).toBe(false); // 0 was removed
  });

  it('should handle undo/redo at history boundaries', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.undo(); // at beginning — should not change
    expect(historyChunk.get()).toBe(0);

    historyChunk.set(1);
    historyChunk.undo();

    historyChunk.redo();
    historyChunk.redo(); // beyond end — should not go further
    expect(historyChunk.get()).toBe(1);
  });

  it('should not affect history when using peek()', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(1);
    const peeked = historyChunk.peek();
    historyChunk.set(2);

    expect(peeked).toBe(1);
    expect(historyChunk.getHistory()).toEqual([0, 1, 2]);
  });

  // reset() now overrides the base chunk reset — clears history and resets currentIndex
  it('should reset value AND clear history on reset()', () => {
    const baseChunk = chunk(0);
    const historyChunk = history(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);

    historyChunk.reset();

    // Value is reset to initial
    expect(historyChunk.get()).toBe(0);

    // History is cleared — only initial value remains
    expect(historyChunk.getHistory()).toEqual([0]);

    // canUndo and canRedo are both false
    expect(historyChunk.canUndo()).toBe(false);
    expect(historyChunk.canRedo()).toBe(false);
  });
});
