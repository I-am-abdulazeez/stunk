import { shallowEqual } from "../utils";
import { Chunk, chunk } from "./core";

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
  sourceChunk: Chunk<T>,
  selector: (value: T) => S,
  options: SelectOptions = {}
): Chunk<S> {
  const { useShallowEqual = false } = options;

  let prevSourceValue = sourceChunk.get();
  let currentResult = selector(prevSourceValue);

  const derivedChunk = chunk(currentResult);

  const update = () => {
    const newSourceValue = sourceChunk.get();
    const newResult = selector(newSourceValue);

    // Always update the reference to source value
    prevSourceValue = newSourceValue;

    // Check if the result has changed
    const resultChanged = useShallowEqual
      ? !shallowEqual(newResult, currentResult)
      : newResult !== currentResult;

    if (resultChanged) {
      currentResult = newResult;
      derivedChunk.set(newResult);
    }
  };

  const unsubscribe = sourceChunk.subscribe(update);

  return {
    get: () => derivedChunk.get(),
    set: () => {
      throw new Error('Cannot set values directly on a selector. Modify the source chunk instead.');
    },
    subscribe: derivedChunk.subscribe,
    derive: <D>(fn: (value: S) => D) => select(derivedChunk, fn, options), // Pass options to nested selectors
    reset: () => {
      throw new Error('Cannot reset a selector chunk. Reset the source chunk instead.');
    },
    destroy: () => {
      unsubscribe();
      derivedChunk.destroy();
    }
  };
}
