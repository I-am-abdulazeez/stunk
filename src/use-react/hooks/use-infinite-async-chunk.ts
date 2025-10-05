import { useEffect, useRef, useCallback } from 'react';
import { useAsyncChunk, UseAsyncChunkOptions } from './use-async-chunk';
import { PaginatedAsyncChunk } from '../../core/async-chunk';

interface UseInfiniteAsyncChunkOptions<P extends Record<string, any>>
  extends Omit<UseAsyncChunkOptions<P>, 'initialParams'> {
  /** Initial parameters (page and pageSize added automatically) */
  initialParams?: Omit<Partial<P>, 'page' | 'pageSize'>;
  /** Enable auto-loading on scroll (default: true) */
  autoLoad?: boolean;
  /** Intersection observer threshold (default: 1.0) */
  threshold?: number;
}

/**
 * Hook for infinite scroll functionality.
 * Automatically loads more data when scrolling to the bottom.
 */
export function useInfiniteAsyncChunk<
  T,
  E extends Error = Error,
  P extends Record<string, any> = {}
>(
  asyncChunk: PaginatedAsyncChunk<T[], E> & {
    setParams: (params: Partial<P>) => void;
  },
  options: UseInfiniteAsyncChunkOptions<P> = {}
) {
  const {
    initialParams,
    autoLoad = true,
    threshold = 1.0,
    ...restOptions
  } = options;

  const observerTarget = useRef<HTMLDivElement>(null);

  const result = useAsyncChunk(asyncChunk, {
    initialParams: {
      ...initialParams,
      page: 1,
      pageSize: asyncChunk.get().pagination?.pageSize || 10,
    } as any,
    ...restOptions,
  }) as any;

  const { loading, pagination, nextPage } = result;

  // Setup intersection observer for auto-loading
  useEffect(() => {
    if (!autoLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loading &&
          pagination?.hasMore
        ) {
          nextPage();
        }
      },
      { threshold }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loading, pagination?.hasMore, nextPage, autoLoad, threshold]);

  // Load more function for manual triggering
  const loadMore = useCallback(() => {
    if (!loading && pagination?.hasMore) {
      nextPage();
    }
  }, [loading, pagination?.hasMore, nextPage]);

  return {
    ...result,
    loadMore,
    observerTarget, // Ref to attach to scroll sentinel
    hasMore: pagination?.hasMore ?? false,
    isFetchingMore: loading && (result.data?.length ?? 0) > 0,
  };
}
