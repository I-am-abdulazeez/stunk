import { asyncChunk, PaginatedAsyncChunk } from './async-chunk';

interface InfiniteAsyncChunkOptions<T, E extends Error> {
  /** Initial page size (default: 10) */
  pageSize?: number;
  /** Time in ms after which data becomes stale */
  staleTime?: number;
  /** Time in ms to cache data */
  cacheTime?: number;
  /** Retry count on error */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Error callback */
  onError?: (error: E) => void;
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
    retryCount,
    retryDelay,
    onError,
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
      },
      retryCount,
      retryDelay,
      onError,
    }
  ) as PaginatedAsyncChunk<T[], E> & {
    setParams: (params: Partial<P>) => void;
    reload: (params?: Partial<P>) => Promise<void>;
    refresh: (params?: Partial<P>) => Promise<void>;
  };
}
