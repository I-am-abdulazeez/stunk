import { Chunk, chunk } from "./core";

// Helper type to extract the value type from a Chunk
export type ChunkValue<T> = T extends Chunk<infer U> ? U : never;

// Helper type to transform an array of Chunks into an array of their value types
export type DependencyValues<T extends Chunk<any>[]> = {
  [K in keyof T]: T[K] extends Chunk<any> ? ChunkValue<T[K]> : never;
};

type ActiveCompMap = Map<Chunk<any>, (() => void) | undefined>

export let activeComp: ActiveCompMap | undefined;

export interface Computed<T> extends Chunk<T> {
  isDirty: () => boolean
  recompute: () => void
}

export function computed<TResult>(
  computeFn: () => TResult extends Promise<any> ? never : TResult
): Computed<TResult> {
  const dependencies: ActiveCompMap = new Map()
  let isDirty = false;
  activeComp = dependencies
  let cachedValue: TResult = computeFn();
  activeComp = undefined
  const computedChunk = chunk(cachedValue);

  const revalidate = () => {
    const newValue = computeFn();
    if (newValue !== cachedValue) {
      computedChunk.set(newValue);
      cachedValue = newValue
    };
  }

  const recalculate = runAfterTick(() => {
    if (isDirty) {
      revalidate()
      isDirty = false
    }
  })

  const recompute = () => {
    isDirty = true
    recalculate()
  }

  for (const [chunk] of dependencies) {
    dependencies.set(chunk, chunk.subscribe(recompute))
  }

  return {
    ...computedChunk,
    get() {
      if (isDirty) {
        revalidate()
        isDirty = false
      }
      return computedChunk.get()
    },
    set: () => {
      throw new Error('Cannot set values directly on computed. Modify the source chunk instead.');
    },
    destroy() {
      // Unsuscribe from dependencies' suscription
      for (const [, value] of dependencies) {
        value?.()
      }
      dependencies.clear()
      computedChunk.destroy();
    },
    isDirty: () => isDirty,
    recompute,
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