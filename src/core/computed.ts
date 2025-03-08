import { Chunk, chunk } from "./core";

// Helper type to extract the value type from a Chunk
export type ChunkValue<T> = T extends Chunk<infer U> ? U : never;

// Helper type to transform an array of Chunks into an array of their value types
export type DependencyValues<T extends Chunk<any>[]> = {
  [K in keyof T]: T[K] extends Chunk<any> ? ChunkValue<T[K]> : never;
};

export let activeComp: Set<Chunk<any>> | undefined;

export interface Computed<T> extends Chunk<T> { }

export function computed<TDeps extends Chunk<any>[], TResult>(
  computeFn: () => TResult extends Promise<any> ? never : TResult
): Computed<TResult> {
  const dependencies: Set<Chunk<any>> = new Set()
  activeComp = dependencies
  let cachedValue: TResult = computeFn();
  activeComp = undefined
  const computedChunk = chunk(cachedValue);

  const recalculate = runAfterTick(() => {
    const newValue = computeFn();
    if (newValue !== cachedValue) {
      computedChunk.set(newValue);
      cachedValue = newValue
    };
  })

  dependencies.forEach((chunk) => {
    chunk.subscribe(recalculate)
  })

  return {
    ...computedChunk,
    set: () => {
      throw new Error('Cannot directly set a computed value');
    },
    destroy() {
      dependencies.clear()
      computedChunk.destroy();
    }
  };
}

function runAfterTick(func: () => void) {
  let isCalled = false;

  return () => {
    if (!isCalled) {
      isCalled = true
      Promise.resolve().then(() => {
        func();
        isCalled = false
      })
    }
  }
}