import { chunk, Chunk } from "../core/core";
import { getGlobalQueryConfig } from "./configure-query";

// Global registry for in-flight request deduplication
const inFlightRequests = new Map<string, Promise<void>>();
let chunkCounter = 0;

export interface AsyncState<T, E extends Error> {
  loading: boolean;
  error: E | null;
  data: T | null;
  lastFetched?: number;
  /** True when showing previous data while new data is loading (keepPreviousData: true) */
  isPlaceholderData?: boolean;
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

export interface FetcherResponse<T> {
  data: T;
  total?: number;
  hasMore?: boolean;
}

export interface AsyncChunkOptions<T, E extends Error = Error> {
  /** Deduplication key — concurrent calls with the same key share one in-flight request */
  key?: string;

  /** Seed data shown before the first fetch completes */
  initialData?: T | null;
  /** Disable fetching until ready — pass a function for dynamic evaluation */
  enabled?: boolean | (() => boolean);

  /** Called after every successful fetch */
  onSuccess?: (data: T) => void;
  /** Called when all retries are exhausted */
  onError?: (error: E) => void;

  /** Number of retries on failure (default: 0) */
  retryCount?: number;
  /** Delay in ms between retries (default: 1000) */
  retryDelay?: number;

  /** Show previous data while refetching — prevents UI flicker on param changes (default: false) */
  keepPreviousData?: boolean;

  /** Time in ms before data is considered stale (default: 0) */
  staleTime?: number;
  /** Time in ms to cache data after last subscriber leaves (default: 300_000) */
  cacheTime?: number;
  /** Auto-refetch interval in ms */
  refetchInterval?: number;
  /** Refetch when window regains focus (default: false) */
  refetchOnWindowFocus?: boolean;

  pagination?: {
    /** Initial page number (default: 1) */
    initialPage?: number;
    /** Items per page (default: 10) */
    pageSize?: number;
    /** Replace data on each page load, or accumulate for infinite scroll (default: 'replace') */
    mode?: 'replace' | 'accumulate';
  };
}

export interface AsyncChunk<T, E extends Error = Error> extends Chunk<AsyncStateWithPagination<T, E>> {
  /** Force a fresh fetch, ignoring stale time */
  reload: (params?: any) => Promise<void>;
  /** Fetch only if data is stale — respects staleTime */
  refresh: (params?: any) => Promise<void>;
  /** Update data directly without a network request */
  mutate: (mutator: (currentData: T | null) => T) => void;
  /** Reset to initial state and re-fetch */
  reset: () => void;
  /** Safe cleanup — only tears down if no active subscribers remain */
  cleanup: () => void;
  /** Force cleanup regardless of subscriber count */
  forceCleanup: () => void;
  /** Clear all current params and refetch */
  clearParams: () => void;
}

export interface PaginatedAsyncChunk<T, E extends Error = Error> extends AsyncChunk<T, E> {
  /** Load the next page */
  nextPage: () => Promise<void>;
  /** Load the previous page */
  prevPage: () => Promise<void>;
  /** Jump to a specific page */
  goToPage: (page: number) => Promise<void>;
  /** Reset pagination to page 1 and re-fetch */
  resetPagination: () => Promise<void>;
}

// Overloaded signatures
export function asyncChunk<T, E extends Error = Error>(
  fetcher: () => Promise<T | FetcherResponse<T>>,
  options?: AsyncChunkOptions<T, E>
): AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>;

export function asyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  fetcher: (params: P & { page?: number; pageSize?: number }) => Promise<T | FetcherResponse<T>>,
  options?: AsyncChunkOptions<T, E>
): (AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>) & {
  setParams: (params: Partial<P>) => void;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
};


/**
 * Creates a reactive async state unit for data fetching.
 *
 * Tracks `loading`, `error`, `data`, and `lastFetched`. Fetchers with no
 * parameters auto-fetch on creation. Fetchers with parameters wait for
 * `setParams()` or `reload()`.
 *
 * @param fetcher - Async function returning data or a `FetcherResponse`.
 * @param options.key - Deduplication key — concurrent calls share one request.
 * @param options.enabled - Prevent fetching until ready (boolean or function).
 * @param options.keepPreviousData - Show previous data while refetching.
 * @param options.onSuccess - Called after every successful fetch.
 * @param options.onError - Called when all retries are exhausted.
 * @param options.staleTime - Time in ms before data is considered stale.
 * @param options.refetchInterval - Auto-refetch interval in ms.
 * @param options.refetchOnWindowFocus - Refetch when window regains focus.
 * @param options.pagination - Enable pagination (`mode: 'replace' | 'accumulate'`).
 *
 * @example
 * const users = asyncChunk(() => fetchUsers());
 *
 * const user = asyncChunk(({ id }: { id: number }) => fetchUser(id));
 * user.setParams({ id: 1 });
 */
