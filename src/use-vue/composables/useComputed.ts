import { ref, onUnmounted, Ref } from 'vue'
import { computed as stunkComputed } from '../../core/computed'
import { Chunk } from '../../core/core'
import type { DependencyValues } from '../../core/computed'

/**
 * Vue composable for computed chunks that automatically updates when dependencies change
 */
export function useComputed<TDeps extends Chunk<any>[], TResult>(
  dependencies: [...TDeps],
  computeFn: (...args: DependencyValues<TDeps>) => TResult
): Ref<TResult> {
  // Create the computed chunk
  const computedChunk = stunkComputed(dependencies, computeFn)
  
  // Create reactive Vue ref
  const value = ref<TResult>(computedChunk.get()) as Ref<TResult>

  // Subscribe to computed chunk changes
  const unsubscribe = computedChunk.subscribe((newValue) => {
    if (value.value !== newValue) {
      value.value = newValue
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe()
    computedChunk.destroy()
  })

  return value
}
