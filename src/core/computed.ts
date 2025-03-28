import { Chunk, chunk } from "./core";

import { shallowEqual } from "../utils";

// Helper type to extract the value type from a Chunk
export type ChunkValue<T> = T extends Chunk<infer U> ? U : never;

// Helper type to transform an array of Chunks into an array of their value types
export type DependencyValues<T extends Chunk<any>[]> = {
  [K in keyof T]: T[K] extends Chunk<any> ? ChunkValue<T[K]> : never;
};

export interface Computed<T> extends Chunk<T> {
  /**
  * Checks if the computed value needs to be recalculated due to dependency changes.
  * @returns True if the computed value is dirty, false otherwise.
  */
  isDirty: () => boolean;
  /** Manually forces recalculation of the computed value from its dependencies. */
  recompute: () => void;
}

export function computed<TDeps extends Chunk<any>[], TResult>(
  dependencies: [...TDeps],
  computeFn: (...args: DependencyValues<TDeps>) => TResult
): Computed<TResult> {
  const dependencyValues = dependencies.map(dep => dep.get());
  let cachedValue = computeFn(...dependencyValues as DependencyValues<TDeps>);

  const computedChunk = chunk(cachedValue);
  const originalSet = computedChunk.set;

  let isDirty = false;

  // Direct synchronous recomputation
  const recompute = () => {
    let hasChanges = false;

    for (let i = 0; i < dependencies.length; i++) {
      const newValue = dependencies[i].get();
      if (newValue !== dependencyValues[i]) {
        dependencyValues[i] = newValue;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const newValue = computeFn(...dependencyValues as DependencyValues<TDeps>);
      // Fast path for primitives only. Avoids shallowEqual for performance.
      if (newValue !== cachedValue) {
        // Only use shallowEqual for objects when needed
        if (typeof newValue !== 'object' || typeof cachedValue !== 'object' || !shallowEqual(newValue, cachedValue)) {
          cachedValue = newValue;
          originalSet(newValue);
        }
      }
      isDirty = false;
    }
  };

  const unsubs = dependencies.map(dep =>
    dep.subscribe(() => {
      isDirty = true;
      recompute();
    })
  );

  return {
    ...computedChunk,
    get: () => {
      if (isDirty) recompute();
      return cachedValue;
    },
    recompute,
    isDirty: () => isDirty,
    set: () => { throw new Error('Cannot set values directly on computed. Modify the source chunk instead.'); },
    reset: () => {
      dependencies.forEach(dep => {
        if (typeof dep.reset === 'function') {
          dep.reset();
        }
      });
      isDirty = true;
      recompute();
      return cachedValue;
    },
    destroy: () => { unsubs.forEach(unsub => unsub()); computedChunk.destroy?.(); }
  };
}
