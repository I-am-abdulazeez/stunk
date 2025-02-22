import { useChunk } from "./useChunk";

import type { Chunk } from "core/core";

/**
 * A lightweight hook that subscribes to a chunk and returns only its current value.
 * Useful for read-only components that don't need to update the chunk.
 */
export function useChunkValue<T, S = T>(
  chunk: Chunk<T>,
  selector?: (value: T) => S
): S {
  const [value] = useChunk(chunk, selector);
  return value;
}
