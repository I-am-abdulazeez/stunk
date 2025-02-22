import { useState, useEffect } from "react";

import type { Chunk } from "../../core/core";

/**
 * Hook to read values from multiple chunks at once.
 * Only re-renders when any of the chunk values change.
 */
export function useChunkValues<T extends Chunk<any>[]>(
  chunks: [...T]
): { [K in keyof T]: T[K] extends Chunk<infer U> ? U : never } {
  type ReturnType = { [K in keyof T]: T[K] extends Chunk<infer U> ? U : never };

  const [values, setValues] = useState<ReturnType>(() => {
    return chunks.map(chunk => chunk.get()) as ReturnType;
  });

  useEffect(() => {
    const unsubscribes = chunks.map((chunk, index) => {
      return chunk.subscribe((newValue) => {
        setValues(prev => {
          const newValues = [...prev] as ReturnType;
          newValues[index] = newValue;
          return newValues;
        });
      });
    });

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [chunks]);

  return values;
}
