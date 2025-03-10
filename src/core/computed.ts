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
  const initialValues = dependencies.map(dep => dep.get()) as DependencyValues<TDeps>;
  let cachedValue: TResult = computeFn(...initialValues);
  let isDirty = false;
  let lastDependencyValues = [...initialValues];

  const computedChunk = chunk<TResult>(cachedValue);
  const originalSet = computedChunk.set;

  const recalculate = () => {
    if (!isDirty) return;

    const currentValues = dependencies.map(dep => dep.get()) as DependencyValues<TDeps>;

    const hasChanges = currentValues.some((val, i) => val !== lastDependencyValues[i]);

    if (hasChanges) {
      lastDependencyValues = [...currentValues];
      const newValue = computeFn(...currentValues);

      if (newValue !== cachedValue) {
        cachedValue = newValue;
        originalSet(newValue);
      }
    }

    // Always clear the dirty flag after recalculation
    isDirty = false;
  };

  computedChunk.get = () => {
    if (isDirty) {
      recalculate();
    }
    return cachedValue;
  };

  const unsub = dependencies.map(dep =>
    dep.subscribe(() => {
      if (!isDirty) {
        isDirty = true;
        recalculate();
      }
    })
  );

  return {
    ...computedChunk,
    isDirty: () => isDirty,
    recompute: () => {
      isDirty = true;
      recalculate();
    },
    set: () => {
      throw new Error('Cannot set values directly on computed. Modify the source chunk instead.');
    },
    destroy: () => {
      unsub.forEach(cleanup => cleanup());
      if (computedChunk.destroy) {
        computedChunk.destroy();
      }
    }
  };
}
