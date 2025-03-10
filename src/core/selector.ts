import { chunk, Chunk } from "./core";


export function select<T, S>(sourceChunk: Chunk<T>, selector: (value: T) => S extends Promise<any> ? never : S): Chunk<S> {
  const selected = chunk(recalculate())
  let unsubscribe: (() => void) | undefined = sourceChunk.subscribe(() => {
    const newVal = recalculate()
    if (!Object.is(newVal, selected.get())) {
      selected.set(newVal)
    }
  })

  function recalculate() { return selector(sourceChunk.get()) }

  return {
    ...selected,
    set: () => {
      throw new Error('Cannot set values directly on a selector. Modify the source chunk instead.');
    },
    destroy() {
      selected.destroy();
      unsubscribe?.()
      unsubscribe = undefined
    }
  };
}