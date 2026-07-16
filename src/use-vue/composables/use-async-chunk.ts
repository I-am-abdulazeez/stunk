import {
  shallowReactive,
  toRefs,
  toValue,
  watch,
  getCurrentScope,
  onScopeDispose,
  type Ref,
  type MaybeRefOrGetter,
} from "vue";
import {
  AsyncChunk,
  AsyncStateWithPagination,
  PaginatedAsyncChunk,
  PaginationState,
} from "../../query/async-chunk";

// Type guard to check if chunk has pagination methods
function isPaginatedChunk<T, E extends Error>(
  c: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>
): c is PaginatedAsyncChunk<T, E> {
  return 'nextPage' in c;
}

function hasSetParams<T, E extends Error, P extends Record<string, any>>(
  c: AsyncChunk<T, E> | (AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void })
): c is AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void } {
  return 'setParams' in c;
}

function hasClearParams<T, E extends Error>(
  c: AsyncChunk<T, E>
): c is AsyncChunk<T, E> & { clearParams: () => void } {
  return 'clearParams' in c;
}

function hasScopedFactory<T, E extends Error>(
  c: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>
): c is (AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>) & {
  __scopedFactory: () => AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>;
} {
  return '__scopedFactory' in c;
}

export interface UseAsyncChunkResult<T, E extends Error, P extends Record<string, any>> {
  data: Readonly<Ref<T | null>>;
  loading: Readonly<Ref<boolean>>;
  error: Readonly<Ref<E | null>>;
  lastFetched: Readonly<Ref<number | undefined>>;
  isPlaceholderData: Readonly<Ref<boolean>>;
  reload: (params?: Partial<P>) => Promise<void>;
  refresh: (params?: Partial<P>) => Promise<void>;
  mutate: (mutator: (currentData: T | null) => T | null) => void;
  reset: (refetch?: boolean) => void;
}

export interface UseAsyncChunkResultWithParams<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResult<T, E, P> {
  setParams: (params: Partial<Record<keyof P, P[keyof P] | null>>) => void;
  clearParams: () => void;
}

export interface UseAsyncChunkResultWithPagination<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResult<T, E, P> {
  pagination: Readonly<Ref<PaginationState | undefined>>;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  resetPagination: () => Promise<void>;
}

export interface UseAsyncChunkResultWithParamsAndPagination<T, E extends Error, P extends Record<string, any>>
  extends UseAsyncChunkResultWithParams<T, E, P>,
  Omit<UseAsyncChunkResultWithPagination<T, E, P>, keyof UseAsyncChunkResult<T, E, P>> { }

export interface UseAsyncChunkOptions<T = any, E extends Error = Error, P extends Record<string, any> = {}> {
  /**
   * Parameters to pass to the fetcher. Accepts a plain object, a ref, or a
   * getter — when the resolved value changes, the chunk automatically
   * re-fetches with the new values.
   */
  params?: MaybeRefOrGetter<Partial<P> | undefined>;
  /**
   * Force a fetch on mount even when the chunk has no params.
   * Ignored if params is provided.
   * (default: false)
   */
  fetchOnMount?: boolean;
  /**
   * Whether the chunk is enabled. Accepts a plain boolean, a ref, or a
   * getter — flipping to true triggers a fetch, flipping to false cancels
   * any in-flight request.
   * If false, the chunk will not fetch data.
   * (default: true)
   */
  enabled?: MaybeRefOrGetter<boolean>;
  /**
   * Called after every successful fetch at the composable level.
   * Has full access to component context — safe to call router.push(), etc.
   */
  onSuccess?: (data: T) => void;
  /**
   * Called when a fetch fails at the composable level.
   * Has full access to component context — safe to call router.push(), etc.
   */
  onError?: (error: E) => void;
}

// Overloads
export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: PaginatedAsyncChunk<T, E> & { setParams: (params: Partial<P>) => void },
  options?: UseAsyncChunkOptions<T, E, P>
): UseAsyncChunkResultWithParamsAndPagination<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: PaginatedAsyncChunk<T, E>,
  options?: UseAsyncChunkOptions<T, E, P>
): UseAsyncChunkResultWithPagination<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: AsyncChunk<T, E> & { setParams: (params: Partial<P>) => void },
  options?: UseAsyncChunkOptions<T, E, P>
): UseAsyncChunkResultWithParams<T, E, P>;

export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunk: AsyncChunk<T, E>,
  options?: UseAsyncChunkOptions<T, E, P>
): UseAsyncChunkResult<T, E, P>;

/**
 * Subscribes to an async chunk and returns its state as reactive refs along
 * with reload, refresh, mutate, and reset. Chunks created with params expose
 * setParams/clearParams; paginated chunks expose the pagination methods.
 *
 * State is held in a single `shallowReactive` object and exposed via `toRefs`,
 * so every returned ref stays in sync with the chunk while remaining
 * individually consumable in templates.
 *
 * @example
 * const { data, loading, error, reload } = useAsyncChunk(userChunk);
 *
 * @example
 * // Reactive params — refetches when the ref changes
 * const search = ref('');
 * const { data } = useAsyncChunk(postsChunk, { params: () => ({ search: search.value }) });
 */
