import { Chunk, chunk } from "./core";

// Helper type to extract the value type from a Chunk
export type ChunkValue<T> = T extends Chunk<infer U> ? U : never;

// Helper type to transform an array of Chunks into an array of their value types
export type DependencyValues<T extends Chunk<any>[]> = {
  [K in keyof T]: T[K] extends Chunk<any> ? ChunkValue<T[K]> : never;
};

export interface Computed<T> extends Chunk<T> {
  isDirty: () => boolean;
  recompute: () => void;
}

export function computed<TDeps extends Chunk<any>[], TResult>(
  dependencies: [...TDeps],
  computeFn: (...args: DependencyValues<TDeps>) => TResult
): Computed<TResult> {
  let isDirty = false; // Initialized to false
  let cachedValue: TResult = computeFn(...dependencies.map(d => d.get()) as DependencyValues<TDeps>);

  const recalculate = () => {
    const values = dependencies.map(dep => dep.get()) as DependencyValues<TDeps>;
    cachedValue = computeFn(...values);
    isDirty = false; // Reset to false after recomputation
  };

  const computedChunk = chunk(cachedValue);

  const originalGet = computedChunk.get;
  computedChunk.get = () => {
    if (isDirty) {
      recalculate();
      computedChunk.set(cachedValue); // Update the chunk value after recomputation
    }
    return cachedValue; // Return the cached value directly
  };

  const lastValues = dependencies.map(dep => dep.get());

  dependencies.forEach((dep, index) => {
    dep.subscribe(() => {
      const newValue = dep.get();
      if (newValue !== lastValues[index] && !isDirty) {
        lastValues[index] = newValue;
        isDirty = true;
      }
    });
  });

  return {
    ...computedChunk,
    isDirty: () => isDirty,
    recompute: () => {
      if (isDirty) {
        recalculate();
        computedChunk.set(cachedValue); // Update the chunk value after manual recomputation
      }
    },
    set: () => {
      throw new Error('Cannot directly set a computed value');
    }
  };
}
