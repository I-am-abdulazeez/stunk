import { asyncChunk, PaginatedAsyncChunk } from './async-chunk';

interface InfiniteAsyncChunkOptions<T, E extends Error> {
  /** Initial page size (default: 10) */
  pageSize?: number;
  /** Time in ms after which data becomes stale */
  staleTime?: number;
  /** Time in ms to cache data */
  cacheTime?: number;
  /** Auto-refresh interval in ms */
  refetchInterval?: number;
  /** Refetch when window regains focus (default: false) */
  refetchOnWindowFocus?: boolean;
  /** Retry count on error */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Error callback */
  onError?: (error: E) => void;
  /** Success callback */
  onSuccess?: (data: T[]) => void;
  /**
   * Unique key for request deduplication.
   * If two components call reload() on the same keyed chunk simultaneously,
   * only one request fires.
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

/**
 * Create an infinite scroll async chunk with accumulate mode.
 * Automatically handles pagination in accumulate mode for infinite scrolling.
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
): PaginatedAsyncChunk<T[], E> & {
  setParams: (params: Partial<P>) => void;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
} {
  const {
    pageSize = 10,
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

  return asyncChunk<T[], E, P & { page: number; pageSize: number }>(
    fetcher,
    {
      pagination: {
        pageSize,
        mode: 'accumulate',
        initialPage: 1,
      },
      refresh: {
        staleTime,
        cacheTime,
        refetchInterval,
        refetchOnWindowFocus,
      },
      retryCount,
      retryDelay,
      onError,
      onSuccess,
      key,
      enabled,
      keepPreviousData,
    }
  ) as PaginatedAsyncChunk<T[], E> & {
    setParams: (params: Partial<P>) => void;
    reload: (params?: Partial<P>) => Promise<void>;
    refresh: (params?: Partial<P>) => Promise<void>;
  };
}
