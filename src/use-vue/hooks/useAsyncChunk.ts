import { onBeforeUnmount, ref } from "vue"

import { AsyncChunk } from "../../core/asyncChunk";

/**
 * A hook that handles asynchronous state with built-in reactivity.
 * Provides loading, error, and data states.
 */
export function useAsyncChunk<T, E>(asyncChunk: AsyncChunk<T, E>) {
  const loading = ref(true);
  const data = ref<T | null>()
  const error = ref<E | null>()

  const unsubscribe = asyncChunk.subscribe((newState) => {
    const { data: _data, error: _error, loading: _loading } = newState
    data.value = _data
    error.value = _error
    loading.value = _loading
  })


  const reload = () => asyncChunk.reload();
  const mutate = (mutator: (currentData: T | null) => T) => asyncChunk.mutate(mutator)
  const reset = () => asyncChunk.reset();

  onBeforeUnmount(() => {
    unsubscribe()
  })

  return {
    data,
    loading,
    error,
    reload,
    mutate,
    reset
  };
}
