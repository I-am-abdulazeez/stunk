import { useState, useEffect, useCallback, useRef } from "react";
import {
  AsyncChunk,
  AsyncStateWithPagination,
  PaginatedAsyncChunk,
  PaginationState,
} from "../../query/async-chunk";

// Type guard to check if chunk has pagination methods
function isPaginatedChunk<T, E extends Error>(
  c: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>
): c is PaginatedAsyncChunk<T, E> {
  return 'nextPage' in c;
}

// Type guard to check if chunk has setParams
function hasSetParams<T, E extends Error, P extends Record<string, any>>(
  c: AsyncChunk<T, E> | (AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void })
): c is AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void } {
  return 'setParams' in c;
}

function hasClearParams<T, E extends Error>(
  c: AsyncChunk<T, E>
): c is AsyncChunk<T, E> & { clearParams: () => void } {
  return 'clearParams' in c;
}

// Return type for hook without pagination or params
interface UseAsyncChunkResult<T, E extends Error, P extends Record<string, any>> {
  data: T | null;
  loading: boolean;
  error: E | null;
  lastFetched?: number;
  /** True when showing stale data while a new fetch is in progress (keepPreviousData: true) */
  isPlaceholderData: boolean;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
  mutate: (mutator: (currentData: T | null) => T) => void;
  reset: () => void;
}

// Return type with setParams and clearParams
interface UseAsyncChunkResultWithParams<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResult<T, E, P> {
  setParams: (params: Partial<Record<keyof P, P[keyof P] | null>>) => void;
  clearParams: () => void;
}

// Return type with pagination
interface UseAsyncChunkResultWithPagination<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResult<T, E, P> {
  pagination?: PaginationState;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  resetPagination: () => Promise<void>;
}

// Return type with both params and pagination
interface UseAsyncChunkResultWithParamsAndPagination<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResultWithParams<T, E, P>,
  Omit<UseAsyncChunkResultWithPagination<T, E, P>, keyof UseAsyncChunkResult<T, E, P>> { }

// Options
export interface UseAsyncChunkOptions<T = any, E extends Error = Error, P extends Record<string, any> = {}> {
  /**
   * Parameters to pass to the fetcher. When these change between renders,
   * the chunk automatically re-fetches with the new values.
   */
  params?: Partial<P>;
  /**
   * @deprecated Use `params` instead. Will be removed in v3 stable.
   */
  initialParams?: Partial<P>;
  /**
   * Force a fetch on mount even when the chunk has no params.
   * Ignored if params is provided.
   * (default: false)
   */
  fetchOnMount?: boolean;
  /**
   * Whether the chunk is enabled.
   * If false, the chunk will not fetch data.
   * (default: true)
   */
  enabled?: boolean;
  /**
   * Called after every successful fetch at the hook level.
   * Has full access to React context — safe to call navigate(), setState(), etc.
   */
  onSuccess?: (data: T) => void;
  /**
   * Called when a fetch fails at the hook level.
   * Has full access to React context — safe to call navigate(), setState(), etc.
   */
  onError?: (error: E) => void;
}

// Overloads
export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: PaginatedAsyncChunk<T, E> & { setParams: (params: Partial<P>) => void },
  options?: UseAsyncChunkOptions<T, E, P>
): UseAsyncChunkResultWithParamsAndPagination<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: PaginatedAsyncChunk<T, E>,
  options?: UseAsyncChunkOptions<T, E, P>
): UseAsyncChunkResultWithPagination<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void },
  options?: UseAsyncChunkOptions<T, E, P>
): UseAsyncChunkResultWithParams<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: AsyncChunk<T, E>,
  options?: UseAsyncChunkOptions<T, E, P>
): UseAsyncChunkResult<T, E, P>;

/**
 * Subscribes to an async chunk and returns its full state with reactive updates.
 *
 * Automatically handles `loading`, `error`, `data`, and `isPlaceholderData`.
 * Pass `params` to trigger a fetch with parameters — when params change between
 * renders the chunk automatically re-fetches with the new values.
 *
 * Hook-level `onSuccess` and `onError` have full access to React context —
 * safe to call navigate(), setState(), or any other React hook side-effects.
 *
 * @param asyncChunk - The async chunk to subscribe to.
 * @param options.params - Params to pass to the fetcher. Re-fetches when changed.
 * @param options.fetchOnMount - Force fetch on mount for param-less chunks (default: false).
 * @param options.onSuccess - Called after every successful fetch. Has React context access.
 * @param options.onError - Called when a fetch fails. Has React context access.
 *
 * @example
 * const { data, loading } = useAsyncChunk(userChunk);
 *
 * @example
 * // Params — re-fetches automatically when id changes
 * const { data } = useAsyncChunk(houseChunk, { params: { id } });
 *
 * @example
 * // Hook-level callbacks — navigate, set state, anything React
 * const { data } = useAsyncChunk(profileChunk, {
 *   onSuccess: (data) => {
 *     if (!data) navigate('/login')
 *     setName(data.name)
 *   },
 *   onError: () => navigate('/error'),
 * });
 */
