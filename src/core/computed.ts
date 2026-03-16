import { chunk, trackDependencies, ReadOnlyChunk } from "./core";
import { shallowEqual } from "../utils";

export interface Computed<T> extends ReadOnlyChunk<T> {
  /** Checks if the computed value needs to be recalculated due to dependency changes. */
  isDirty: () => boolean;
  /** Manually forces recalculation of the computed value from its dependencies. */
  recompute: () => void;
}

/**
 * Creates a derived value that automatically tracks its dependencies and
 * recomputes lazily when any of them change.
 *
 * Dependencies are discovered automatically — any chunk whose `.get()` is
 * called inside `computeFn` is tracked. Use `.peek()` inside the function
 * to read a value without tracking it as a dependency.
 *
 * The computed value is cached and only recalculated when a dependency
 * changes and the value is accessed (lazy) or when active subscribers exist
 * (eager). Object values are compared with shallow equality to prevent
 * unnecessary subscriber notifications.
 *
 * @param computeFn - A pure function that derives the computed value.
 * @returns A read-only `Computed<T>` with `isDirty()`, `recompute()`, `derive()`, `subscribe()`, `peek()`, and `destroy()`.
 *
 * @example
 * const price = chunk(100);
 * const qty = chunk(3);
 *
 * const total = computed(() => price.get() * qty.get());
 * total.get(); // 300
 *
 * price.set(200);
 * total.get(); // 600
 *
 * @example
 * // peek() does not create a dependency
 * const taxRate = chunk(0.1);
 * const subtotal = computed(() => price.get() * qty.peek()); // qty not tracked
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

    // Re-subscribe if dependencies have changed
    if (!shallowEqual(newDeps, dependencies)) {
      unsubs.forEach(unsub => unsub());
      unsubs = newDeps.map(dep =>
        dep.subscribe(() => {
          isDirty = true;
          if (subscriberCount > 0) _recompute();
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
      if (subscriberCount > 0) _recompute();
    })
  );

  // Forward-declare so derive() can reference the lazy get()
  let computedInstance: Computed<T>;

  computedInstance = {
    get: () => {
      if (isDirty) _recompute();
      return computedChunk.get();
    },

    peek: () => cachedValue,

    subscribe: (callback) => {
      const unsubscribe = computedChunk.subscribe(callback);
      subscriberCount++;
      return () => {
        subscriberCount = Math.max(0, subscriberCount - 1);
        unsubscribe();
      };
    },

    derive: <D>(fn: (value: T) => D) => {
      // Incrementing subscriberCount ensures the parent recomputes eagerly
      // when its dependencies change — so computedChunk stays fresh for
      // the derived computed to read from
      subscriberCount++;
      const derivedComputed = computed(() => fn(computedInstance.get()));
      return derivedComputed;
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

  return computedInstance;
}
