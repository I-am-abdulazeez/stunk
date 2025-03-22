import { Chunk, chunk } from "./core";
import { shallowEqual } from "../utils";

export function select<T, S>(sourceChunk: Chunk<T>, selector: (value: T) => S): Chunk<S> {
  let cachedValue = selector(sourceChunk.get());
  const selectorChunk = chunk(cachedValue);

  const update = () => {
    const newSourceValue = sourceChunk.get();
    const newValue = selector(newSourceValue);
    const isObject = typeof newValue === 'object' && newValue !== null;
    const isCachedObject = typeof cachedValue === 'object' && cachedValue !== null;
    if (
      (isObject && isCachedObject && !shallowEqual(newValue, cachedValue)) ||
      (!isObject && !isCachedObject && newValue !== cachedValue)
    ) {
      cachedValue = newValue;
      selectorChunk.set(newValue);
    }
  };

  const unsubscribe = sourceChunk.subscribe(update);

  return {
    ...selectorChunk,
    get: () => cachedValue,
    set: () => {
      throw new Error('Cannot set values directly on a selector. Modify the source chunk instead.');
    },
    destroy: () => {
      unsubscribe();
      selectorChunk.destroy();
    }
  };
}
