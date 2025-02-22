import { useMemo } from "react";

import { useChunk } from "./useChunk";
import type { Chunk } from "../../core/core";

/**
 * A hook for creating a read-only derived value from a chunk.
 * Ensures reactivity and updates when the source chunk changes.
 */
export function useDerive<T, D>(chunk: Chunk<T>, fn: (value: T) => D): D {
  const derivedChunk = useMemo(() => chunk.derive(fn), [chunk, fn]);
  const [derivedValue] = useChunk(derivedChunk);

  return derivedValue;
}
