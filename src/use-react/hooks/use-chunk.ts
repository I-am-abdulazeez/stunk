import { useState, useEffect, useCallback } from "react";

import { select } from "../../core/selector";

import type { Chunk } from "../../core/core";

/**
 * Subscribes to a chunk and returns its current value along with `set`, `reset`, and `destroy`.
 *
 * Pass an optional `selector` to derive a slice of the value and avoid
 * unnecessary re-renders when unrelated fields change.
 *
 * @param chunk - The chunk to subscribe to.
 * @param selector - Optional function to select a derived value.
 * @returns `[value, set, reset, destroy]`
 *
 * @example
 * const [count, setCount, reset] = useChunk(countChunk);
 *
 * @example
 * // Only re-renders when `name` changes
 * const [name, setUser] = useChunk(userChunk, u => u.name);
 */
export function useChunk<T, S = T>(
  chunk: Chunk<T>,
  selector?: (value: T) => S
) {
  const selectedChunk = selector ? select(chunk, selector) : chunk;

  const [state, setState] = useState<S>(() => selectedChunk.get() as S);

  useEffect(() => {
    const unsubscribe = selectedChunk.subscribe((newValue) => {
      setState(() => newValue as S);
    });
    return () => unsubscribe();
  }, [selectedChunk]);

  const set = useCallback((valueOrUpdater: T | ((currentValue: T) => T)) => {
    chunk.set(valueOrUpdater);
  }, [chunk]);

  const reset = useCallback(() => {
    chunk.reset();
  }, [chunk]);

  const destroy = useCallback(() => {
    chunk.destroy();
  }, [chunk]);

  return [state, set, reset, destroy] as const;
}
