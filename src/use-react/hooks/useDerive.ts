import { useChunk } from "./useChunk";

import type { Chunk } from "../../core/core";

export function useDerive<T, D>(chunk: Chunk<T>, fn: (value: T) => D): D {
  const [derivedValue] = useChunk(chunk.derive(fn));
  return derivedValue;
}