export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>,
  options: UseAsyncChunkOptions<T, E, P> = {}
) {
  // Support both `params` (new) and `initialParams` (deprecated alias)
  const resolvedParams = options.params ?? options.initialParams;
  const { fetchOnMount = false, onSuccess, onError, enabled = true } = options;

  const [state, setState] = useState<AsyncStateWithPagination<T, E>>(
    () => asyncChunk.get()
  );

  // Keep latest callbacks in a ref so they never cause effect re-runs
  const optionsRef = useRef({ resolvedParams, fetchOnMount, onSuccess, onError });
  optionsRef.current = { resolvedParams, fetchOnMount, onSuccess, onError };

  // Track previous state to detect loading → settled transitions
  const prevStateRef = useRef<AsyncStateWithPagination<T, E>>(asyncChunk.get());

  const prevEnabledRef = useRef(enabled);

  // Replace the existing enabled effect:
  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;

    if (!wasEnabled && enabled) {
      // enabled flipped true → fetch
      if (!optionsRef.current.resolvedParams) {
        asyncChunk.reload();
      }
    } else if (wasEnabled && !enabled) {
      // enabled flipped false → cancel in-flight + clear loading
      (asyncChunk as any).cancel?.();
    }
  }, [enabled, asyncChunk]);

  // Single effect — subscribe, initial fetch, and cleanup
  useEffect(() => {
    const initialState = asyncChunk.get();
    setState(initialState);
    prevStateRef.current = initialState;

    const unsubscribe = asyncChunk.subscribe((newState) => {
      const prev = prevStateRef.current;

      if (prev.loading && !newState.loading && !newState.error && newState.data !== null) {
        optionsRef.current.onSuccess?.(newState.data as T);
      }

      if (prev.loading && !newState.loading && newState.error) {
        optionsRef.current.onError?.(newState.error as E);
      }

      prevStateRef.current = newState;
      setState(newState);
    });

    const { resolvedParams: rp, fetchOnMount: fom } = optionsRef.current;
    if (rp && hasSetParams(asyncChunk)) {
      asyncChunk.setParams(rp);
    } else if (fom || (enabled && initialState.data === null && !initialState.loading)) {
      asyncChunk.reload();
    }

    return () => {
      unsubscribe();
      asyncChunk.cleanup();
    };
  }, [asyncChunk]);

  // Params change effect — re-fetches when params change between renders.
  // isMountedRef skips the first run since the mount effect above handles it.
  const isMountedRef = useRef(false);
  const paramsKey = resolvedParams ? JSON.stringify(resolvedParams) : null;

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const freshParams = optionsRef.current.resolvedParams;
    if (freshParams && hasSetParams(asyncChunk)) {
      asyncChunk.setParams(freshParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  // Memoized methods

  const reload = useCallback(
    (params?: Partial<P>) => asyncChunk.reload(params),
    [asyncChunk]
  );

  const refresh = useCallback(
    (params?: Partial<P>) => asyncChunk.refresh(params),
    [asyncChunk]
  );

  const mutate = useCallback(
    (mutator: (currentData: T | null) => T) => asyncChunk.mutate(mutator),
    [asyncChunk]
  );

  const reset = useCallback(
    () => asyncChunk.reset(),
    [asyncChunk]
  );

  const setParams = useCallback(
    (params: Partial<Record<keyof P, P[keyof P] | null>>) => {
      if (hasSetParams(asyncChunk)) asyncChunk.setParams(params);
    },
    [asyncChunk]
  );

  const clearParams = useCallback(() => {
    if (hasClearParams(asyncChunk)) asyncChunk.clearParams();
  }, [asyncChunk]);

  const nextPage = useCallback(
    () => isPaginatedChunk(asyncChunk) ? asyncChunk.nextPage() : Promise.resolve(),
    [asyncChunk]
  );

  const prevPage = useCallback(
    () => isPaginatedChunk(asyncChunk) ? asyncChunk.prevPage() : Promise.resolve(),
    [asyncChunk]
  );

  const goToPage = useCallback(
    (page: number) => isPaginatedChunk(asyncChunk) ? asyncChunk.goToPage(page) : Promise.resolve(),
    [asyncChunk]
  );

  const resetPagination = useCallback(
    () => isPaginatedChunk(asyncChunk) ? asyncChunk.resetPagination() : Promise.resolve(),
    [asyncChunk]
  );

  const { data, loading, error, lastFetched, isPlaceholderData = false, pagination } = state;

  const result: UseAsyncChunkResult<T, E, P> = {
    data,
    loading,
    error,
    lastFetched,
    isPlaceholderData,
    reload,
    refresh,
    mutate,
    reset,
  };

  if (hasSetParams(asyncChunk)) {
    (result as UseAsyncChunkResultWithParams<T, E, P>).setParams = setParams;
    (result as UseAsyncChunkResultWithParams<T, E, P>).clearParams = clearParams;
  }

  if (isPaginatedChunk(asyncChunk)) {
    const paginatedResult = result as UseAsyncChunkResultWithPagination<T, E, P>;
    paginatedResult.pagination = pagination;
    paginatedResult.nextPage = nextPage;
    paginatedResult.prevPage = prevPage;
    paginatedResult.goToPage = goToPage;
    paginatedResult.resetPagination = resetPagination;
  }

  return result;
}
