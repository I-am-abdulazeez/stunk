import { shallowEqual } from "../utils";
import { Chunk } from "../core/core";

export interface ChunkWithHistory<T> extends Chunk<T> {
  /**
 * Reverts to the previous state (if available).
 */
  undo: () => void;
  /**
   * Moves to the next state (if available).
   */
  redo: () => void;
  /**
   * Returns true if there is a previous state to revert to.
   */
  canUndo: () => boolean;
  /**
   * Returns true if there is a next state to move to.
   */
  canRedo: () => boolean;
  /**
   * Returns an array of all the values in the history.
   */
  getHistory: () => T[];
  /**
   * Clears the history, keeping only the current value.
   */
  clearHistory: () => void;
}

export function history<T>(
  baseChunk: Chunk<T>,
  options: {
    maxHistory?: number;
    skipDuplicates?: boolean | "shallow";
  } = {}
): ChunkWithHistory<T> {
  const { maxHistory = 100, skipDuplicates = false } = options;
  const historyStack: T[] = [baseChunk.get()];
  let currentIndex = 0;

  const historyChunk: ChunkWithHistory<T> = {
    ...baseChunk,

    get: () => baseChunk.get(),
    peek: () => baseChunk.peek(),

    set: (newValueOrUpdater: T | ((currentValue: T) => T)) => {
      // Process value
      let newValue: T;
      if (typeof newValueOrUpdater === 'function') {
        const currentValue = baseChunk.get();
        newValue = (newValueOrUpdater as ((currentValue: T) => T))(currentValue);
      } else {
        newValue = newValueOrUpdater;
      }

      if (skipDuplicates) {
        const currentValue = historyStack[currentIndex];

        if (skipDuplicates === true || skipDuplicates === 'shallow') {
          // Primitive check
          if (newValue === currentValue) {
            return;
          }

          // Shallow equality for objects
          if (
            typeof newValue === 'object' &&
            typeof currentValue === 'object' &&
            newValue !== null &&
            currentValue !== null &&
            shallowEqual(newValue, currentValue)
          ) {
            return;
          }
        }

      }

      // Clear forward history
      historyStack.splice(currentIndex + 1);

      // Add new entry
      historyStack.push(newValue);

      // Enforce history limit
      if (historyStack.length > maxHistory) {
        const removeCount = historyStack.length - maxHistory;
        historyStack.splice(0, removeCount);
        currentIndex = Math.max(0, currentIndex - removeCount);
      }

      currentIndex = historyStack.length - 1;
      baseChunk.set(newValue);
    },


    undo: () => {
      if (currentIndex <= 0) return;

      currentIndex--;
      baseChunk.set(historyStack[currentIndex]);
    },

    redo: () => {
      if (currentIndex >= historyStack.length - 1) return;

      currentIndex++;
      baseChunk.set(historyStack[currentIndex]);
    },

    canUndo: () => currentIndex > 0,
    canRedo: () => currentIndex < historyStack.length - 1,
    getHistory: () => [...historyStack],

    clearHistory: () => {
      const currentValue = baseChunk.get();
      historyStack.length = 0;
      historyStack.push(currentValue);
      currentIndex = 0;
    },

    destroy: () => {
      historyStack.length = 0;
      baseChunk.destroy();
    },

    subscribe: (callback) => baseChunk.subscribe(callback),
  };

  return historyChunk;
}
