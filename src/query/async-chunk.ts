import { chunk, Chunk, trackDependencies } from "../core/core";
import { getGlobalQueryConfig } from "./configure-query";

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
  /** Current cursor — only populated when using cursor-based pagination */
  cursor?: string;
}

export interface AsyncStateWithPagination<T, E extends Error> extends AsyncState<T, E> {
  pagination?: PaginationState;
}

export interface ParamAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>
  extends AsyncChunk<T, E> {
  setParams: (params: Partial<Record<keyof P, P[keyof P] | null>>) => void;
  clearParams: () => void;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
}

export interface PaginatedParamAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>
  extends PaginatedAsyncChunk<T, E> {
  setParams: (params: Partial<Record<keyof P, P[keyof P] | null>>) => void;
  clearParams: () => void;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
}

export interface FetcherResponse<T> {
  data: T;
  total?: number;
  hasMore?: boolean;
  /** Next cursor — only used when `pagination.cursorMode` is configured */
  cursor?: string;
}

export interface CursorModeConfig<T> {
  /**
   * Extracts the next cursor from a fetch response. Return `undefined`
   * when there are no more pages.
   */
  getNextCursor: (response: FetcherResponse<T>) => string | undefined;
}

export interface AsyncChunkOptions<T, E extends Error = Error, P extends Record<string, any> = {}> {
  /** Deduplication key — concurrent calls with the same key share one in-flight request */
  key?: string;

  /** Seed data shown before the first fetch completes */
  initialData?: T | null;
  /** Disable fetching until ready — pass a function for dynamic evaluation */
  enabled?: boolean | ((params: Partial<P>) => boolean);

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

  /**
   * Clear data to null immediately when params change via setParams(), before
   * the new fetch resolves. Eliminates stale data flash when navigating between
   * detail views that share a single chunk. (default: false)
   *
   * @example
   * // jobDetailChunk will show null (loading state) immediately when ref changes,
   * // instead of showing the previous job's data while the new one loads.
   * export const jobDetailChunk = asyncChunk(
   *   (params: { ref: string }) => jobsApi.getJobDetail(params.ref),
   *   { staleTime: 0, clearOnParamChange: true }
   * );
   */
  clearOnParamChange?: boolean;

  /** Time in ms before data is considered stale (default: 0) */
  staleTime?: number;
  /** Time in ms to cache data after last subscriber leaves (default: 300_000) */
  cacheTime?: number;
  /** Auto-refetch interval in ms */
  refetchInterval?: number;
  /** Refetch when window regains focus (default: false) */
  refetchOnWindowFocus?: boolean;

  /**
  * When true, useAsyncChunk gives each calling component its own
  * independent instance of this chunk instead of sharing the module-level
  * singleton. Use for parameterized/filtered data (paginated lists, search
  * results) where multiple simultaneous consumers must not share state.
  * Leave false (default) for true app-wide singletons (current user,
  * wallet balance, notification list) that must stay in sync everywhere.
  * (default: false)
  */
  scoped?: boolean;

  pagination?: {
    /** Initial page number (default: 1) */
    initialPage?: number;
    /** Items per page (default: 10) */
    pageSize?: number;
    /** Replace data on each page load, or accumulate for infinite scroll (default: 'replace') */
    mode?: 'replace' | 'accumulate';
    /**
     * Switches the chunk to cursor-based pagination. When set, `page` is
     * ignored — the chunk tracks an opaque `cursor` string supplied by
     * your fetcher's response instead of an incrementing page number.
     */
    cursorMode?: CursorModeConfig<T>;
  };
}

