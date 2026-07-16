import { shallowRef, computed, getCurrentScope, onScopeDispose, type ComputedRef, type WritableComputedRef } from "vue";
import { select } from "../../core/selector";
import type { Chunk, ReadOnlyChunk } from "../../core/core";

export interface UseChunkResult<T> {
  /** Reactive value — read via `.value`, write via `.value = x` (or an updater function). Works directly with `v-model`. */
  value: WritableComputedRef<T, T | ((currentValue: T) => T)>;
  /** Reset the chunk to its initial value. */
  reset: () => void;
  /** Destroy the chunk, clearing all its subscribers. */
  destroy: () => void;
}

export interface UseChunkReadOnlyResult<S> {
  /** Reactive, read-only value. Assigning to `.value` is a no-op (dev builds warn, matching Vue's own read-only computed refs). */
  value: ComputedRef<S>;
  /** Reset the underlying chunk to its initial value. No-op when the chunk itself is read-only. */
  reset: () => void;
  /** Destroy the underlying chunk — or, when a selector was used, the internal per-component chunk created for it. */
  destroy: () => void;
}

/**
 * Subscribes to a writable chunk and returns its value as a writable `computed`,
 * along with `reset` and `destroy`. Assigning `value.value = x` updates the chunk —
 * `value` binds directly to `v-model`, no separate setter needed.
 *
 * Passing a `selector`, or a read-only `ReadOnlyChunk<T>` (e.g. from `.derive()` or
 * `select()`), always returns a read-only `value` — prefer `useChunkValue` for those.
 *
 * The subscription is cleaned up automatically when the component (or effect
 * scope) that created it is disposed.
 *
 * @example
 * const count = chunk(0);
 * const { value, reset } = useChunk(count);
 * value.value++;        // triggers chunk.set
 *
 * @example
 * <input v-model="value" />
 *
 * @example
 * // Read-only when selecting a slice — prefer useChunkValue for this
 * const user = chunk({ name: 'Alice', age: 30 });
 * const { value: name } = useChunk(user, u => u.name);
 */
export function useChunk<T>(chunk: Chunk<T>): UseChunkResult<T>;
export function useChunk<T, S = T>(
  chunk: Chunk<T> | ReadOnlyChunk<T>,
  selector?: (value: T) => S
): UseChunkReadOnlyResult<S>;
export function useChunk<T, S = T>(
  chunk: Chunk<T> | ReadOnlyChunk<T>,
  selector?: (value: T) => S
): UseChunkResult<T> | UseChunkReadOnlyResult<S> {
  const selectedChunk = selector ? select(chunk as Chunk<T>, selector) : chunk;
  const isWritable = !selector && 'set' in chunk;

  const state = shallowRef<S>(selectedChunk.get() as S);

  const unsubscribe = selectedChunk.subscribe((newValue) => {
    state.value = newValue as S;
  });

  if (getCurrentScope()) {
    onScopeDispose(() => {
      unsubscribe();
      // The selected chunk is an internal derived chunk owned by this
      // composable — destroy() unsubscribes it from the source chunk too.
      // Without this, every mount/unmount with a selector leaks a
      // subscription on the source chunk.
      if (selector) {
        selectedChunk.destroy();
      }
    });
  }

  const value = isWritable
    ? computed({
      get: () => state.value,
      set: (valueOrUpdater: T | ((currentValue: T) => T)) => {
        (chunk as Chunk<T>).set(valueOrUpdater);
      },
    })
    : computed(() => state.value);

  const reset = () => {
    if ('reset' in chunk) {
      (chunk as Chunk<T>).reset();
    }
  };

  const destroy = () => {
    selectedChunk.destroy();
  };

  return { value, reset, destroy } as UseChunkResult<T> | UseChunkReadOnlyResult<S>;
}
