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
  const [initialValue, initialDeps] = trackDependencies(computeFn);

  let cachedValue = initialValue;
  let dependencies = initialDeps;
  let isDirty = false;
  let unsubs: Array<() => void> = [];
  let isRecomputing = false; // ← FLAG TO PREVENT RE-ENTRANCY

  const computedChunk = chunk(cachedValue);
  const originalSet = computedChunk.set;

  const recompute = () => {
    if (isRecomputing) {
      return; // Already recomputing, skip
    }

    isRecomputing = true; // ← SET FLAG

    try {
      // Re-track dependencies on every computation
      const [newValue, newDeps] = trackDependencies(computeFn);

      // Update subscriptions if dependencies changed
      if (!shallowEqual(newDeps, dependencies)) {
        unsubs.forEach(unsub => unsub());
        unsubs = newDeps.map(dep =>
          dep.subscribe(() => {
            isDirty = true;
            recompute();
          })
        );
        dependencies = newDeps;
      }

      // Check if value changed
      const shouldUpdate =
        typeof newValue === 'object' && typeof cachedValue === 'object'
          ? !shallowEqual(newValue, cachedValue)
          : newValue !== cachedValue;

      if (shouldUpdate) {
        cachedValue = newValue;
        originalSet(newValue);
      }

      isDirty = false;
    } finally {
      isRecomputing = false; // ← ALWAYS RESET FLAG
    }
  };

  // Initial subscriptions
  unsubs = dependencies.map(dep =>
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
      throw new Error('Cannot set computed values directly. Modify source chunks instead.');
    },

    destroy: () => {
      unsubs.forEach(unsub => unsub());
      computedChunk.destroy?.();
    }
  };
}
