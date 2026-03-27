import { trackDependencies, ReadOnlyChunk, Chunk, Subscriber } from "./core";
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
 */
export function computed<T>(computeFn: () => T): Computed<T> {
  const [initialValue, initialDeps] = trackDependencies(computeFn);

  let cachedValue = initialValue;
  let dependencies = initialDeps;
  let isDirtyFlag = false;
  let unsubs: Array<() => void> = [];

  // Direct subscriber set — bypasses the full chunk pipeline (middleware,
  // shape validation, chunk registry) since computed values need none of that
  const subscribers = new Set<Subscriber<T>>();

  const subscribeToDepS = (deps: Chunk<any>[]) =>
    deps.map(dep =>
      dep.subscribe(() => {
        isDirtyFlag = true;
        if (subscribers.size > 0) _recompute();
      })
    );

  const _recompute = () => {
    if (!isDirtyFlag) return;
    isDirtyFlag = false;

    // Always re-track — computeFn runs exactly ONCE here.
    // trackDependencies runs the function inside a tracking context and
    // returns both the new value and the deps discovered in that single run.
    const [newValue, newDeps] = trackDependencies(computeFn);

    // Re-subscribe only if dep identity actually changed (dynamic dep graphs).
    // For the common stable case this is a fast length check + reference
    // equality — no shallowEqual needed on the dep array.
    const depsChanged =
      newDeps.length !== dependencies.length ||
      newDeps.some((dep, i) => dep !== dependencies[i]);

    if (depsChanged) {
      unsubs.forEach(unsub => unsub());
      unsubs = subscribeToDepS(newDeps);
      dependencies = newDeps;
    }

    // Shallow equality for objects prevents unnecessary subscriber pings
    // when the computed returns a new object with identical contents
    const shouldUpdate =
      typeof newValue === 'object' && newValue !== null &&
        typeof cachedValue === 'object' && cachedValue !== null
        ? !shallowEqual(newValue, cachedValue)
        : newValue !== cachedValue;

    if (shouldUpdate) {
      cachedValue = newValue;
      // Notify directly — no chunk.set() overhead
      subscribers.forEach(sub => sub(cachedValue));
    }
  };

  // Initial subscriptions to dependencies
  unsubs = subscribeToDepS(dependencies);

  // Forward-declared so derive() can reference the lazy get()
  let computedInstance: Computed<T>;

  computedInstance = {
    get: () => {
      if (isDirtyFlag) _recompute();
      return cachedValue;
    },

    peek: () => cachedValue,

    subscribe: (callback) => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },

    derive: <D>(fn: (value: T) => D) => {
      // A sentinel subscription keeps the parent in eager mode so
      // cachedValue stays fresh for the derived computed to read from
      const sentinelUnsub = computedInstance.subscribe(() => { });
      const derivedComputed = computed(() => fn(computedInstance.get()));
      const originalDestroy = derivedComputed.destroy;
      derivedComputed.destroy = () => {
        sentinelUnsub();
        originalDestroy();
      };
      return derivedComputed;
    },

    recompute: () => {
      isDirtyFlag = true;
      _recompute();
    },

    isDirty: () => isDirtyFlag,

    destroy: () => {
      unsubs.forEach(unsub => unsub());
      subscribers.clear();
    },
  };

  return computedInstance;
}
