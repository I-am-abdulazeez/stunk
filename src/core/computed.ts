import { Chunk, chunk } from "./core";

// Helper type to extract the value type from a Chunk
export type ChunkValue<T> = T extends Chunk<infer U> ? U : never;

// Helper type to transform an array of Chunks into an array of their value types
export type DependencyValues<T extends Chunk<any>[]> = {
  [K in keyof T]: T[K] extends Chunk<any> ? ChunkValue<T[K]> : never;
};

type ActiveCompMap = Map<Chunk<any>, (() => void) | undefined>

export let activeComp: ActiveCompMap | undefined;

export interface Computed<T> extends Chunk<T> { }

export function computed<TResult>(
  computeFn: () => TResult extends Promise<any> ? never : TResult
): Computed<TResult> {
  const dependencies: ActiveCompMap = new Map()
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

  for (const [chunk, value] of dependencies) {
    dependencies.set(chunk, chunk.subscribe(recalculate))
  }

  return {
    ...computedChunk,
    set: () => {
      throw new Error('Cannot directly set a computed value');
    },
    destroy() {
      // Unsuscribe from dependencies' suscription
      for (const [, value] of dependencies) {
        value?.()
      }
      dependencies.clear()
      computedChunk.destroy();
    }
  };
}

/** @internal */
export function runAfterTick(func: () => void) {
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