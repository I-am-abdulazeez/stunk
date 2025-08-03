import { ref, onUnmounted, Ref } from 'vue'
import { Chunk } from '../../core/core'

/**
 * Core composable for integrating Stunk chunks with Vue reactivity
 * Provides bidirectional sync between chunk and Vue ref
 */
export function useChunk<T, S = T>(
  chunk: Chunk<T>,
  selector?: (value: T) => S
): [Ref<S>, (value: T | ((current: T) => T)) => void, () => void, () => void] {
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

  // Set function
  const set = (newValue: T | ((current: T) => T)) => {
    chunk.set(newValue)
  }

  // Reset function
  const reset = () => {
    chunk.reset()
  }

  // Destroy function
  const destroy = () => {
    chunk.destroy()
  }

  return [value, set, reset, destroy]
}

/**
 * Alternative composable that returns an object interface
 */
export function useChunkState<T, S = T>(
  chunk: Chunk<T>,
  selector?: (value: T) => S
) {
  const [value, set, reset, destroy] = useChunk(chunk, selector)

  return {
    value,
    set,
    reset,
    destroy,
    chunk
  }
}
