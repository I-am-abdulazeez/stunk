import { paginatedAsyncChunk, AsyncChunkOptions, PaginatedParamAsyncChunk } from './async-chunk';

export type InfiniteAsyncChunkOptions<T, E extends Error = Error> =
  Omit<AsyncChunkOptions<T[], E>, 'pagination'> & {
    /** Items per page (default: 10) */
    pageSize?: number;
  };

export type InfiniteAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}> =
  PaginatedParamAsyncChunk<T[], E, P & { page: number; pageSize: number }>;

/**
 * Creates an infinite scroll async chunk that accumulates pages.
 *
 * A convenience wrapper around `paginatedAsyncChunk` with `pagination.mode: 'accumulate'`
 * pre-configured. Each `nextPage()` appends to the existing data array.
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

  return paginatedAsyncChunk<T[], E, P>(
    fetcher as any,
    {
      ...rest,
      pagination: {
        pageSize,
        mode: 'accumulate',
        initialPage: 1,
      },
    }
  );
}