export function useAsyncChunk<T, E extends Error = Error, P extends Record<string, any> = {}>(
  asyncChunkArg: AsyncChunk<T, E> | PaginatedAsyncChunk<T, E>,
  options: UseAsyncChunkOptions<T, E, P> = {}
) {
  // Resolve to a per-component instance if this chunk opted into scoping —
  // completely invisible to the caller, same chunk reference passed in either way.
  // Composables run once per component setup, so no memoization is needed.
  const asyncChunk = hasScopedFactory(asyncChunkArg)
    ? asyncChunkArg.__scopedFactory()
    : asyncChunkArg;

  const { fetchOnMount = false, onSuccess, onError } = options;

  const isEnabled = () => toValue(options.enabled) ?? true;
  const currentParams = () => toValue(options.params);

  const initialState = asyncChunk.get();

  // Single reactive state object per review feedback — exposed via toRefs.
  // Optional keys are seeded explicitly so toRefs creates a ref for each.
  const state = shallowReactive<{
    data: T | null;
    loading: boolean;
    error: E | null;
    lastFetched: number | undefined;
    isPlaceholderData: boolean;
    pagination: PaginationState | undefined;
  }>({
    data: initialState.data,
    loading: initialState.loading,
    error: initialState.error,
    lastFetched: initialState.lastFetched,
    isPlaceholderData: initialState.isPlaceholderData ?? false,
    pagination: initialState.pagination,
  });

  // Assign keys explicitly — newState may omit optional keys, and a bare
  // Object.assign would leave stale values behind.
  const syncState = (newState: AsyncStateWithPagination<T, E>) => {
    state.data = newState.data;
    state.loading = newState.loading;
    state.error = newState.error;
    state.lastFetched = newState.lastFetched;
    state.isPlaceholderData = newState.isPlaceholderData ?? false;
    state.pagination = newState.pagination;
  };

  let prevState = initialState;

  const unsubscribe = asyncChunk.subscribe((newState) => {
    if (prevState.loading && !newState.loading && !newState.error && newState.data !== null) {
      onSuccess?.(newState.data as T);
    }

    if (prevState.loading && !newState.loading && newState.error) {
      onError?.(newState.error as E);
    }

    prevState = newState;
    syncState(newState);
  });

  const fetchWithParams = (params: Partial<P> | undefined) => {
    if (params && hasSetParams(asyncChunk)) {
      asyncChunk.setParams(params);
    } else {
      asyncChunk.reload();
    }
  };

  // Initial fetch — same semantics as the react hook's mount effect
  const params = currentParams();
  if (params && hasSetParams(asyncChunk)) {
    if (isEnabled()) asyncChunk.setParams(params);
  } else if (isEnabled() && (fetchOnMount || (initialState.data === null && !initialState.loading))) {
    asyncChunk.reload();
  }

  // One watcher covers both enabled flips and param changes — when they land
  // together, the enabled branch fetches with the fresh params, so there is
  // no duplicate fetch to guard against.
  watch(
    [isEnabled, () => {
      const p = currentParams();
      return p ? JSON.stringify(p) : null;
    }],
    ([enabled, paramsKey], [wasEnabled, prevParamsKey]) => {
      if (!wasEnabled && enabled) {
        // enabled flipped true — fetch with current params
        fetchWithParams(currentParams());
        return;
      }

      if (wasEnabled && !enabled) {
        // enabled flipped false — cancel in-flight + clear loading
        (asyncChunk as any).cancel?.();
        return;
      }

      if (enabled && paramsKey !== prevParamsKey) {
        const freshParams = currentParams();
        if (freshParams && hasSetParams(asyncChunk)) {
          asyncChunk.setParams(freshParams);
        }
      }
    }
  );

  if (getCurrentScope()) {
    onScopeDispose(() => {
      unsubscribe();
      asyncChunk.cleanup();
    });
  }

  const {
    data, loading, error, lastFetched, isPlaceholderData, pagination,
  } = toRefs(state);

  const result: UseAsyncChunkResult<T, E, P> = {
    data,
    loading,
    error,
    lastFetched,
    isPlaceholderData,
    reload: (params?: Partial<P>) => asyncChunk.reload(params),
    refresh: (params?: Partial<P>) => asyncChunk.refresh(params),
    mutate: (mutator: (currentData: T | null) => T | null) => asyncChunk.mutate(mutator),
    reset: (refetch?: boolean) => asyncChunk.reset(refetch),
  };

  if (hasSetParams(asyncChunk)) {
    const withParams = result as UseAsyncChunkResultWithParams<T, E, P>;
    withParams.setParams = (params) => asyncChunk.setParams(params);
    withParams.clearParams = () => {
      if (hasClearParams(asyncChunk)) asyncChunk.clearParams();
    };
  }

  if (isPaginatedChunk(asyncChunk)) {
    const paginatedResult = result as UseAsyncChunkResultWithPagination<T, E, P>;
    paginatedResult.pagination = pagination;
    paginatedResult.nextPage = () => asyncChunk.nextPage();
    paginatedResult.prevPage = () => asyncChunk.prevPage();
    paginatedResult.goToPage = (page: number) => asyncChunk.goToPage(page);
    paginatedResult.resetPagination = () => asyncChunk.resetPagination();
  }

  return result;
}
