import { useEffect, useMemo, useRef } from "react";

import { useChunk } from "./useChunk";
import type { Chunk } from "../../core/core";

/**
 * A hook for creating a read-only derived value from a chunk.
 * Ensures reactivity and updates when the source chunk changes.
 */
export function useDerive<T, D>(chunk: Chunk<T>, fn: (value: T) => D): D {
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const derivedChunk = useMemo(() => {
    return chunk.derive((value) => fnRef.current(value));
  }, [chunk]);

  const [derivedValue] = useChunk(derivedChunk);
  return derivedValue;
}
