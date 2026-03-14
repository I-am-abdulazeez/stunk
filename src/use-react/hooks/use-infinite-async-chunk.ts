import { useEffect, useRef, useCallback } from 'react';
import { useAsyncChunk, UseAsyncChunkOptions } from './use-async-chunk';
import { InfiniteAsyncChunk } from '../../query/infinite-async-chunk';

export interface UseInfiniteAsyncChunkOptions<P extends Record<string, any>>
  extends Omit<UseAsyncChunkOptions<P>, 'initialParams'> {
  /** Initial parameters — page and pageSize are managed automatically */
  initialParams?: Omit<Partial<P>, 'page' | 'pageSize'>;
  /** Automatically load next page when sentinel enters viewport (default: true) */
  autoLoad?: boolean;
  /** IntersectionObserver threshold — 0.0 to 1.0 (default: 1.0) */
  threshold?: number;
}

export interface UseInfiniteAsyncChunkResult<T, E extends Error, P extends Record<string, any>> {
  data: T[] | null;
  loading: boolean;
  error: E | null;
  lastFetched?: number;
  isPlaceholderData: boolean;
  /** True when fetching a new page while existing data is already loaded */
  isFetchingMore: boolean;
  /** True if more pages are available */
  hasMore: boolean;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
  mutate: (mutator: (currentData: T[] | null) => T[]) => void;
  reset: () => void;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  resetPagination: () => Promise<void>;
  /** Manually trigger loading the next page */
  loadMore: () => void;
  /** Attach this ref to a sentinel element at the bottom of your list */
  observerTarget: React.RefObject<HTMLElement>;
}

export function useInfiniteAsyncChunk<
  T,
  E extends Error = Error,
  P extends Record<string, any> = {}
>(
  chunk: InfiniteAsyncChunk<T, E, P>,
  options: UseInfiniteAsyncChunkOptions<P> = {}
): UseInfiniteAsyncChunkResult<T, E, P> {
  const {
    initialParams,
    autoLoad = true,
    threshold = 1.0,
    fetchOnMount,
  } = options;

  // Pass user params only — never page/pageSize, those are owned by the chunk
  const result = useAsyncChunk(chunk, {
    ...(initialParams && { initialParams: initialParams as Partial<P> }),
    fetchOnMount,
  });

  const { loading, pagination, nextPage, data, error, isPlaceholderData } = result as any;

  // Stable refs for callback values — keeps the observer from re-registering
  // on every loading/hasMore change
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(pagination?.hasMore ?? false);
  const nextPageRef = useRef(nextPage);

  loadingRef.current = loading;
  hasMoreRef.current = pagination?.hasMore ?? false;
  nextPageRef.current = nextPage;

  // Sentinel ref — generic HTMLElement so it works with any element type
  const observerTarget = useRef<HTMLElement>(null);

  // Stable intersection observer — never re-registers, reads state via refs
  useEffect(() => {
    if (!autoLoad) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loadingRef.current &&
          hasMoreRef.current
        ) {
          nextPageRef.current();
        }
      },
      { threshold }
    );

    const target = observerTarget.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
      observer.disconnect();
    };
  }, [autoLoad, threshold]); // stable — never re-runs due to loading/hasMore changes

  // Manual trigger — consistent with the observer logic
  const loadMore = useCallback(() => {
    if (!loadingRef.current && hasMoreRef.current) {
      nextPageRef.current();
    }
  }, []);

  // isFetchingMore: loading a new page while data already exists and pagination
  // is past page 1 — distinct from the initial load
  const isFetchingMore =
    loading &&
    data !== null &&
    (data as T[]).length > 0 &&
    (pagination?.page ?? 1) > 1;

  return {
    ...result,
    data: data as T[] | null,
    error: error as E | null,
    isPlaceholderData: isPlaceholderData ?? false,
    isFetchingMore,
    hasMore: pagination?.hasMore ?? false,
    loadMore,
    observerTarget,
  } as UseInfiniteAsyncChunkResult<T, E, P>;
}
