import { Chunk, chunk, trackDependencies } from "./core";
import { shallowEqual } from "../utils";

export interface Computed<T> extends Chunk<T> {
  /** Checks if the computed value needs to be recalculated due to dependency changes. */
  isDirty: () => boolean;
  /** Manually forces recalculation of the computed value from its dependencies. */
  recompute: () => void;
}

/**
 * Create a computed value that automatically tracks dependencies.
 * Dependencies are tracked by monitoring which chunks call .get() during execution.
 */
export function computed<T>(computeFn: () => T): Computed<T> {
  // Track dependencies on first run
  const [initialValue, dependencies] = trackDependencies(computeFn);

  let cachedValue = initialValue;
  const computedChunk = chunk(cachedValue);
  const originalSet = computedChunk.set;
  let isDirty = false;
  let lastDependencyValues = dependencies.map(dep => dep.get());

  const recompute = () => {
    // Check if any dependency changed
    let hasChanges = false;
    for (let i = 0; i < dependencies.length; i++) {
      const newValue = dependencies[i].get();
      if (newValue !== lastDependencyValues[i]) {
        lastDependencyValues[i] = newValue;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      // Re-run the compute function (dependencies are already tracked)
      const newValue = computeFn();

      // Skip update if value hasn't actually changed
      if (newValue !== cachedValue) {
        // Use shallowEqual for objects to avoid unnecessary updates
        const shouldUpdate = typeof newValue !== 'object' ||
          typeof cachedValue !== 'object' ||
          !shallowEqual(newValue, cachedValue);

        if (shouldUpdate) {
          cachedValue = newValue;
          originalSet(newValue);
        }
      }
      isDirty = false;
    }
  };

  // Subscribe to all tracked dependencies
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

    set: () => {
      throw new Error('Cannot set values directly on computed. Modify the source chunk instead.');
    },

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

    destroy: () => {
      unsubs.forEach(unsub => unsub());
      computedChunk.destroy?.();
    }
  };
}
