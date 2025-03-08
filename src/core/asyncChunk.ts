import { chunk, Chunk } from "./core";
import { AsyncChunkOpt } from "./types";

export interface AsyncState<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
}

export interface AsyncChunk<T> extends Chunk<AsyncState<T>> {
  /**
   * Reload the data from the source.
   */
  reload: () => Promise<void>;
  /**
   * Mutate the data directly.
   */
  mutate: (mutator: (currentData: T | null) => T) => void;
  /**
   * Reset the state to the initial value.
   */
  reset: () => void;
}

export function asyncChunk<T>(fetcher: () => Promise<T>, options: AsyncChunkOpt<T> = {}): AsyncChunk<T> {
  const {
    initialData = null,
    onError,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  const initialState: AsyncState<T> = {
    loading: true,
    error: null,
    data: initialData,
  };

  const baseChunk = chunk(initialState);

  const fetchData = async (retries = retryCount): Promise<void> => {
    baseChunk.set({ ...baseChunk.get(), loading: true, error: null });

    try {
      const data = await fetcher();
      baseChunk.set({ loading: false, error: null, data });
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchData(retries - 1);
      }

      const errorObj = error instanceof Error ? error : new Error(String(error));
      baseChunk.set({ loading: false, error: errorObj, data: baseChunk.get().data });

      if (onError) {
        onError(errorObj);
      }

    }
  }

  // Initial fetch
  fetchData();

  const asyncChunkInstance: AsyncChunk<T> = {
    ...baseChunk,
    reload: async () => {
      await fetchData();
    },
    mutate: (mutator: (currentData: T | null) => T) => {
      const currentState = baseChunk.get();
      const newData = mutator(currentState.data);
      baseChunk.set({ ...currentState, data: newData });
    },
    reset: () => {
      baseChunk.set(initialState);
      fetchData();
    },
  }

  return asyncChunkInstance;
}
