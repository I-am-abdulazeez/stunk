import { useState, useEffect } from "react";
import type { Chunk } from "../../core/core";

export function useChunk<T>(chunk: Chunk<T>): T {
  const [value, setValue] = useState<T>(chunk.get());

  useEffect(() => {
    const unsubscribe = chunk.subscribe((newValue) => {
      setValue(newValue);
    });

    return unsubscribe;
  }, [chunk]);

  return value;
}
