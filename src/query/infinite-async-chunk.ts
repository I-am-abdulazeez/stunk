import { asyncChunk, PaginatedAsyncChunk } from './async-chunk';

export interface InfiniteAsyncChunkOptions<T, E extends Error> {
  /** Initial page size (default: 10) */
  pageSize?: number;
  /** Seed data before the first fetch */
  initialData?: T[] | null;
  /** Time in ms after which data becomes stale */
  staleTime?: number;
  /** Time in ms to cache data after last subscriber leaves */
  cacheTime?: number;
  /** Auto-refresh interval in ms */
  refetchInterval?: number;
  /** Refetch when window regains focus — respects staleTime (default: false) */
  refetchOnWindowFocus?: boolean;
  /** Number of times to retry a failed fetch */
  retryCount?: number;
  /** Delay in ms between retries */
  retryDelay?: number;
  /** Called with the error when all retries are exhausted */
  onError?: (error: E) => void;
  /** Called with the accumulated data array after every successful fetch */
  onSuccess?: (data: T[]) => void;
  /**
   * Unique key for request deduplication.
   * If two components call reload() on the same keyed chunk simultaneously,
   * only one request fires. Defaults to an auto-generated ID.
   */
  key?: string;
  /**
   * Enable or disable the fetcher.
   * Accepts a static boolean or a function for dynamic evaluation.
   */
  enabled?: boolean | (() => boolean);
  /** Keep previous data visible while new data is loading (default: false) */
  keepPreviousData?: boolean;
}

export type InfiniteAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}> =
  PaginatedAsyncChunk<T[], E> & {
    setParams: (params: Partial<Record<keyof P, P[keyof P] | null>>) => void;
    clearParams: () => void;
    reload: (params?: Partial<P>) => Promise<void>;
    refresh: (params?: Partial<P>) => Promise<void>;
    forceCleanup: () => void;
  };

/**
 * Creates an infinite scroll async chunk that automatically accumulates pages.
 *
 * @example
 * const postsChunk = infiniteAsyncChunk(
 *   async ({ page, pageSize }) => {
 *     const res = await fetchPosts({ page, pageSize });
 *     return { data: res.posts, hasMore: res.hasMore };
 *   },
 *   { pageSize: 20, key: 'posts-infinite' }
 * );
 */
export function infiniteAsyncChunk<
  T,
  E extends Error = Error,
  P extends Record<string, any> = {}
>(
  fetcher: (params: P & { page: number; pageSize: number }) => Promise<{
    data: T[];
    hasMore?: boolean;
    total?: number;
  }>,
  options: InfiniteAsyncChunkOptions<T, E> = {}
): InfiniteAsyncChunk<T, E, P> {
  const {
    pageSize = 10,
    initialData,
    staleTime,
    cacheTime,
    refetchInterval,
    refetchOnWindowFocus,
    retryCount,
    retryDelay,
    onError,
    onSuccess,
    key,
    enabled,
    keepPreviousData,
  } = options;

  // Only pass refresh keys that are explicitly set — avoids overriding
  // asyncChunk's own defaults with undefined values
  const refreshConfig: Record<string, any> = {};
  if (staleTime !== undefined) refreshConfig.staleTime = staleTime;
  if (cacheTime !== undefined) refreshConfig.cacheTime = cacheTime;
  if (refetchInterval !== undefined) refreshConfig.refetchInterval = refetchInterval;
  if (refetchOnWindowFocus !== undefined) refreshConfig.refetchOnWindowFocus = refetchOnWindowFocus;

  return asyncChunk<T[], E, P & { page: number; pageSize: number }>(
    fetcher,
    {
      ...(initialData !== undefined && { initialData }),
      pagination: {
        pageSize,
        mode: 'accumulate',
        initialPage: 1,
      },
      refresh: refreshConfig,
      ...(retryCount !== undefined && { retryCount }),
      ...(retryDelay !== undefined && { retryDelay }),
      ...(onError !== undefined && { onError }),
      ...(onSuccess !== undefined && { onSuccess }),
      ...(key !== undefined && { key }),
      ...(enabled !== undefined && { enabled }),
      ...(keepPreviousData !== undefined && { keepPreviousData }),
    }
  ) as InfiniteAsyncChunk<T, E, P>;
}
