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
  /** Refetch when window regains focus (default: false) */
  refetchOnWindowFocus?: boolean;
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
  /** Enable/disable the fetcher. Accepts a boolean or a function for dynamic evaluation. */
  enabled?: boolean | (() => boolean);
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
  /** Safe cleanup — only tears down if no active subscribers remain */
  cleanup: () => void;
  /** Force cleanup regardless of subscriber count */
  forceCleanup: () => void;
  /** Clear all current params and refetch */
  clearParams: () => void;
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
    enabled: enabledOption = true,
  } = options;

  const {
    staleTime = 0,
    cacheTime = 5 * 60 * 1000,
    refetchInterval,
    refetchOnWindowFocus = false,
  } = refreshConfig;

  // enabled can be a static boolean or a dynamic function
  const isEnabled = () =>
    typeof enabledOption === 'function'
      ? (enabledOption as () => boolean)()
      : enabledOption;

  const isPaginated = !!paginationConfig;
  const paginationMode = paginationConfig?.mode || 'replace';
  const expectsParams = fetcher.length > 0;

  const initialState: AsyncStateWithPagination<T, E> = {
    loading: isEnabled() && !expectsParams,
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
  let windowFocusHandler: (() => void) | null = null;
  let subscriberCount = 0;

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

  const teardownSideEffects = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (cacheTimeoutId) {
      clearTimeout(cacheTimeoutId);
      cacheTimeoutId = null;
    }
    if (windowFocusHandler && typeof window !== 'undefined') {
      window.removeEventListener('focus', windowFocusHandler);
      windowFocusHandler = null;
    }
  };

  // Single source of truth for all side effect setup
  const setupSideEffects = () => {
    if (!isEnabled()) return;

    if (refetchInterval && refetchInterval > 0) {
      intervalId = setInterval(() => {
        fetchData(undefined, 0, false);
      }, refetchInterval) as unknown as number;
    }

    if (refetchOnWindowFocus && typeof window !== 'undefined') {
      windowFocusHandler = () => {
        if (isStale()) fetchData(undefined, 0, false);
      };
      window.addEventListener('focus', windowFocusHandler);
    }
  };

  const fetchData = async (params?: Partial<P>, retries = retryCount, force = false): Promise<void> => {
    if (!isEnabled()) return;

    if (params !== undefined) {
      currentParams = { ...currentParams, ...params };
    }

    if (!force && !isStale() && baseChunk.get().data !== null) {
      return;
    }

    const state = baseChunk.get();
    baseChunk.set({ ...state, loading: true, error: null });

    try {
      let fetchParams: any = { ...currentParams };

      if (isPaginated && state.pagination) {
        fetchParams.page = state.pagination.page;
        fetchParams.pageSize = state.pagination.pageSize;
      }

      const result = expectsParams
        ? await fetcher(fetchParams)
        : await (fetcher as () => Promise<T | FetcherResponse<T>>)();

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

      // Re-read state after await — state may have changed while fetching
      const freshState = baseChunk.get();

      if (isPaginated && paginationMode === 'accumulate' && freshState.data && Array.isArray(freshState.data) && Array.isArray(data)) {
        data = [...freshState.data, ...data] as T;
      }

      baseChunk.set({
        loading: false,
        error: null,
        data,
        lastFetched: Date.now(),
        pagination: isPaginated ? {
          ...freshState.pagination!,
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

      const currentState = baseChunk.get();
      baseChunk.set({
        loading: false,
        error: error as E,
        data: currentState.data,
        lastFetched: currentState.lastFetched,
        pagination: currentState.pagination,
      });

      if (onError) onError(error as E);
    }
  };

  // Initialize side effects and initial fetch
  setupSideEffects();
  if (isEnabled() && !expectsParams) {
    fetchData();
  }

  const baseInstance = {
    ...baseChunk,

    // Ref-counted subscribe — tracks how many active subscribers exist
    subscribe: (callback: (state: AsyncStateWithPagination<T, E>) => void) => {
      subscriberCount++;
      const unsubscribe = baseChunk.subscribe(callback);
      return () => {
        unsubscribe();
        subscriberCount--;
      };
    },

    reload: async (params?: Partial<P>) => {
      await fetchData(params, retryCount, true);
    },

    refresh: async (params?: Partial<P>) => {
      await fetchData(params, retryCount, false);
    },

    mutate: (mutator: (currentData: T | null) => T) => {
      const state = baseChunk.get();
      baseChunk.set({ ...state, data: mutator(state.data) });
    },

    reset: () => {
      teardownSideEffects();
      currentParams = {};
      baseChunk.set({
        ...initialState,
        loading: isEnabled() && !expectsParams,
      });
      setupSideEffects();
      if (isEnabled() && !expectsParams) {
        fetchData();
      }
    },

    // Safe cleanup — only tears down side effects if no active subscribers remain
    cleanup: () => {
      if (subscriberCount <= 0) {
        teardownSideEffects();
      }
    },

    // Force cleanup regardless of subscriber count — use for destroy scenarios
    forceCleanup: () => {
      teardownSideEffects();
    },

    setParams: (params: Partial<Record<keyof P, P[keyof P] | null>>) => {
      const next = { ...currentParams };
      for (const key in params) {
        if (params[key] === null) {
          delete next[key];
        } else {
          (next as any)[key] = params[key];
        }
      }
      currentParams = next;
      if (isEnabled()) {
        fetchData(currentParams as Partial<P>, retryCount, true);
      }
    },

    clearParams: () => {
      currentParams = {};
      if (isEnabled()) {
        fetchData(undefined, retryCount, true);
      }
    },
  };

  if (isPaginated) {
    return {
      ...baseInstance,

      nextPage: async () => {
        const state = baseChunk.get();
        if (!state.pagination) return;
        if (state.pagination.hasMore === false) return;
        baseChunk.set({
          ...state,
          pagination: { ...state.pagination, page: state.pagination.page + 1 }
        });
        await fetchData(currentParams, retryCount, true);
      },

      prevPage: async () => {
        const state = baseChunk.get();
        if (!state.pagination || state.pagination.page <= 1) return;
        baseChunk.set({
          ...state,
          pagination: { ...state.pagination, page: state.pagination.page - 1 }
        });
        await fetchData(currentParams, retryCount, true);
      },

      goToPage: async (page: number) => {
        const state = baseChunk.get();
        if (!state.pagination || page < 1) return;
        baseChunk.set({
          ...state,
          pagination: { ...state.pagination, page }
        });
        await fetchData(currentParams, retryCount, true);
      },

      resetPagination: async () => {
        const state = baseChunk.get();
        if (!state.pagination) return;
        baseChunk.set({
          ...state,
          data: paginationMode === 'accumulate' ? initialData : state.data,
          pagination: { ...state.pagination, page: paginationConfig?.initialPage || 1 }
        });
        await fetchData(currentParams, retryCount, true);
      },
    } as PaginatedAsyncChunk<T, E>;
  }

  return baseInstance;
}
