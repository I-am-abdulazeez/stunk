import type { ComputedRef } from "vue";
import { useChunk } from "./use-chunk";
import type { Chunk, ReadOnlyChunk } from "../../core/core";

/**
 * Subscribes to a chunk and returns only its current value as a read-only
 * `computed`. Accepts both writable `Chunk<T>` and read-only `ReadOnlyChunk<T>`
 * (e.g. derived chunks from `.derive()`, `select()`, or `computed()`).
 *
 * Prefer this over `useChunk` when you only need to read — it makes
 * the read-only intent explicit and works correctly with derived chunks.
 *
 * @example
 * const isAuthenticated = userChunk.derive(u => u !== null);
 * const auth = useChunkValue(isAuthenticated);
 *
 * @example
 * const total = computed(() => price.value * qty.value);
 * const value = useChunkValue(total);
 */
export function useChunkValue<T, S = T>(
  chunk: Chunk<T> | ReadOnlyChunk<T>,
  selector?: (value: T) => S
): ComputedRef<S> {
  const { value } = useChunk(chunk, selector);
  return value;
}
