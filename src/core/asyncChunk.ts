import { chunk, Chunk } from "./core";

export interface AsyncState<T, E extends Error> {
  loading: boolean;
  error: E | null;
  data: T | null;
}

export interface AsyncChunk<T, E extends Error = Error> extends Chunk<AsyncState<T, E>> {
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

/**
 * Options for configuring an asynchronous chunk.
 *
 * @template T - The type of the data stored in the chunk.
 * @template E - The type of the error that may occur.
 */
export interface AsyncChunkOpt<T, E extends Error> {
  /**
   * The initial data to be set in the chunk.
   * Defaults to `null` if not provided.
   */
  initialData?: T | null;

  /**
   * A callback function triggered when an error occurs.
   * Receives the error as an argument.
   */
  onError?: (error: E) => void;

  /**
   * The number of times to retry a failed asynchronous operation.
   * Defaults to `0` if not provided.
   */
  retryCount?: number;

  /**
   * The delay (in milliseconds) between retry attempts.
   * Defaults to `0` if not provided.
   */
  retryDelay?: number;
};

/**
 * Creates an async chunk that handles loading, error, and retry logic.
 * @param fetcher The async function to fetch data.
 * @param options Configuration options for the async chunk.
 * @returns An async chunk instance.
 */
export function asyncChunk<T, E extends Error = Error>(fetcher: () => Promise<T>, options: AsyncChunkOpt<T, E> = {}): AsyncChunk<T, E> {
  const {
    initialData = null,
    onError,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  const initialState: AsyncState<T, E> = {
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

      baseChunk.set({ loading: false, error: error as E, data: baseChunk.get().data });

      if (onError) {
        onError(error as E);
      }

    }
  }

  fetchData();

  const asyncChunkInstance: AsyncChunk<T, E> = {
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
