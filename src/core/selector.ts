import { Chunk } from "./core";
import { computed } from "./computed";


export function select<T, S>(sourceChunk: Chunk<T>, selector: (value: T) => S): Chunk<S> {
  return {
    ...computed([sourceChunk], (value) => selector(value)),
    set: () => {
      throw new Error('Cannot set values directly on a selector. Modify the source chunk instead.');
    },
  };
}
