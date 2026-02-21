import { useState, useEffect, useCallback, useRef } from "react";
import { AsyncChunk, AsyncStateWithPagination, PaginatedAsyncChunk, PaginationState } from "../../core/async-chunk";

// Type guard to check if chunk has pagination methods
function isPaginatedChunk<T, E extends Error>(
  chunk: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>
): chunk is PaginatedAsyncChunk<T, E> {
  return 'nextPage' in chunk;
}

// Type guard to check if chunk has setParams
function hasSetParams<T, E extends Error, P extends Record<string, any>>(
  chunk: AsyncChunk<T, E> | (AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void })
): chunk is AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void } {
  return 'setParams' in chunk;
}

// Return type for hook without pagination or params
interface UseAsyncChunkResult<T, E extends Error, P extends Record<string, any>> {
  data: T | null;
  loading: boolean;
  error: E | null;
  lastFetched?: number;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
  mutate: (mutator: (currentData: T | null) => T) => void;
  reset: () => void;
}

// Return type with setParams
interface UseAsyncChunkResultWithParams<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResult<T, E, P> {
  setParams: (params: Partial<P>) => void;
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

/**
 * A hook that handles asynchronous state with built-in reactivity.
 * Provides loading, error, and data states with full asyncChunk functionality.
 */
export interface UseAsyncChunkOptions<P extends Record<string, any> = {}> {
  /** Initial parameters to pass to the fetcher */
  initialParams?: Partial<P>;
  /** Force fetch on mount, even without params (default: false) */
  fetchOnMount?: boolean;
}

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: PaginatedAsyncChunk<T, E> & { setParams: (params: Partial<P>) => void },
  options?: UseAsyncChunkOptions<P> | Partial<P>
): UseAsyncChunkResultWithParamsAndPagination<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: PaginatedAsyncChunk<T, E>,
  options?: UseAsyncChunkOptions<P> | Partial<P>
): UseAsyncChunkResultWithPagination<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void },
  options?: UseAsyncChunkOptions<P> | Partial<P>
): UseAsyncChunkResultWithParams<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: AsyncChunk<T, E>,
  options?: UseAsyncChunkOptions<P> | Partial<P>
): UseAsyncChunkResult<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E> | (AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void }),
  options?: UseAsyncChunkOptions<P> | Partial<P> // Support both formats for backward compatibility
) {
  // Handle both old and new API formats
  const { initialParams, fetchOnMount } = typeof options === 'object' && ('initialParams' in options || 'fetchOnMount' in options)
    ? options as UseAsyncChunkOptions<P>
    : { initialParams: options as Partial<P> | undefined, fetchOnMount: false };

  const [state, setState] = useState<AsyncStateWithPagination<T, E>>(() => asyncChunk.get());
  const initConfigRef = useRef<{
    chunk: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E> | (AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void });
    initialParams?: Partial<P>;
    fetchOnMount?: boolean;
  } | null>(null);

  if (!initConfigRef.current || initConfigRef.current.chunk !== asyncChunk) {
    initConfigRef.current = {
      chunk: asyncChunk,
      initialParams,
      fetchOnMount,
    };
  }

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = asyncChunk.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [asyncChunk]);

  // Set initial params and trigger fetch
  useEffect(() => {
    const initConfig = initConfigRef.current;
    const initialParamsForChunk = initConfig?.initialParams;
    const fetchOnMountForChunk = initConfig?.fetchOnMount;

    if (initialParamsForChunk && hasSetParams(asyncChunk)) {
      asyncChunk.setParams(initialParamsForChunk);
    } else if (fetchOnMountForChunk && !initialParamsForChunk) {
      asyncChunk.reload();
    }
  }, [asyncChunk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      asyncChunk.cleanup();
    };
  }, [asyncChunk]);

  // Memoize methods to prevent unnecessary re-renders
  const reload = useCallback((params?: Partial<P>) => {
    return asyncChunk.reload(params);
  }, [asyncChunk]);

  const refresh = useCallback((params?: Partial<P>) => {
    return asyncChunk.refresh(params);
  }, [asyncChunk]);

  const mutate = useCallback(
    (mutator: (currentData: T | null) => T) => asyncChunk.mutate(mutator),
    [asyncChunk]
  );

  const reset = useCallback(() => asyncChunk.reset(), [asyncChunk]);

  const setParams = useCallback((params: Partial<P>) => {
    if ('setParams' in asyncChunk) {
      (asyncChunk as any).setParams(params);
    }
  }, [asyncChunk]);

  const nextPage = useCallback(() => {
    if (isPaginatedChunk(asyncChunk)) {
      return asyncChunk.nextPage();
    }
    return Promise.resolve();
  }, [asyncChunk]);

  const prevPage = useCallback(() => {
    if (isPaginatedChunk(asyncChunk)) {
      return asyncChunk.prevPage();
    }
    return Promise.resolve();
  }, [asyncChunk]);

  const goToPage = useCallback((page: number) => {
    if (isPaginatedChunk(asyncChunk)) {
      return asyncChunk.goToPage(page);
    }
    return Promise.resolve();
  }, [asyncChunk]);

  const resetPagination = useCallback(() => {
    if (isPaginatedChunk(asyncChunk)) {
      return asyncChunk.resetPagination();
    }
    return Promise.resolve();
  }, [asyncChunk]);

  const { data, loading, error, lastFetched, pagination } = state;

  const result: UseAsyncChunkResult<T, E, P> = {
    data,
    loading,
    error,
    lastFetched,
    reload,
    refresh,
    mutate,
    reset,
  };

  // Add setParams if the asyncChunk supports it
  if (hasSetParams(asyncChunk)) {
    (result as UseAsyncChunkResultWithParams<T, E, P>).setParams = setParams;
  }

  // Add pagination methods if available
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
