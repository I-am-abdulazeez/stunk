import { shallowEqual } from "../utils";
import { chunk, Chunk, ReadOnlyChunk } from "./core";

export interface SelectOptions {
  /**
   * When `true`, uses shallow equality to compare selected values.
   * Prevents unnecessary subscriber notifications when the selected
   * object is a new reference but has the same property values.
   */
  useShallowEqual?: boolean;
}

/**
 * Creates a read-only derived chunk that tracks a slice of a source chunk.
 *
 * Only notifies subscribers when the selected value actually changes —
 * updates to unselected parts of the source are ignored.
 *
 * @param sourceChunk - The chunk to select from.
 * @param selector - A function that extracts the desired slice.
 * @param options.useShallowEqual - When `true`, uses shallow equality to
 *   compare selected values — prevents unnecessary updates for objects.
 * @returns A `ReadOnlyChunk<S>` that updates only when the selected value changes.
 *
 * @example
 * const user = chunk({ name: 'Alice', age: 30 });
 * const name = select(user, u => u.name);
 * name.get(); // 'Alice'
 *
 * // age changes — name subscribers are NOT notified
 * user.set({ name: 'Alice', age: 31 });
 *
 * @example
 * // Shallow equality — prevents updates when object values are the same
 * const details = select(user, u => u.details, { useShallowEqual: true });
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
