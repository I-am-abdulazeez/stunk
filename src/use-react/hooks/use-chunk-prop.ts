import { useMemo } from "react";

import { useChunkValue } from "./use-chunk-value";

import type { Chunk } from "../../core/core";

/**
 * A hook that subscribes to a specific property of a chunk.
 * This optimizes renders by only updating when the selected property changes.
 */
export function useChunkProperty<T, K extends keyof T>(
  chunk: Chunk<T>,
  property: K
): T[K] {
  const selector = useMemo(
    () => (state: T) => state[property],
    [property]
  );

  return useChunkValue(chunk, selector);
}