export interface AsyncChunk<T, E extends Error = Error> extends Chunk<AsyncStateWithPagination<T, E>> {
  /** Force a fresh fetch, ignoring stale time */
  reload: (params?: any) => Promise<void>;
  /** Fetch only if data is stale — respects staleTime */
  refresh: (params?: any) => Promise<void>;
  /** Update data directly without a network request */
  mutate: (mutator: (currentData: T | null) => T | null) => void;
  /** Reset to initial state and re-fetch */
  reset: (refetch?: boolean) => void;
  /** Safe cleanup — only tears down if no active subscribers remain */
  cleanup: () => void;
  /** Force cleanup regardless of subscriber count */
  forceCleanup: () => void;
  /** Clear all current params and refetch */
  clearParams: () => void;
  /** Cancel any in-flight request and set loading to false */
  cancel: () => void;
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


/**
 * Internal factory — shared logic for both `asyncChunk` and `paginatedAsyncChunk`.
 * Not exported; callers use the two public functions below for unambiguous types.
 */
function createAsyncChunkInternal<T, E extends Error = Error, P extends Record<string, any> = {}>(
  fetcher: (() => Promise<T | FetcherResponse<T>>) | ((params: P) => Promise<T | FetcherResponse<T>>),
  options: AsyncChunkOptions<T, E, P> = {}
): AsyncChunk<T, E> | PaginatedAsyncChunk<T, E> {
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
    clearOnParamChange = false,
    staleTime = globalQuery.staleTime ?? 0,
    cacheTime = globalQuery.cacheTime ?? 5 * 60 * 1000,
    refetchInterval = globalQuery.refetchInterval,
    refetchOnWindowFocus = globalQuery.refetchOnWindowFocus ?? false,
    pagination: paginationConfig,
    scoped = false,
  } = options as AsyncChunkOptions<T, E, P> & { scoped?: boolean };

  let currentParams: Partial<P> = {};
  const chunkKey = key ?? `async_chunk_${chunkCounter++}`;

  const isEnabled = (): boolean => {
    if (typeof enabledOption === 'function') {
      return (enabledOption as (params: Partial<P>) => boolean)(currentParams as Partial<P>);
    }
    return enabledOption ?? true;
  };

