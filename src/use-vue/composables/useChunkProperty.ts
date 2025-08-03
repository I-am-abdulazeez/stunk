import { Chunk } from '../../core/core'
import { useChunkValue } from './useChunkValue'
import type { ChunkPropertyComposableReturn } from '../types'

/**
 * Vue composable for accessing specific properties of an object chunk
 * Optimized to only re-render when the specific property changes
 */
export function useChunkProperty<T extends Record<string, any>, K extends keyof T>(
  chunk: Chunk<T>,
  property: K
): ChunkPropertyComposableReturn<T, K> {
  // Use selector to extract property
  const propertyValue = useChunkValue(chunk, (obj) => obj[property])

  // Create setter function for the property
  const setProperty = (newValue: T[K]) => {
    const currentObject = chunk.get()
    chunk.set({
      ...currentObject,
      [property]: newValue
    })
  }

  return {
    value: propertyValue,
    set: setProperty
  }
}