export function asyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  fetcher: (params?: P & { page?: number; pageSize?: number }) => Promise<T | FetcherResponse<T>>,
  options: AsyncChunkOptions<T, E> = {}
) {
  // Merge global defaults — per-chunk options always win
  const globalQuery = getGlobalQueryConfig().query ?? {};

  const {
    key,
    initialData = null,
    enabled: enabledOption = true,
    onSuccess = globalQuery.onSuccess as ((data: T) => void) | undefined,
    onError = globalQuery.onError as ((error: E) => void) | undefined,
    retryCount = globalQuery.retryCount ?? 0,
    retryDelay = globalQuery.retryDelay ?? 1000,
    keepPreviousData = false,
    staleTime = globalQuery.staleTime ?? 0,
    cacheTime = globalQuery.cacheTime ?? 5 * 60 * 1000,
    refetchInterval = globalQuery.refetchInterval,
    refetchOnWindowFocus = globalQuery.refetchOnWindowFocus ?? false,
    pagination: paginationConfig,
  } = options;

  const chunkKey = key ?? `async_chunk_${chunkCounter++}`;

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
    isPlaceholderData: false,
    pagination: isPaginated ? {
      page: paginationConfig.initialPage || 1,
      pageSize: paginationConfig.pageSize || 10,
      total: undefined,
      hasMore: undefined,
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
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    if (cacheTimeoutId) { clearTimeout(cacheTimeoutId); cacheTimeoutId = null; }
    if (windowFocusHandler && typeof window !== 'undefined') {
      window.removeEventListener('focus', windowFocusHandler);
      windowFocusHandler = null;
    }
  };

  const setupSideEffects = () => {
    if (!isEnabled()) return;
    if (typeof window === 'undefined') return;

    if (refetchInterval && refetchInterval > 0) {
      intervalId = setInterval(() => {
        fetchData(undefined, 0, false);
      }, refetchInterval) as unknown as number;
    }

    if (refetchOnWindowFocus) {
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

    if (!force && !isStale() && baseChunk.get().data !== null) return;

    if (inFlightRequests.has(chunkKey)) {
      return inFlightRequests.get(chunkKey)!;
    }

    const state = baseChunk.get();

    baseChunk.set({
      ...state,
      loading: true,
      error: null,
      data: state.data,
      isPlaceholderData: keepPreviousData && state.data !== null,
    });

    const request = (async () => {
      try {
        let fetchParams: any = { ...currentParams };

        if (isPaginated) {
          const currentPagination = baseChunk.get().pagination;
          if (currentPagination) {
            fetchParams.page = currentPagination.page;
            fetchParams.pageSize = currentPagination.pageSize;
          }
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

        const freshState = baseChunk.get();

        if (
          isPaginated &&
          paginationMode === 'accumulate' &&
          freshState.data &&
          Array.isArray(freshState.data) &&
          Array.isArray(data)
        ) {
          data = [...(freshState.data as any[]), ...data] as T;
        }

        baseChunk.set({
          loading: false,
          error: null,
          data,
          lastFetched: Date.now(),
          isPlaceholderData: false,
          pagination: isPaginated ? {
            ...freshState.pagination!,
            total,
            hasMore,
          } : undefined,
        });

        setCacheTimeout();
        if (onSuccess) onSuccess(data);
      } catch (error) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          // Remove in-flight entry so retry can register a new one
          inFlightRequests.delete(chunkKey);
          return fetchData(params, retries - 1, force);
        }

        const currentState = baseChunk.get();
        baseChunk.set({
          loading: false,
          error: error as E,
          data: currentState.data,
          lastFetched: currentState.lastFetched,
          isPlaceholderData: false,
          pagination: currentState.pagination,
        });

        if (onError) onError(error as E);
      } finally {
        inFlightRequests.delete(chunkKey);
      }
    })();

    inFlightRequests.set(chunkKey, request);
    return request;
  };

  // Initialize side effects and initial fetch
  setupSideEffects();
  if (isEnabled() && !expectsParams) fetchData();

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
      baseChunk.set({ ...initialState, loading: isEnabled() && !expectsParams });
      setupSideEffects();
      if (isEnabled() && !expectsParams) fetchData();
    },

    // Safe cleanup — only tears down side effects if no active subscribers remain
    cleanup: () => {
      if (subscriberCount <= 0) teardownSideEffects();
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
      if (isEnabled()) fetchData(currentParams as Partial<P>, retryCount, true);
    },

    clearParams: () => {
      currentParams = {};
      if (isEnabled()) fetchData(undefined, retryCount, true);
    },
  };

  if (isPaginated) {
    return {
      ...baseInstance,

      nextPage: async () => {
        const state = baseChunk.get();
        if (!state.pagination || state.pagination.hasMore === false) return;
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
