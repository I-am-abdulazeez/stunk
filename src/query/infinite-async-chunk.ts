import { paginatedAsyncChunk, AsyncChunkOptions, PaginatedParamAsyncChunk, CursorModeConfig } from './async-chunk';

export type InfiniteAsyncChunkOptions<T, E extends Error = Error> =
  Omit<AsyncChunkOptions<T[], E>, 'pagination'> & {
    /** Items per page (default: 10) */
    pageSize?: number;
    /**
     * Use cursor-based pagination instead of page-number based.
     * Required when the backend returns an opaque cursor (e.g. base64-encoded)
     * rather than supporting page numbers directly.
     */
    cursorMode?: CursorModeConfig<T[]>;
  };

export type InfiniteAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}> =
  PaginatedParamAsyncChunk<T[], E, P & { page?: number; pageSize: number; cursor?: string }>;

/**
 * Creates an infinite scroll async chunk that accumulates pages.
 *
 * Supports both page-number pagination (default) and cursor-based pagination
 * via `options.cursorMode` — use cursor mode when your backend returns an
 * opaque `nextCursor` rather than working with page numbers.
 *
 * @example
 * // Page-based (default)
 * const posts = infiniteAsyncChunk(
 *   async ({ page, pageSize }) => fetchPosts({ page, pageSize }),
 *   { pageSize: 20 }
 * );
 *
 * @example
 * // Cursor-based
 * const conversations = infiniteAsyncChunk(
 *   async ({ cursor, pageSize }) => {
 *     const res = await listConversations({ cursor, limit: pageSize });
 *     return { data: res.data, hasMore: res.hasMore, cursor: res.nextCursor };
 *   },
 *   { pageSize: 20, cursorMode: { getNextCursor: (res) => res.cursor } }
 * );
 */
export function infiniteAsyncChunk<
  T,
  E extends Error = Error,
  P extends Record<string, any> = {}
>(
  fetcher: (params: P & { page?: number; pageSize: number; cursor?: string }) => Promise<{
    data: T[];
    hasMore?: boolean;
    total?: number;
    cursor?: string;
  }>,
  options: InfiniteAsyncChunkOptions<T, E> = {}
): InfiniteAsyncChunk<T, E, P> {
  const { pageSize = 10, cursorMode, ...rest } = options;

  return paginatedAsyncChunk<T[], E, P>(
    fetcher as any,
    {
      ...rest,
      pagination: {
        pageSize,
        mode: 'accumulate',
        initialPage: 1,
        cursorMode,
      },
    }
  );
}
