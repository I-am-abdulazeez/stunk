import { useState, useEffect, useCallback } from "react";

import type { Chunk } from "../../core/core";
import { select } from "../../core/selector";

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

  const set = useCallback((value: T) => {
    chunk.set(value);
  }, [chunk]);

  const update = useCallback(
    (updater: (currentValue: T) => T) => {
      chunk.update(updater);
    },
    [chunk]
  );

  const reset = useCallback(() => {
    chunk.reset();
  }, [chunk]);

  const destroy = useCallback(() => {
    chunk.destroy();
  }, [chunk]);

  return [state, set, update, reset, destroy] as const;
}
