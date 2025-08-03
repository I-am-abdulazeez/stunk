import { batch } from '../../core/core'

/**
 * Vue composable for batching multiple chunk updates
 * Provides a reactive way to batch operations
 */
export function useBatch() {
  const batchUpdate = (callback: () => void) => {
    batch(callback)
  }

  return {
    batch: batchUpdate
  }
}
