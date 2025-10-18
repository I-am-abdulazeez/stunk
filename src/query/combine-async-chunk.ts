import type { CombinedData, CombinedState } from "../core/types";
import { chunk, type Chunk } from "../core/core";
import type { AsyncChunk } from "./async-chunk";

/**
 * Combines multiple async chunks into a single chunk.
 * The combined chunk tracks loading, error, and data states from all source chunks.
 */
export function combineAsyncChunks<T extends Record<string, AsyncChunk<any>>>(
  chunks: T
): Chunk<CombinedState<T>> {
  const initialData = Object.keys(chunks).reduce((acc, key) => {
    acc[key as keyof T] = null;
    return acc;
  }, {} as CombinedData<T>);

  const initialState: CombinedState<T> = {
    loading: Object.keys(chunks).length > 0,
    error: null,
    errors: {},
    data: initialData
  };

  const combined = chunk(initialState);


  // Subscribe to each async chunk
  Object.entries(chunks).forEach(([key, asyncChunk]) => {
    asyncChunk.subscribe((state) => {
      const currentState = combined.get();

      // Recalculate loading and error states from all chunks
      let hasLoading = false;
      let firstError: Error | null = null;
      const allErrors: Partial<{ [K in keyof T]: Error }> = {};

      Object.entries(chunks).forEach(([chunkKey, chunk]) => {
        const chunkState = chunk.get();

        // Check loading state
        if (chunkState.loading) {
          hasLoading = true;
        }
        // Collect errors
        if (chunkState.error) {
          if (!firstError) firstError = chunkState.error;
          allErrors[chunkKey as keyof T] = chunkState.error;
        }
      });

      // Update combined state
      combined.set({
        loading: hasLoading,
        error: firstError,
        errors: allErrors,
        data: {
          ...currentState.data,
          [key]: state.data
        },
      });
    });
  });

  return combined;
}