  const isPaginated = !!paginationConfig;
  const paginationMode = paginationConfig?.mode || 'replace';
  const isCursorMode = !!paginationConfig?.cursorMode;
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
      cursor: undefined,
    } : undefined,
  };

  const baseChunk = chunk(initialState);
  let intervalId: number | null = null;
  let cacheTimeoutId: number | null = null;
  let windowFocusHandler: (() => void) | null = null;
  let subscriberCount = 0;
  let isNextPageFetch = false;
  let isCancelled = false;

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
      cacheTimeoutId = setTimeout(() => {
        if (subscriberCount <= 0) {
          clearCache();
        }
      }, cacheTime);
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

    if (refetchInterval && refetchInterval > 0 && !intervalId) {
      intervalId = setInterval(() => {
        fetchData(undefined, 0, false);
      }, refetchInterval) as unknown as number;
    }

    if (refetchOnWindowFocus && !windowFocusHandler) {
      windowFocusHandler = () => {
        if (isStale()) fetchData(undefined, 0, false);
      };
      window.addEventListener('focus', windowFocusHandler);
    }
  };

  // Paginated chunks include the target page (or cursor) in the key —
  // params alone would make a nextPage() fetch dedup onto the previous
  // page's still-registered request and silently skip the new page.
  const buildDedupKey = () => {
    const paramsKey = JSON.stringify(currentParams);
    if (!isPaginated) return `${chunkKey}:${paramsKey}`;
    const pagination = baseChunk.get().pagination;
    const pageKey = isCursorMode
      ? `cursor=${pagination?.cursor ?? ''}`
      : `page=${pagination?.page ?? 1}`;
    return `${chunkKey}:${paramsKey}:${pageKey}`;
  };

  const fetchData = async (params?: Partial<P>, retries = retryCount, force = false): Promise<void> => {
    if (!isEnabled()) return;

    if (params !== undefined) {
      currentParams = { ...currentParams, ...params };
    }

    if (!force && !isStale() && baseChunk.get().data !== null) return;

    const paramsKeyAtStart = JSON.stringify(currentParams);
    const dedupKey = buildDedupKey();

    if (inFlightRequests.has(dedupKey)) {
      return inFlightRequests.get(dedupKey)!;
    }

    const state = baseChunk.get();
    const previousData = state.data;

    // Capture at request start — nextPage() resets the flag after its await,
    // which races with a subsequent nextPage() issued from a microtask (e.g.
    // a framework scheduler reacting to this fetch landing). Reading the
    // closure flag at resolve time would see false and replace instead of
    // accumulate.
    const isNextPageRequest = isNextPageFetch;

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
            if (isCursorMode) {
              fetchParams.cursor = currentPagination.cursor;
              fetchParams.pageSize = currentPagination.pageSize;
            } else {
              fetchParams.page = currentPagination.page;
              fetchParams.pageSize = currentPagination.pageSize;
            }
          }
        }

        const result = expectsParams
          ? await fetcher(fetchParams)
          : await (fetcher as () => Promise<T | FetcherResponse<T>>)();

        if (JSON.stringify(currentParams) !== paramsKeyAtStart) {
          return;
        }

        if (isCancelled) {
          return;
        }

        let data: T;
        let total: number | undefined;
        let hasMore: boolean | undefined;
        let nextCursor: string | undefined;

        if (result && typeof result === 'object' && 'data' in result) {
          const response = result as FetcherResponse<T>;
          data = response.data;
          total = response.total;
          hasMore = response.hasMore;
          if (isCursorMode) {
            nextCursor = paginationConfig!.cursorMode!.getNextCursor(response);
          }
        } else {
          data = result as T;
        }

        const freshState = baseChunk.get();

        if (
          isPaginated &&
          paginationMode === 'accumulate' &&
          isNextPageRequest &&
          previousData &&
          Array.isArray(previousData) &&
          Array.isArray(data)
        ) {
          data = [...(previousData as any[]), ...data] as T;
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
            hasMore: isCursorMode ? (nextCursor !== undefined) : hasMore,
            cursor: isCursorMode ? nextCursor : freshState.pagination!.cursor,
          } : undefined,
        });

        setCacheTimeout();
        if (onSuccess) onSuccess(data);
      } catch (error) {
        if (JSON.stringify(currentParams) !== paramsKeyAtStart) {
          return;
        }
        if (retries > 0 && !(error as any)?.nonRetryable) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          inFlightRequests.delete(dedupKey);
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
        inFlightRequests.delete(dedupKey);
      }
    })();

    inFlightRequests.set(dedupKey, request);
    return request;
  };

  if (typeof enabledOption === 'function') {
    const [, enabledDeps] = trackDependencies(
      () => (enabledOption as (params: Partial<P>) => boolean)(currentParams as Partial<P>)
    );

    let previousEnabledState = isEnabled();

    enabledDeps.forEach(dep => {
      dep.subscribe(() => {
        const currentEnabledState = isEnabled();

        if (!previousEnabledState && currentEnabledState && !expectsParams) {
          teardownSideEffects();
          setupSideEffects();
          fetchData(undefined, retryCount, true);
        }

        previousEnabledState = currentEnabledState;
      });
    });
  }

  setupSideEffects();
  if (isEnabled() && !expectsParams) fetchData();

  const baseInstance = {
    ...baseChunk,

    subscribe: (callback: (state: AsyncStateWithPagination<T, E>) => void) => {
      subscriberCount++;
      const unsubscribe = baseChunk.subscribe(callback);
      return () => {
        unsubscribe();
        subscriberCount--;
      };
    },

    cancel: () => {
      isCancelled = true;
      inFlightRequests.delete(buildDedupKey());
      const state = baseChunk.get();
      if (state.loading) {
        baseChunk.set({ ...state, loading: false });
      }
    },

    reload: async (params?: Partial<P>) => {
      isCancelled = false;
      if (expectsParams && !isPaginated && Object.keys(currentParams as object).length === 0) return;

      if (isPaginated) {
        const state = baseChunk.get();
        if (state.pagination) {
          baseChunk.set({
            ...state,
            pagination: {
              ...state.pagination,
              page: paginationConfig?.initialPage || 1,
              cursor: undefined,
            },
          });
        }
      }

      await fetchData(params, retryCount, true);
    },

    refresh: async (params?: Partial<P>) => {
      await fetchData(params, retryCount, false);
    },

    mutate: (mutator: (currentData: T | null) => T | null) => {
      const state = baseChunk.get();
      baseChunk.set({ ...state, data: mutator(state.data) });
    },

    reset: (refetch = true) => {
      teardownSideEffects();
      currentParams = {};
      baseChunk.set({ ...initialState, loading: isEnabled() && refetch && (isPaginated || !expectsParams) });
      setupSideEffects();
      if (isEnabled() && refetch && (isPaginated || !expectsParams)) fetchData();
    },

    cleanup: () => {
      if (subscriberCount <= 0) teardownSideEffects();
    },

    forceCleanup: () => {
      teardownSideEffects();
    },

    setParams: (params: Partial<Record<keyof P, P[keyof P] | null>>) => {
      isCancelled = false;
      const next = { ...currentParams };
      for (const key in params) {
        if (params[key] === null) {
          delete next[key];
        } else {
          (next as any)[key] = params[key];
        }
      }
      currentParams = next;

      if (isPaginated) {
        const state = baseChunk.get();
        if (state.pagination) {
          baseChunk.set({
            ...state,
            data: clearOnParamChange ? initialData : (paginationMode === 'accumulate' ? initialData : state.data),
            pagination: {
              ...state.pagination,
              page: paginationConfig?.initialPage || 1,
              cursor: undefined,
            },
          });
        }
      } else if (clearOnParamChange) {
        const state = baseChunk.get();
        baseChunk.set({
          ...state,
          data: initialData,
          error: null,
          lastFetched: undefined,
          isPlaceholderData: false,
        });
      }

      if (isEnabled()) fetchData(currentParams as Partial<P>, retryCount, true);
    },

    clearParams: () => {
      currentParams = {};
      if (isEnabled()) fetchData(undefined, retryCount, true);
    },
  };

  let instance: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>;

  if (isPaginated) {
    instance = {
      ...baseInstance,

      nextPage: async () => {
        const state = baseChunk.get();
        if (!state.pagination || state.pagination.hasMore === false) return;

        if (isCursorMode) {
          isNextPageFetch = true;
          await fetchData(currentParams, retryCount, true);
          isNextPageFetch = false;
        } else {
          baseChunk.set({
            ...state,
            pagination: { ...state.pagination, page: state.pagination.page + 1 }
          });
          isNextPageFetch = true;
          await fetchData(currentParams, retryCount, true);
          isNextPageFetch = false;
        }
      },

      prevPage: async () => {
        if (isCursorMode) return;
        const state = baseChunk.get();
        if (!state.pagination || state.pagination.page <= 1) return;
        baseChunk.set({
          ...state,
          pagination: { ...state.pagination, page: state.pagination.page - 1 }
        });
        await fetchData(currentParams, retryCount, true);
      },

      goToPage: async (page: number) => {
        if (isCursorMode) return;
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
          pagination: {
            ...state.pagination,
            page: paginationConfig?.initialPage || 1,
            cursor: undefined,
          }
        });
        await fetchData(currentParams, retryCount, true);
      },
    } as PaginatedAsyncChunk<T, E>;
  } else {
    instance = baseInstance;
  }

  if (scoped) {
    Object.defineProperty(instance, "__scopedFactory", {
      value: () => createAsyncChunkInternal(fetcher, options),
      enumerable: false,
      writable: false,
    });
  }

  return instance;
}

