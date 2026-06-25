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

interface UseAsyncChunkResult<T, E extends Error, P extends Record<string, any>> {
  data: T | null;
  loading: boolean;
  error: E | null;
  lastFetched?: number;
  isPlaceholderData: boolean;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
  mutate: (mutator: (currentData: T | null) => T | null) => void;
  reset: () => void;
}

interface UseAsyncChunkResultWithParams<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResult<T, E, P> {
  setParams: (params: Partial<Record<keyof P, P[keyof P] | null>>) => void;
  clearParams: () => void;
}

interface UseAsyncChunkResultWithPagination<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResult<T, E, P> {
  pagination?: PaginationState;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  resetPagination: () => Promise<void>;
}

interface UseAsyncChunkResultWithParamsAndPagination<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResultWithParams<T, E, P>,
  Omit<UseAsyncChunkResultWithPagination<T, E, P>, keyof UseAsyncChunkResult<T, E, P>> { }

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

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>,
  options: UseAsyncChunkOptions<T, E, P> = {}
) {
  const resolvedParams = options.params ?? options.initialParams;
  const { fetchOnMount = false, onSuccess, onError, enabled = true } = options;

  const [state, setState] = useState<AsyncStateWithPagination<T, E>>(
    () => asyncChunk.get()
  );

  const optionsRef = useRef({ resolvedParams, fetchOnMount, onSuccess, onError });
  optionsRef.current = { resolvedParams, fetchOnMount, onSuccess, onError };

  const prevStateRef = useRef<AsyncStateWithPagination<T, E>>(asyncChunk.get());
  const prevEnabledRef = useRef(enabled);

  // FIX: Track whether the enabled-flip effect already dispatched a fetch
  // for the current render cycle. When enabled flips true AND params change
  // in the same render, both effects would fire — this flag lets the params
  // effect skip its fetch since the enabled effect already covered it.
  const enabledFlippedThisRenderRef = useRef(false);

  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;

    // Reset the flag at the start of every enabled effect run
    enabledFlippedThisRenderRef.current = false;

    if (!wasEnabled && enabled) {
      // enabled flipped true — fetch with current params
      enabledFlippedThisRenderRef.current = true;
      const { resolvedParams: rp } = optionsRef.current;
      if (rp && hasSetParams(asyncChunk)) {
        asyncChunk.setParams(rp);
      } else {
        asyncChunk.reload();
      }
    } else if (wasEnabled && !enabled) {
      // enabled flipped false — cancel in-flight + clear loading
      (asyncChunk as any).cancel?.();
    }
  }, [enabled, asyncChunk]);

  // Mount effect — subscribe, initial fetch, cleanup
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
      if (enabled) asyncChunk.setParams(rp);
    } else if (fom || (enabled && initialState.data === null && !initialState.loading)) {
      asyncChunk.reload();
    }

    return () => {
      unsubscribe();
      asyncChunk.cleanup();
    };
  }, [asyncChunk]);

  // Params change effect — skips mount (isMountedRef) and skips when the
  // enabled-flip effect already fired a fetch this render (enabledFlippedThisRenderRef).
  const isMountedRef = useRef(false);
  const paramsKey = resolvedParams ? JSON.stringify(resolvedParams) : null;

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    // If enabled just flipped to true this render, the enabled effect
    // already called setParams with the current params. Skip here to prevent
    // a duplicate fetch.
    if (enabledFlippedThisRenderRef.current) {
      enabledFlippedThisRenderRef.current = false;
      return;
    }

    if (!enabled) return;

    const freshParams = optionsRef.current.resolvedParams;
    if (freshParams && hasSetParams(asyncChunk)) {
      asyncChunk.setParams(freshParams);
    }
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
    (mutator: (currentData: T | null) => T | null) => asyncChunk.mutate(mutator),
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
