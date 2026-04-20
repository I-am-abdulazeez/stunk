import { useState, useEffect, useCallback } from "react";
import { select } from "../../core/selector";
import type { Chunk, ReadOnlyChunk } from "../../core/core";

/**
 * Subscribes to a chunk and returns its current value along with setters,
 * reset, and destroy. Accepts both writable `Chunk<T>` and read-only
 * `ReadOnlyChunk<T>` (e.g. derived chunks from `.derive()` or `select()`).
 *
 * For read-only chunks, the returned `set` and `reset` will be no-ops at
 * runtime — prefer `useChunkValue` for derived/read-only chunks.
 *
 * @example
 * const count = chunk(0);
 * const [value, setValue] = useChunk(count);
 *
 * @example
 * // Works with derived chunks too
 * const doubled = count.derive(n => n * 2);
 * const [value] = useChunk(doubled);
 */
export function useChunk<T, S = T>(
  chunk: Chunk<T> | ReadOnlyChunk<T>,
  selector?: (value: T) => S
) {
  const selectedChunk = selector ? select(chunk as Chunk<T>, selector) : chunk;

  const [state, setState] = useState<S>(() => selectedChunk.get() as S);

  useEffect(() => {
    const unsubscribe = selectedChunk.subscribe((newValue) => {
      setState(() => newValue as S);
    });
    return () => unsubscribe();
  }, [selectedChunk]);

  const set = useCallback((valueOrUpdater: T | ((currentValue: T) => T)) => {
    if ('set' in chunk) {
      (chunk as Chunk<T>).set(valueOrUpdater);
    }
  }, [chunk]);

  const reset = useCallback(() => {
    if ('reset' in chunk) {
      (chunk as Chunk<T>).reset();
    }
  }, [chunk]);

  const destroy = useCallback(() => {
    chunk.destroy();
  }, [chunk]);

  return [state, set, reset, destroy] as const;
}
