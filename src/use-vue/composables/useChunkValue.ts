import { ref, onUnmounted, Ref } from 'vue'
import { Chunk } from '../../core/core'

/**
 * Read-only composable that returns only the chunk value as a Vue ref
 * Optimized for components that only need to read chunk state
 */
export function useChunkValue<T, S = T>(
  chunk: Chunk<T>,
  selector?: (value: T) => S
): Ref<S> {
  // Create reactive value
  const value = ref<S>(
    selector ? selector(chunk.get()) : (chunk.get() as unknown as S)
  ) as Ref<S>

  // Subscribe to chunk changes
  const unsubscribe = chunk.subscribe((newValue) => {
    const selectedValue = selector ? selector(newValue) : (newValue as unknown as S)
    if (value.value !== selectedValue) {
      value.value = selectedValue
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe()
  })

  return value
}
