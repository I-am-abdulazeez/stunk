import { computed } from "./computed";
import { chunk, Chunk } from "./core";


export function select<T, S>(sourceChunk: Chunk<T>, selector: (value: T) => S extends Promise<any> ? never : S): Chunk<S> {
  return {
    ...computed(() => selector(sourceChunk.get())),
    set: () => {
      throw new Error('Cannot set values directly on a selector. Modify the source chunk instead.');
    }
  };
}