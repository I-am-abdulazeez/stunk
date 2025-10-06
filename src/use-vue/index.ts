/**
 * Vue 3 Composables for Stunk State Management
 * 8 Essential composables for seamless Stunk integration
 */

// Core composables (Essential for any Vue app)
export { useChunk, useChunkState } from './composables/useChunk'
export { useChunkValue } from './composables/useChunkValue'
export { useAsyncChunk, useAsyncChunkState } from './composables/useAsyncChunk'
export { useComputed } from './composables/useComputed'
export { useBatch } from './composables/useBatch'

// Helper composables (Common patterns)
export { useChunkProperty } from './composables/useChunkProperty'
export { useDerive } from './composables/useDerive'
export { useChunkForm } from './composables/useChunkForm'

// Type definitions
export type { AsyncChunkComposableReturn } from './types'

// Re-export core Stunk functions for convenience
export { chunk, batch } from '../core/core'
export { asyncChunk } from '../core/asyncChunk'
export { computed } from '../core/computed'
