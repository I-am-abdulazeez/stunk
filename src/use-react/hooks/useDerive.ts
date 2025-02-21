import { useMemo } from "react";

import { useChunk } from "./useChunk";
import type { Chunk } from "../../core/core";

export function useDerive<T, D>(chunk: Chunk<T>, fn: (value: T) => D): D {
  const derivedChunk = useMemo(() => chunk.derive(fn), [chunk, fn]);
  const [derivedValue] = useChunk(derivedChunk);

  return derivedValue;
}
