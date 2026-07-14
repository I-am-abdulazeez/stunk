import { shallowRef, getCurrentScope, onScopeDispose, type Ref } from "vue";
import { select } from "../../core/selector";
import type { Chunk, ReadOnlyChunk } from "../../core/core";

/**
 * Subscribes to a chunk and returns its current value as a reactive ref along
 * with setters, reset, and destroy. Accepts both writable `Chunk<T>` and
 * read-only `ReadOnlyChunk<T>` (e.g. derived chunks from `.derive()` or `select()`).
 *
 * The subscription is cleaned up automatically when the component (or effect
 * scope) that created it is disposed.
 *
 * For read-only chunks, the returned `set` and `reset` will be no-ops at
 * runtime — prefer `useChunkValue` for derived/read-only chunks.
 *
 * @example
 * const count = chunk(0);
 * const [value, setValue] = useChunk(count);
 *
 * @example
 * // Works with derived chunks too
 * const doubled = count.derive(n => n * 2);
 * const [value] = useChunk(doubled);
 */
export function useChunk<T, S = T>(
  chunk: Chunk<T> | ReadOnlyChunk<T>,
  selector?: (value: T) => S
) {
  const selectedChunk = selector ? select(chunk as Chunk<T>, selector) : chunk;

  const state = shallowRef<S>(selectedChunk.get() as S);

  const unsubscribe = selectedChunk.subscribe((newValue) => {
    state.value = newValue as S;
  });

  if (getCurrentScope()) {
    onScopeDispose(() => unsubscribe());
  }

  const set = (valueOrUpdater: T | ((currentValue: T) => T)) => {
    if ('set' in chunk) {
      (chunk as Chunk<T>).set(valueOrUpdater);
    }
  };

  const reset = () => {
    if ('reset' in chunk) {
      (chunk as Chunk<T>).reset();
    }
  };

  const destroy = () => {
    chunk.destroy();
  };

  return [state as Readonly<Ref<S>>, set, reset, destroy] as const;
}
