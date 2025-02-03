import { chunk, Chunk } from "./core/core";

import { AsyncChunk } from "./core/asyncChunk";
import { CombinedData, CombinedState, InferAsyncData } from "./core/types";

export function isValidChunkValue(value: any): boolean {
  return value !== null && value !== undefined;
}

export function combineAsyncChunks<T extends Record<string, AsyncChunk<any>>>(
  chunks: T
): Chunk<{
  loading: boolean;
  error: Error | null;
  data: { [K in keyof T]: InferAsyncData<T[K]> | null };
}> {
  // Create initial state with proper typing
  const initialData = Object.keys(chunks).reduce((acc, key) => {
    acc[key as keyof T] = null;
    return acc;
  }, {} as CombinedData<T>);

  const initialState: CombinedState<T> = {
    loading: true,
    error: null,
    data: initialData
  };

  const combined = chunk(initialState);

  Object.entries(chunks).forEach(([key, asyncChunk]) => {
    asyncChunk.subscribe((state) => {
      const currentState = combined.get();

      combined.set({
        loading: Object.values(chunks).some(chunk => chunk.get().loading),
        error: Object.values(chunks)
          .map(chunk => chunk.get().error)
          .find(error => error !== null) || null,
        data: {
          ...currentState.data,
          [key]: state.data
        },
      });
    });
  });

  return combined;
}
