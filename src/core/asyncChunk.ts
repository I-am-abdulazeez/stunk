import { chunk, Chunk } from "./core";
import { AsyncChunkOpt } from "./types";

export interface AsyncState<T, E extends Error> {
  loading: boolean;
  error: E | null;
  data: T | null;
  lastFetched?: number;
}

export interface RefreshConfig {
  /** Time in milliseconds after which data becomes stale */
  staleTime?: number;
  /** Time in milliseconds to cache data before considering it expired */
  cacheTime?: number;
  /** Auto-refresh interval in milliseconds */
  refetchInterval?: number;
}

// Extend existing options without breaking changes
export interface AsyncChunkOptExtended<T, E extends Error> extends AsyncChunkOpt<T, E> {
  refresh?: RefreshConfig;
  /** Enable/disable the fetcher - useful for conditional fetching */
  enabled?: boolean;
}

export interface AsyncChunk<T, E extends Error = Error> extends Chunk<AsyncState<T, E>> {
  /** Reload the data from the source. */
  reload: () => Promise<void>;

  /** Smart refresh - respects stale time */
  refresh: () => Promise<void>;

  /** Mutate the data directly. */
  mutate: (mutator: (currentData: T | null) => T) => void;

  /** Reset the state to the initial value. */
  reset: () => void;

  /** Clean up intervals and timeouts */
  cleanup: () => void;
}

// Overloaded function signatures for backward compatibility
export function asyncChunk<T, E extends Error = Error>(
  fetcher: () => Promise<T>,
  options?: AsyncChunkOptExtended<T, E>
): AsyncChunk<T, E>;

export function asyncChunk<T, E extends Error = Error, P extends any[] = []>(
  fetcher: (...params: P) => Promise<T>,
  options?: AsyncChunkOptExtended<T, E>
): AsyncChunk<T, E> & {
  /** Reload with new parameters */
  reload: (...params: P) => Promise<void>;
  /** Smart refresh with parameters */
  refresh: (...params: P) => Promise<void>;
  /** Set parameters for future calls */
  setParams: (...params: P) => void;
};

export function asyncChunk<T, E extends Error = Error, P extends any[] = []>(
  fetcher: (...params: P) => Promise<T>,
  options: AsyncChunkOptExtended<T, E> = {}
) {
  const {
    initialData = null,
    onError,
    retryCount = 0,
    retryDelay = 1000,
    refresh: refreshConfig = {},
    enabled = true,
  } = options;

  const { staleTime = 0, cacheTime = 5 * 60 * 1000, refetchInterval } = refreshConfig;

  // let's expect params
  const expectsParams = fetcher.length > 0;

  const initialState: AsyncState<T, E> = {
    loading: enabled && !expectsParams,
    error: null,
    data: initialData,
    lastFetched: undefined,
  };

  const hasValidParams = (params?: P): boolean => {
    if (!expectsParams) return true;

    if (params === undefined) return false;
    if (Array.isArray(params)) {
      return params.every(p => p !== undefined && p !== null);
    }
    return true;
  };

  const baseChunk = chunk(initialState);
  let currentParams: P | undefined;
  let intervalId: number | null = null;
  let cacheTimeoutId: number | null = null;

  const isStale = () => {
    const state = baseChunk.get();
    if (!state.lastFetched) return true;
    return Date.now() - state.lastFetched > staleTime;
  };

  const isCacheExpired = () => {
    const state = baseChunk.get();
    if (!state.lastFetched) return true;
    return Date.now() - state.lastFetched > cacheTime;
  };

  const clearCache = () => {
    baseChunk.set({
      ...baseChunk.get(),
      data: initialData,
      lastFetched: undefined,
    });
  };

  const setCacheTimeout = () => {
    if (cacheTimeoutId) {
      clearTimeout(cacheTimeoutId);
    }
    if (cacheTime > 0) {
      cacheTimeoutId = setTimeout(clearCache, cacheTime);
    }
  };

  const fetchData = async (params?: P, retries = retryCount, force = false): Promise<void> => {
    if (!enabled) return;

    // Store params for reuse
    if (params !== undefined) {
      currentParams = params;
    }

    // Don't fetch if we don't have valid parameters
    if (!hasValidParams(currentParams)) {
      baseChunk.set({ ...baseChunk.get(), loading: false });
      return;
    }

    // Don't fetch if data is fresh and not forcing
    if (!force && !isStale() && baseChunk.get().data !== null && staleTime > 0) {
      return;
    }

    baseChunk.set({ ...baseChunk.get(), loading: true, error: null });

    try {
      let data: T;

      if (expectsParams) {
        // Safe guard - we know currentParams is valid from hasValidParams check
        if (!currentParams) {
          throw new Error('Parameters required but not provided');
        }
        data = await fetcher(...currentParams);
      } else {
        // Safe guard - we know fetcher is a function that returns a Promise<T>
        data = await (fetcher as () => Promise<T>)();
      }

      const now = Date.now();

      baseChunk.set({
        loading: false,
        error: null,
        data,
        lastFetched: now
      });

      setCacheTimeout();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchData(params, retries - 1, force);
      }

      baseChunk.set({
        loading: false,
        error: error as E,
        data: baseChunk.get().data,
        lastFetched: baseChunk.get().lastFetched
      });

      if (onError) {
        onError(error as E);
      }
    }
  };

  // Setup auto-refresh
  if (refetchInterval && refetchInterval > 0 && enabled) {
    intervalId = setInterval(() => {
      if (enabled) {
        fetchData(currentParams, 0, false);
      }
    }, refetchInterval);
  }

  // Initial fetch
  if (enabled && !expectsParams) {
    fetchData();
  }

  const cleanup = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (cacheTimeoutId) {
      clearTimeout(cacheTimeoutId);
      cacheTimeoutId = null;
    }
  };

  const asyncChunkInstance = {
    ...baseChunk,

    reload: async (...params: P) => {
      await fetchData(params.length > 0 ? params : undefined, retryCount, true);
    },

    refresh: async (...params: P) => {
      await fetchData(params.length > 0 ? params : undefined, retryCount, false);
    },

    mutate: (mutator: (currentData: T | null) => T) => {
      const currentState = baseChunk.get();
      const newData = mutator(currentState.data);
      baseChunk.set({ ...currentState, data: newData });
    },

    reset: () => {
      cleanup();
      baseChunk.set({
        ...initialState,
        loading: enabled
      });
      if (enabled) {
        fetchData();

        if (refetchInterval && refetchInterval > 0) {
          intervalId = setInterval(() => {
            if (enabled) {
              fetchData(currentParams, 0, false);
            }
          }, refetchInterval);
        }
      }
    },

    cleanup,

    // Only add setParams if parameters were used
    setParams: (...params: P) => {
      currentParams = params;
      if (enabled && hasValidParams(params)) {
        fetchData(params);
      }
    },

  };

  return asyncChunkInstance;
}
