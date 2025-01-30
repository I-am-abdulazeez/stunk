import { Chunk } from "../core/core";

export interface ChunkWithHistory<T> extends Chunk<T> {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getHistory: () => T[];
  clearHistory: () => void;
}

export function withHistory<T>(
  baseChunk: Chunk<T>,
  options: { maxHistory?: number } = {}
): ChunkWithHistory<T> {
  const { maxHistory = 100 } = options;
  const history: T[] = [baseChunk.get()];
  let currentIndex = 0;
  let isHistoryAction = false;

  const historyChunk: ChunkWithHistory<T> = {
    ...baseChunk,

    set: (newValue: T) => {
      if (isHistoryAction) {
        baseChunk.set(newValue);
        return;
      }

      // Remove any future history when setting a new value
      history.splice(currentIndex + 1);
      history.push(newValue);

      // Limit history size
      if (history.length > maxHistory) {
        console.warn("History limit reached. Removing oldest entries.");
        const removeCount = history.length - maxHistory;
        history.splice(0, removeCount);
        currentIndex = Math.max(0, currentIndex - removeCount);
      }

      currentIndex = history.length - 1;
      baseChunk.set(newValue);
    },

    undo: () => {
      if (!historyChunk.canUndo()) return;

      isHistoryAction = true;
      currentIndex--;
      historyChunk.set(history[currentIndex]);
      isHistoryAction = false;
    },

    redo: () => {
      if (!historyChunk.canRedo()) return;

      isHistoryAction = true;
      currentIndex++;
      historyChunk.set(history[currentIndex]);
      isHistoryAction = false;
    },

    canUndo: () => currentIndex > 0,

    canRedo: () => currentIndex < history.length - 1,

    getHistory: () => [...history],

    clearHistory: () => {
      const currentValue = baseChunk.get();
      history.length = 0;
      history.push(currentValue);
      currentIndex = 0;
    },

    // Override destroy to clean up history
    destroy: () => {
      history.length = 0;
      baseChunk.destroy();
    }
  }

  return historyChunk;

}
