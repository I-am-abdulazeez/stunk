import {
  ref,
  computed,
  watch,
  watchEffect,
  getCurrentScope,
  onScopeDispose,
  type Ref,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue";
import { useAsyncChunk, UseAsyncChunkOptions, UseAsyncChunkResultWithParamsAndPagination } from './use-async-chunk';
import { InfiniteAsyncChunk } from '../../query/infinite-async-chunk';
import type { PaginationState } from '../../query/async-chunk';

export interface UseInfiniteAsyncChunkOptions<T, E extends Error, P extends Record<string, any>>
  extends Omit<UseAsyncChunkOptions<T[], E, P>, 'params'> {
  /** Reactive parameters — page and pageSize are managed automatically. Re-fetches from page 1 when these change. */
  params?: MaybeRefOrGetter<Omit<Partial<P>, 'page' | 'pageSize'> | undefined>;
  /** Automatically load next page when sentinel enters viewport (default: true) */
  autoLoad?: boolean;
  /** IntersectionObserver threshold — 0.0 to 1.0 (default: 1.0) */
  threshold?: number;
}

export interface UseInfiniteAsyncChunkResult<T, E extends Error, P extends Record<string, any>> {
  data: Readonly<Ref<T[] | null>>;
  loading: Readonly<Ref<boolean>>;
  error: Readonly<Ref<E | null>>;
  lastFetched: Readonly<Ref<number | undefined>>;
  isPlaceholderData: Readonly<Ref<boolean>>;
  pagination: Readonly<Ref<PaginationState | undefined>>;
  /** True when fetching a new page while existing data is already loaded */
  isFetchingMore: ComputedRef<boolean>;
  /** True if more pages are available */
  hasMore: ComputedRef<boolean>;
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
  /** Bind this to a sentinel element at the bottom of your list via a template ref */
  observerTarget: Ref<HTMLElement | null>;
}

/**
 * Subscribes to an infinite async chunk and wires up automatic infinite scroll.
 *
 * Bind `observerTarget` to a sentinel element at the bottom of your list —
 * the next page loads automatically when it enters the viewport.
 * Use `loadMore()` for manual triggering.
 *
 * @param chunk - An `InfiniteAsyncChunk` instance.
 * @param options.autoLoad - Auto-load on scroll (default: true).
 * @param options.threshold - IntersectionObserver threshold 0.0–1.0 (default: 1.0).
 * @param options.params - Reactive params excluding `page` and `pageSize`. Resets to page 1 and refetches when changed.
 *
 * @example
 * <script setup>
 * const { data, loading, hasMore, observerTarget, loadMore } = useInfiniteAsyncChunk(postsChunk);
 * </script>
 *
 * <template>
 *   <Post v-for="post in data" :key="post.id" v-bind="post" />
 *   <div ref="observerTarget" />
 * </template>
 *
 * @example
 * // Reactive search — resets to page 1 automatically when searchTerm changes
 * const { data } = useInfiniteAsyncChunk(companiesChunk, {
 *   params: () => ({ search: searchTerm.value }),
 * });
 */
export function useInfiniteAsyncChunk<
  T,
  E extends Error = Error,
  P extends Record<string, any> = {}
>(
  chunk: InfiniteAsyncChunk<T, E, P>,
  options: UseInfiniteAsyncChunkOptions<T, E, P> = {}
): UseInfiniteAsyncChunkResult<T, E, P> {
  const {
    params,
    autoLoad = true,
    threshold = 1.0,
    fetchOnMount,
    enabled,
    onSuccess,
    onError,
  } = options;

  // Pass user params only — never page/pageSize, those are owned by the chunk
  const result = useAsyncChunk(chunk, {
    params: params as MaybeRefOrGetter<Partial<P> | undefined>,
    fetchOnMount,
    enabled,
    onSuccess,
    onError,
  }) as unknown as UseAsyncChunkResultWithParamsAndPagination<T[], E, P>;

  const { data, loading, pagination, nextPage } = result;

  const hasMore = computed(() => pagination.value?.hasMore ?? false);

  const observerTarget = ref<HTMLElement | null>(null);

  // The observer only reports visibility into a ref — a watchEffect combines
  // it with loading/hasMore. IntersectionObserver notifies on threshold
  // crossings only, so acting inside its callback deadlocks when the sentinel
  // is already visible while the initial page loads: the guard rejects the
  // one notification and no further crossing ever happens. Tracking
  // visibility reactively means the effect re-fires when loading settles,
  // cascading pages until the sentinel leaves the viewport or hasMore is
  // exhausted.
  if (autoLoad && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    const isIntersecting = ref(false);

    const observer = new IntersectionObserver(
      (entries) => {
        isIntersecting.value = entries[0].isIntersecting;
      },
      { threshold }
    );

    watch(observerTarget, (el, prevEl) => {
      if (prevEl) observer.unobserve(prevEl);
      if (el) {
        observer.observe(el);
      } else {
        isIntersecting.value = false;
      }
    });

    watchEffect(() => {
      if (isIntersecting.value && !loading.value && hasMore.value) {
        nextPage();
      }
    });

    if (getCurrentScope()) {
      onScopeDispose(() => observer.disconnect());
    }
  }

  // Manual trigger — consistent with the observer logic
  const loadMore = () => {
    if (!loading.value && hasMore.value) {
      nextPage();
    }
  };

  // isFetchingMore: loading a new page while data already exists and pagination
  // is past page 1 — distinct from the initial load
  const isFetchingMore = computed(() =>
    loading.value &&
    data.value !== null &&
    data.value.length > 0 &&
    (pagination.value?.page ?? 1) > 1
  );

  return {
    ...result,
    mutate: result.mutate as (mutator: (currentData: T[] | null) => T[]) => void,
    isFetchingMore,
    hasMore,
    loadMore,
    observerTarget,
  };
}
