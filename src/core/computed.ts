import { chunk, trackDependencies, ReadOnlyChunk } from "./core";
import { shallowEqual } from "../utils";

export interface Computed<T> extends ReadOnlyChunk<T> {
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
  let subscriberCount = 0;

  const computedChunk = chunk(cachedValue);

  const _recompute = () => {
    if (!isDirty) return;
    isDirty = false;

    const [newValue, newDeps] = trackDependencies(computeFn);

    // Check if dependencies have changed
    if (!shallowEqual(newDeps, dependencies)) {
      unsubs.forEach(unsub => unsub());

      // Subscribe to new dependencies
      unsubs = newDeps.map(dep =>
        dep.subscribe(() => {
          isDirty = true;

          // Recompute eagerly only if we have subscribers
          if (subscriberCount > 0) {
            _recompute();
          }
        })
      );
      dependencies = newDeps;
    }

    const shouldUpdate =
      typeof newValue === 'object' && typeof cachedValue === 'object'
        ? !shallowEqual(newValue, cachedValue)
        : newValue !== cachedValue;

    if (shouldUpdate) {
      cachedValue = newValue;
      computedChunk.set(newValue);
    }
  };

  // Initial subscriptions to dependencies
  unsubs = dependencies.map(dep =>
    dep.subscribe(() => {
      isDirty = true;

      // Recompute eagerly if we have subscribers
      if (subscriberCount > 0) {
        _recompute();
      }
    })
  );

  return {
    get: () => {
      if (isDirty) _recompute();
      return computedChunk.get();
    },
    peek: () => cachedValue,
    subscribe: (callback) => {
      const unsubscribe = computedChunk.subscribe(callback);
      subscriberCount++; // Only increment if successful

      return () => {
        subscriberCount--; //  Decrement first
        unsubscribe();
      };
    },
    derive: <D>(fn: (value: T) => D) => {
      return computed(() => fn(computedChunk.get()));
    },
    recompute: () => {
      isDirty = true;
      _recompute();
    },
    isDirty: () => isDirty,
    destroy: () => {
      unsubs.forEach(unsub => unsub());
      computedChunk.destroy();
      subscriberCount = 0;
    },
  };
}
