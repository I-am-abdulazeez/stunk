import { Chunk, chunk, batch } from "./core";

// Helper type to extract the value type from a Chunk
type ChunkValue<T> = T extends Chunk<infer U> ? U : never;

// Helper type to transform an array of Chunks into an array of their value types
type DependencyValues<T extends Chunk<any>[]> = {
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
  let isDirty = true;
  let cachedValue: TResult;

  // Get initial values from dependencies
  const initialValues = dependencies.map(dep => dep.get()) as DependencyValues<TDeps>;
  cachedValue = computeFn(...initialValues);

  const computedChunk = chunk(cachedValue);

  // Function to recalculate the computed value
  const recalculate = () => {
    const values = dependencies.map(dep => dep.get()) as DependencyValues<TDeps>;
    cachedValue = computeFn(...values);
    computedChunk.set(cachedValue);
    isDirty = false;
  };

  // Initial calculation
  recalculate();

  // Subscribe to dependencies and batch updates
  dependencies.forEach((dep, index) => {
    dep.subscribe((newValue) => {
      isDirty = true;
      batch(() => {
        const values = dependencies.map((d, i) =>
          i === index ? newValue : d.get()
        ) as DependencyValues<TDeps>;
        cachedValue = computeFn(...values);
        computedChunk.set(cachedValue);
      });
    });
  });

  // Lazy evaluation
  const originalGet = computedChunk.get;
  computedChunk.get = () => {
    if (isDirty) {
      recalculate();
    }
    return originalGet();
  };

  return {
    ...computedChunk,
    isDirty: () => isDirty,
    recompute: recalculate,
    set: () => {
      throw new Error('Cannot directly set a computed value');
    }
  };
}
