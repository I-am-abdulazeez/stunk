import { chunk, Chunk } from "../core/core";
import { AsyncChunkOpt } from "../core/types";

export interface AsyncState<T, E extends Error> {
  loading: boolean;
  error: E | null;
  data: T | null;
  lastFetched?: number;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total?: number;
  hasMore?: boolean;
}

export interface AsyncStateWithPagination<T, E extends Error> extends AsyncState<T, E> {
  pagination?: PaginationState;
}

export interface RefreshConfig {
  /** Time in ms after which data becomes stale */
  staleTime?: number;
  /** Time in ms to cache data */
  cacheTime?: number;
  /** Auto-refresh interval in ms */
  refetchInterval?: number;
}

export interface PaginationConfig {
  /** Initial page number (default: 1) */
  initialPage?: number;
  /** Items per page (default: 10) */
  pageSize?: number;
  /** Whether to accumulate pages (infinite scroll) or replace */
  mode?: 'replace' | 'accumulate';
}

export interface AsyncChunkOptExtended<T, E extends Error> extends AsyncChunkOpt<T, E> {
  refresh?: RefreshConfig;
  pagination?: PaginationConfig;
  /** Enable/disable the fetcher */
  enabled?: boolean;
}

export interface FetcherResponse<T> {
  data: T;
  total?: number;
  hasMore?: boolean;
}

export interface AsyncChunk<T, E extends Error = Error> extends Chunk<AsyncStateWithPagination<T, E>> {
  /** Force reload data */
  reload: (params?: any) => Promise<void>;
  /** Smart refresh - respects stale time */
  refresh: (params?: any) => Promise<void>;
  /** Mutate data directly */
  mutate: (mutator: (currentData: T | null) => T) => void;
  /** Reset to initial state */
  reset: () => void;
  /** Clean up intervals */
  cleanup: () => void;
}

export interface PaginatedAsyncChunk<T, E extends Error = Error> extends AsyncChunk<T, E> {
  /** Load next page */
  nextPage: () => Promise<void>;
  /** Load previous page */
  prevPage: () => Promise<void>;
  /** Go to specific page */
  goToPage: (page: number) => Promise<void>;
  /** Reset pagination to first page */
  resetPagination: () => Promise<void>;
}

// Overloaded signatures
export function asyncChunk<T, E extends Error = Error>(
  fetcher: () => Promise<T | FetcherResponse<T>>,
  options?: AsyncChunkOptExtended<T, E>
): AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>;

export function asyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  fetcher: (params: P & { page?: number; pageSize?: number }) => Promise<T | FetcherResponse<T>>,
  options?: AsyncChunkOptExtended<T, E>
): (AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>) & {
  setParams: (params: Partial<P>) => void;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
};

