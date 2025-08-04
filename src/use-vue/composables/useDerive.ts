import { ref, onUnmounted, Ref } from 'vue'
import { Chunk } from '../../core/core'

/**
 * Creates a derived chunk using the chunk's derive method and makes it reactive in Vue
 */
export function useDerive<T, D>(
  chunk: Chunk<T>,
  deriveFn: (value: T) => D
): Ref<D> {
  // Create derived chunk
  const derivedChunk = chunk.derive(deriveFn)
  
  // Create reactive value
  const value = ref<D>(derivedChunk.get()) as Ref<D>

  // Subscribe to derived chunk changes
  const unsubscribe = derivedChunk.subscribe((newValue) => {
    if (value.value !== newValue) {
      value.value = newValue
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe()
    derivedChunk.destroy()
  })

  return value
}