import { chunk, Chunk } from "./core";

export function select<T, S>(sourceChunk: Chunk<T>, selector: (value: T) => S): Chunk<S> {
  const initialValue = selector(sourceChunk.get());
  const selectedChunk = chunk(initialValue);
  let previousSelected = initialValue;

  // Subscribe to source changes with equality checking
  sourceChunk.subscribe((newValue) => {
    const newSelected = selector(newValue);

    // Only update if the selected value actually changed
    if (!Object.is(newSelected, previousSelected)) {
      previousSelected = newSelected;
      selectedChunk.set(newSelected);
    }
  });

  // Return read-only version of the chunk
  return {
    ...selectedChunk,
    // Prevent setting values directly on the selector
    set: () => {
      throw new Error('Cannot set values directly on a selector. Modify the source chunk instead.');
    }
  };
}