export function asyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  fetcher: (params?: P & { page?: number; pageSize?: number }) => Promise<T | FetcherResponse<T>>,
  options: AsyncChunkOptExtended<T, E> = {}
) {
  const {
    initialData = null,
    onError,
    retryCount = 0,
    retryDelay = 1000,
    refresh: refreshConfig = {},
    pagination: paginationConfig,
    enabled = true,
  } = options;

  const { staleTime = 0, cacheTime = 5 * 60 * 1000, refetchInterval } = refreshConfig;
  const isPaginated = !!paginationConfig;
  const paginationMode = paginationConfig?.mode || 'replace';

  const expectsParams = fetcher.length > 0;

  const initialState: AsyncStateWithPagination<T, E> = {
    loading: enabled && !expectsParams,
    error: null,
    data: initialData,
    lastFetched: undefined,
    pagination: isPaginated ? {
      page: paginationConfig.initialPage || 1,
      pageSize: paginationConfig.pageSize || 10,
    } : undefined,
  };

  const baseChunk = chunk(initialState);
  let currentParams: Partial<P> = {};
  let intervalId: number | null = null;
  let cacheTimeoutId: number | null = null;

  const isStale = () => {
    const state = baseChunk.get();
    if (!state.lastFetched || staleTime === 0) return true;
    return Date.now() - state.lastFetched > staleTime;
  };

  const clearCache = () => {
    baseChunk.set({
      ...baseChunk.get(),
      data: initialData,
      lastFetched: undefined,
    });
  };

  const setCacheTimeout = () => {
    if (cacheTimeoutId) clearTimeout(cacheTimeoutId);
    if (cacheTime > 0) {
      cacheTimeoutId = setTimeout(clearCache, cacheTime);
    }
  };

  const fetchData = async (params?: Partial<P>, retries = retryCount, force = false): Promise<void> => {
    if (!enabled) return;

    // Update params if provided
    if (params !== undefined) {
      currentParams = { ...currentParams, ...params };
    }

    // Check staleness
    if (!force && !isStale() && baseChunk.get().data !== null) {
      return;
    }

    const state = baseChunk.get();
    baseChunk.set({ ...state, loading: true, error: null });

    try {
      let fetchParams: any = { ...currentParams };

      // Add pagination params if enabled
      if (isPaginated && state.pagination) {
        fetchParams.page = state.pagination.page;
        fetchParams.pageSize = state.pagination.pageSize;
      }

      const result = expectsParams
        ? await fetcher(fetchParams)
        : await (fetcher as () => Promise<T | FetcherResponse<T>>)();

      // Handle response format
      let data: T;
      let total: number | undefined;
      let hasMore: boolean | undefined;

      if (result && typeof result === 'object' && 'data' in result) {
        const response = result as FetcherResponse<T>;
        data = response.data;
        total = response.total;
        hasMore = response.hasMore;
      } else {
        data = result as T;
      }

      // Handle pagination accumulation
      if (isPaginated && paginationMode === 'accumulate' && state.data && Array.isArray(state.data) && Array.isArray(data)) {
        data = [...state.data, ...data] as T;
      }

      const now = Date.now();
      baseChunk.set({
        loading: false,
        error: null,
        data,
        lastFetched: now,
        pagination: isPaginated ? {
          ...state.pagination!,
          total,
          hasMore,
        } : undefined,
      });

      setCacheTimeout();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchData(params, retries - 1, force);
      }

      const state = baseChunk.get();
      baseChunk.set({
        loading: false,
        error: error as E,
        data: state.data,
        lastFetched: state.lastFetched,
        pagination: state.pagination,
      });

      if (onError) onError(error as E);
    }
  };

  // Auto-refresh setup
  if (refetchInterval && refetchInterval > 0 && enabled) {
    intervalId = setInterval(() => {
      if (enabled) fetchData(undefined, 0, false);
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

  const baseInstance = {
    ...baseChunk,

    reload: async (params?: Partial<P>) => {
      await fetchData(params, retryCount, true);
    },

    refresh: async (params?: Partial<P>) => {
      await fetchData(params, retryCount, false);
    },

    mutate: (mutator: (currentData: T | null) => T) => {
      const state = baseChunk.get();
      const newData = mutator(state.data);
      baseChunk.set({ ...state, data: newData });
    },

    reset: () => {
      cleanup();
      currentParams = {};
      baseChunk.set({
        ...initialState,
        loading: enabled && !expectsParams
      });
      if (enabled && !expectsParams) {
        fetchData();
        if (refetchInterval && refetchInterval > 0) {
          intervalId = setInterval(() => {
            if (enabled) fetchData(undefined, 0, false);
          }, refetchInterval);
        }
      }
    },

    cleanup,

    setParams: (params: Partial<P>) => {
      currentParams = { ...currentParams, ...params };
      if (enabled) {
        fetchData(params, retryCount, true); // Fetch immediately with new params
      }
    },
  };

  // Add pagination methods if enabled
  if (isPaginated) {
    return {
      ...baseInstance,

      nextPage: async () => {
        const state = baseChunk.get();
        if (!state.pagination) return;

        if (state.pagination.hasMore === false) return;

        baseChunk.set({
          ...state,
          pagination: {
            ...state.pagination,
            page: state.pagination.page + 1,
          }
        });
        await fetchData(currentParams, retryCount, true);
      },

      prevPage: async () => {
        const state = baseChunk.get();
        if (!state.pagination || state.pagination.page <= 1) return;

        baseChunk.set({
          ...state,
          pagination: {
            ...state.pagination,
            page: state.pagination.page - 1,
          }
        });
        await fetchData(currentParams, retryCount, true);
      },

      goToPage: async (page: number) => {
        const state = baseChunk.get();
        if (!state.pagination || page < 1) return;

        baseChunk.set({
          ...state,
          pagination: {
            ...state.pagination,
            page,
          }
        });
        await fetchData(currentParams, retryCount, true);
      },

      resetPagination: async () => {
        const state = baseChunk.get();
        if (!state.pagination) return;

        const initialPage = paginationConfig?.initialPage || 1;
        baseChunk.set({
          ...state,
          data: paginationMode === 'accumulate' ? initialData : state.data,
          pagination: {
            ...state.pagination,
            page: initialPage,
          }
        });
        await fetchData(currentParams, retryCount, true);
      },
    } as PaginatedAsyncChunk<T, E>;
  }

  return baseInstance;
}
