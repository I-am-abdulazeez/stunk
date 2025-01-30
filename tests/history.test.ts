import { batch, chunk } from "../src/core/core";
import { withHistory } from "../src/middleware/history";


describe('Chunk with History', () => {
  it('should maintain history of changes', () => {
    const baseChunk = chunk(0);
    const historyChunk = withHistory(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);
    historyChunk.set(3);

    expect(historyChunk.getHistory()).toEqual([0, 1, 2, 3]);
  });

  it('should handle undo and redo operations', () => {
    const baseChunk = chunk(0);
    const historyChunk = withHistory(baseChunk);
    const callback = jest.fn();

    historyChunk.subscribe(callback);
    callback.mockClear(); // Clear initial subscription call

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

    expect(callback).toHaveBeenCalledTimes(6); // 2 sets + 2 undos + 2 redos
  });

  it('should handle branching history', () => {
    const baseChunk = chunk(0);
    const historyChunk = withHistory(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);
    historyChunk.undo();
    historyChunk.set(3); // This should create a new branch

    expect(historyChunk.getHistory()).toEqual([0, 1, 3]);
    expect(historyChunk.get()).toBe(3);
  });

  it('should respect maxHistory limit', () => {
    const baseChunk = chunk(0);
    const historyChunk = withHistory(baseChunk, { maxHistory: 3 });

    historyChunk.set(1);
    historyChunk.set(2);
    historyChunk.set(3);
    historyChunk.set(4);

    expect(historyChunk.getHistory()).toEqual([2, 3, 4]);
  });

  it('should handle canUndo and canRedo correctly', () => {
    const baseChunk = chunk(0);
    const historyChunk = withHistory(baseChunk);

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
    const historyChunk = withHistory(baseChunk);

    historyChunk.set(1);
    historyChunk.set(2);

    historyChunk.clearHistory();

    expect(historyChunk.getHistory()).toEqual([2]);
    expect(historyChunk.canUndo()).toBe(false);
    expect(historyChunk.canRedo()).toBe(false);
  });
});
