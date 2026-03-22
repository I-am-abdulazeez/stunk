import { useChunk } from "./use-chunk";

import type { Chunk } from "../../core/core";

/**
 * Subscribes to a chunk and returns only its current value.
 * Use this in read-only components that never need to call `set`.
 *
 * @param chunk - The chunk to subscribe to.
 * @param selector - Optional function to select a derived value.
 *
 * @example
 * const name = useChunkValue(userChunk, u => u.name);
 */
export function useChunkValue<T, S = T>(
  chunk: Chunk<T>,
  selector?: (value: T) => S
): S {
  const [value] = useChunk(chunk, selector);
  return value;
}
