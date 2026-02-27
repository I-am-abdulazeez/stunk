import { ref, computed, onUnmounted } from 'vue'
import { AsyncChunk, AsyncState } from '../../core/asyncChunk'
import type { AsyncChunkComposableReturn } from '../types'

/**
 * Vue composable for async chunks with full reactivity
 * Provides separated reactive refs for loading, error, and data states
 */
export function useAsyncChunk<T, E extends Error = Error>(
  asyncChunk: AsyncChunk<T, E>
): AsyncChunkComposableReturn<T, E> {
  // Create reactive refs for each state property
  const loading = ref<boolean>(asyncChunk.get().loading)
  const error = ref<E | null>(asyncChunk.get().error)
  const data = ref<T | null>(asyncChunk.get().data)
  const lastFetched = ref<number | undefined>(asyncChunk.get().lastFetched)

  // Subscribe to async chunk changes
  const unsubscribe = asyncChunk.subscribe((newState: AsyncState<T, E>) => {
    loading.value = newState.loading
    error.value = newState.error
    data.value = newState.data
    lastFetched.value = newState.lastFetched
  })

  // Cleanup subscription on unmount
  onUnmounted(() => {
    unsubscribe()
  })

  // Computed state for the complete async state
  const state = computed(() => ({
    loading: loading.value,
    error: error.value,
    data: data.value,
    lastFetched: lastFetched.value
  }))

  return {
    loading: loading as any,
    error: error as any,
    data: data as any,
    lastFetched,
    reload: () => asyncChunk.reload(),
    refresh: () => asyncChunk.refresh(),
    mutate: (mutator) => asyncChunk.mutate(mutator),
    reset: () => asyncChunk.reset(),
    state
  }
}

/**
 * Simplified version that returns the complete state as a single reactive object
 */
export function useAsyncChunkState<T, E extends Error = Error>(
  asyncChunk: AsyncChunk<T, E>
) {
  const state = ref<AsyncState<T, E>>(asyncChunk.get())

  // Subscribe to async chunk changes
  const unsubscribe = asyncChunk.subscribe((newState: AsyncState<T, E>) => {
    state.value = newState
  })

  // Cleanup subscription on unmount
  onUnmounted(() => {
    unsubscribe()
  })

  return {
    state,
    reload: () => asyncChunk.reload(),
    refresh: () => asyncChunk.refresh(),
    mutate: (mutator: (current: T | null) => T) => asyncChunk.mutate(mutator),
    reset: () => asyncChunk.reset(),
    // Computed getters for convenience
    loading: computed(() => state.value.loading),
    error: computed(() => state.value.error),
    data: computed(() => state.value.data),
    lastFetched: computed(() => state.value.lastFetched)
  }
}