export function asyncChunk<T, E extends Error = Error>(
  fetcher: () => Promise<T | FetcherResponse<T>>,
  options?: Omit<AsyncChunkOptions<T, E>, 'pagination'>
): AsyncChunk<T, E>;
export function asyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  fetcher: (params: P) => Promise<T | FetcherResponse<T>>,
  options?: Omit<AsyncChunkOptions<T, E, P>, 'pagination'>
): ParamAsyncChunk<T, E, P>;
export function asyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  fetcher: (() => Promise<T | FetcherResponse<T>>) | ((params: P) => Promise<T | FetcherResponse<T>>),
  options: Omit<AsyncChunkOptions<T, E, P>, 'pagination'> = {}
): AsyncChunk<T, E> | ParamAsyncChunk<T, E, P> {
  return createAsyncChunkInternal(fetcher, options) as AsyncChunk<T, E> | ParamAsyncChunk<T, E, P>;
}

/**
 * Creates a paginated async state unit — always returns `PaginatedParamAsyncChunk`
 * with `nextPage`/`prevPage`/`goToPage`/`resetPagination`.
 */
export function paginatedAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  fetcher: (params: P & { page?: number; pageSize: number; cursor?: string }) => Promise<FetcherResponse<T>>,
  options: AsyncChunkOptions<T, E, P> & { pagination: NonNullable<AsyncChunkOptions<T, E, P>['pagination']> }
): PaginatedParamAsyncChunk<T, E, P> {
  return createAsyncChunkInternal(fetcher as any, options) as PaginatedParamAsyncChunk<T, E, P>;
}
