import { asyncChunk, AsyncChunkOptions, PaginatedAsyncChunk } from './async-chunk';

export type InfiniteAsyncChunkOptions<T, E extends Error = Error> =
  Omit<AsyncChunkOptions<T[], E>, 'pagination'> & {
    /** Items per page (default: 10) */
    pageSize?: number;
  };

export type InfiniteAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}> =
  PaginatedAsyncChunk<T[], E> & {
    setParams: (params: Partial<Record<keyof P, P[keyof P] | null>>) => void;
    clearParams: () => void;
    reload: (params?: Partial<P>) => Promise<void>;
    refresh: (params?: Partial<P>) => Promise<void>;
    forceCleanup: () => void;
  };

/**
 * Creates an infinite scroll async chunk that accumulates pages.
 *
 * A convenience wrapper around `asyncChunk` with `pagination.mode: 'accumulate'`
 * pre-configured. Each `nextPage()` appends to the existing data array.
 *
 * @param fetcher - Async function receiving `{ page, pageSize, ...params }`,
 *   returning `{ data: T[], hasMore?, total? }`.
 * @param options.pageSize - Items per page (default: 10).
 * @param options.key - Deduplication key.
 * @param options.onSuccess - Called with the full accumulated array after each fetch.
 *
 * @example
 * const posts = infiniteAsyncChunk(
 *   async ({ page, pageSize }) => fetchPosts({ page, pageSize }),
 *   { pageSize: 20 }
 * );
 * posts.reload();   // page 1
 * posts.nextPage(); // page 2 appended
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
  const { pageSize = 10, ...rest } = options;

  return asyncChunk<T[], E, P & { page: number; pageSize: number }>(
    fetcher,
    {
      ...rest,
      pagination: {
        pageSize,
        mode: 'accumulate',
        initialPage: 1,
      },
    }
  ) as InfiniteAsyncChunk<T, E, P>;
}
