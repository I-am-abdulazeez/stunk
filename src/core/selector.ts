import { shallowEqual } from "../utils";
import { chunk, Chunk, ReadOnlyChunk } from "./core";

export interface SelectOptions {
  /**
   * Configuration options for selector functions.
   * @property {boolean} [useShallowEqual] - When true, performs a shallow equality check
   * on the derived selector results to prevent unnecessary updates.
   */
  useShallowEqual?: boolean;
}

/**
 * Creates a derived read-only chunk based on a selector function.
 * @param sourceChunk The source chunk to derive from.
 * @param selector A function that extracts part of the source value.
 * @param options Optional settings for shallow equality comparison.
 * @returns A read-only derived chunk.
 */
export function select<T, S>(
  sourceChunk: Chunk<T> | ReadOnlyChunk<T>,
  selector: (value: T) => S,
  options: SelectOptions = {}
): ReadOnlyChunk<S> {
  const { useShallowEqual = false } = options;

  const initialValue = sourceChunk.get();
  let currentResult = selector(initialValue);

  const derivedChunk = chunk(currentResult);

  const update = () => {
    const sourceValue = sourceChunk.get();
    const newResult = selector(sourceValue);

    // Check if the selected result has changed
    const resultChanged = useShallowEqual
      ? !shallowEqual(newResult, currentResult)
      : newResult !== currentResult;

    if (resultChanged) {
      currentResult = newResult;
      derivedChunk.set(newResult);
    }
  };

  const unsubscribe = sourceChunk.subscribe(update);

  const { set: _omitSet, reset: _omitReset, ...chunkWithoutSetReset } = derivedChunk;

  return {
    ...chunkWithoutSetReset,
    derive: <D>(fn: (value: S) => D) => select(derivedChunk, fn, options),
    destroy: () => {
      unsubscribe();
      derivedChunk.destroy();
    }
  };
}
