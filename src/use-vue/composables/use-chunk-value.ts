import type { Ref } from "vue";
import { useChunk } from "./use-chunk";
import type { Chunk, ReadOnlyChunk } from "../../core/core";

/**
 * Subscribes to a chunk and returns only its current value as a readonly ref.
 * Accepts both writable `Chunk<T>` and read-only `ReadOnlyChunk<T>`
 * (e.g. derived chunks from `.derive()`, `select()`, or `computed()`).
 *
 * Prefer this over `useChunk` when you only need to read — it makes
 * the read-only intent explicit and works correctly with derived chunks.
 *
 * @example
 * const isAuthenticated = userChunk.derive(u => u !== null);
 * const auth = useChunkValue(isAuthenticated); // ✅ no type error
 *
 * @example
 * const total = computed(() => price.get() * qty.get());
 * const value = useChunkValue(total); // ✅ no type error
 */
export function useChunkValue<T, S = T>(
  chunk: Chunk<T> | ReadOnlyChunk<T>,
  selector?: (value: T) => S
): Readonly<Ref<S>> {
  const [value] = useChunk(chunk, selector);
  return value;
}
