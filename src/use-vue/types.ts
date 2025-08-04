import { Ref, ComputedRef } from 'vue'
import { AsyncState } from '../core/asyncChunk'

export interface AsyncChunkComposableReturn<T, E extends Error = Error> {
  /** Reactive loading state */
  loading: Ref<boolean>
  /** Reactive error state */
  error: Ref<E | null>
  /** Reactive data state */
  data: Ref<T | null>
  /** Last fetched timestamp */
  lastFetched: Ref<number | undefined>
  /** Reload function */
  reload: () => Promise<void>
  /** Refresh function */
  refresh: () => Promise<void>
  /** Mutate function */
  mutate: (mutator: (current: T | null) => T) => void
  /** Reset function */
  reset: () => void
  /** Complete async state as computed */
  state: ComputedRef<AsyncState<T, E>>
}

export interface ChunkFormComposableReturn<T extends Record<string, any>> {
  values: Ref<T>
  errors: Record<keyof T, string | null>
  touched: Record<keyof T, boolean>
  setField: (field: keyof T, value: any) => void
  reset: () => void
  isValid: ComputedRef<boolean>
  isDirty: ComputedRef<boolean>
}

export interface ChunkPropertyComposableReturn<T extends Record<string, any>, K extends keyof T> {
  value: Ref<T[K]>
  set: (newValue: T[K]) => void
}
