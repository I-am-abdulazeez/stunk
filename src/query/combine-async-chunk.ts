import type { CombinedData, CombinedState } from "../core/types";
import { chunk, type Chunk } from "../core/core";
import type { AsyncChunk } from "./async-chunk";

/**
 * Combines multiple async chunks into a single unified state chunk.
 *
 * The result tracks `loading` (true if any chunk is loading), `error` (first
 * error encountered), `errors` (per-chunk errors), and `data` (per-chunk data).
 *
 * @param chunks - A record of named `AsyncChunk` instances.
 * @returns A `Chunk<CombinedState<T>>` that reflects the live state of all inputs.
 *
 * @example
 * const combined = combineAsyncChunks({ user: userChunk, posts: postsChunk });
 * combined.get(); // { loading, error, errors, data: { user, posts } }
 */
export function combineAsyncChunks<T extends Record<string, AsyncChunk<any>>>(
  chunks: T
): Chunk<CombinedState<T>> {
  const entries = Object.entries(chunks);

  // Pre-populate initial data and state from each chunk's current state
  const initialData = entries.reduce((acc, [key, asyncChunk]) => {
    acc[key as keyof T] = asyncChunk.get().data;
    return acc;
  }, {} as CombinedData<T>);

  const initialErrors = entries.reduce((acc, [key, asyncChunk]) => {
    const error = asyncChunk.get().error;
    if (error) acc[key as keyof T] = error;
    return acc;
  }, {} as Partial<{ [K in keyof T]: Error }>);

  const initialLoading = entries.some(([, asyncChunk]) => asyncChunk.get().loading);
  const initialFirstError = entries.find(([, asyncChunk]) => asyncChunk.get().error)?.[1].get().error ?? null;

  const initialState: CombinedState<T> = {
    loading: initialLoading,
    error: initialFirstError,
    errors: initialErrors,
    data: initialData,
  };

  const combined = chunk(initialState);

  // Subscribe to each async chunk
  entries.forEach(([key, asyncChunk]) => {
    asyncChunk.subscribe(() => {
      // Always re-read all chunks fresh — avoids stale closure on individual state arg
      let hasLoading = false;
      let firstError: Error | null = null;
      const allErrors: Partial<{ [K in keyof T]: Error }> = {};
      const newData = { ...combined.get().data };

      entries.forEach(([chunkKey, c]) => {
        const chunkState = c.get();

        if (chunkState.loading) hasLoading = true;

        if (chunkState.error) {
          if (!firstError) firstError = chunkState.error;
          allErrors[chunkKey as keyof T] = chunkState.error;
        }

        newData[chunkKey as keyof T] = chunkState.data;
      });

      combined.set({
        loading: hasLoading,
        error: firstError,
        errors: allErrors,
        data: newData,
      });
    });
  });

  return combined;
}
