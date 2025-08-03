import { reactive, computed } from 'vue'
import { Chunk } from '../../core/core'
import { useChunkValue } from './useChunkValue'
import type { ChunkFormComposableReturn } from '../types'

/**
 * Vue composable for simple form handling with chunk-based state
 * Provides validation and form state management
 */
export function useChunkForm<T extends Record<string, any>>(
  chunk: Chunk<T>,
  validators?: Partial<Record<keyof T, (value: any) => string | null>>
): ChunkFormComposableReturn<T> {
  // Track form state
  const formState = reactive({
    touched: {} as Record<keyof T, boolean>,
    errors: {} as Record<keyof T, string | null>
  })

  // Get current form values
  const values = useChunkValue(chunk)

  // Validation function
  const validateField = (field: keyof T, value: any): string | null => {
    const validator = validators?.[field]
    return validator ? validator(value) : null
  }

  // Set field value with validation
  const setField = (field: keyof T, value: any) => {
    const currentValues = chunk.get()
    
    // Update chunk
    chunk.set({
      ...currentValues,
      [field]: value
    });

    // Mark as touched
    (formState.touched as any)[field] = true;

    // Validate field
    (formState.errors as any)[field] = validateField(field, value)
  }

  // Reset form
  const reset = () => {
    chunk.reset()
    // Clear form state - use any to bypass reactive typing issues
    const currentValues = chunk.get()
    Object.keys(currentValues).forEach(key => {
      ;(formState.touched as any)[key] = false
      ;(formState.errors as any)[key] = null
    })
  }

  // Computed properties
  const isValid = computed(() => 
    Object.values(formState.errors as any).every((error: any) => !error)
  )

  const isDirty = computed(() => 
    Object.values(formState.touched as any).some((touched: any) => touched)
  )

  return {
    values,
    errors: formState.errors as Record<keyof T, string | null>,
    touched: formState.touched as Record<keyof T, boolean>,
    setField,
    reset,
    isValid,
    isDirty
  }
}
