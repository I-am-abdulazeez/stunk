import { chunk, trackDependencies, ReadOnlyChunk, Chunk, Subscriber } from "./core";
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

  // Two-tier notification:
  // 1. Our own subscribers — notified directly (no chunk pipeline overhead)
  // 2. internalChunk — kept only so other computed instances can subscribe
  //    to this computed via trackDependencies(). When final calls left.get()
  //    inside its computeFn, trackDependencies registers internalChunk as a dep.
  //    internalChunk.set() is called only when cachedValue actually changes,
  //    which triggers downstream computed recomputation correctly.
  const ownSubscribers = new Set<Subscriber<T>>();
  const internalChunk = chunk(cachedValue);

  const _subscribeToDepS = (deps: Chunk<any>[]) =>
    deps.map(dep =>
      dep.subscribe(() => {
        isDirtyFlag = true;
        if (ownSubscribers.size > 0 || internalChunk.subscribe !== undefined) {
          _recomputeIfNeeded();
        }
      })
    );

  const _recomputeIfNeeded = () => {
    if (!isDirtyFlag) return;
    isDirtyFlag = false;

    // computeFn runs exactly once — trackDependencies returns both the
    // new value and discovered deps in a single pass
    const [newValue, newDeps] = trackDependencies(computeFn);

    // Re-subscribe only if dep identity changed (dynamic dep graphs).
    // Fast path: length check + reference equality.
    const depsChanged =
      newDeps.length !== dependencies.length ||
      newDeps.some((dep, i) => dep !== dependencies[i]);

    if (depsChanged) {
      unsubs.forEach(unsub => unsub());
      unsubs = _subscribeToDepS(newDeps);
      dependencies = newDeps;
    }

    // Shallow equality for objects prevents unnecessary pings
    const shouldUpdate =
      typeof newValue === 'object' && newValue !== null &&
        typeof cachedValue === 'object' && cachedValue !== null
        ? !shallowEqual(newValue, cachedValue)
        : newValue !== cachedValue;

    if (shouldUpdate) {
      cachedValue = newValue;
      // Update internalChunk FIRST so get() returns the fresh value
      // when a subscriber calls get() inside their callback
      internalChunk.set(newValue);
      // Then notify own subscribers directly — no chunk pipeline overhead
      ownSubscribers.forEach(sub => sub(cachedValue));
    }
  };

  // Dep subscribers: recompute eagerly when anyone is watching
  const _makeDepSubscriber = () => () => {
    isDirtyFlag = true;
    // Eager recompute if we have own subscribers OR downstream computed watchers
    const hasWatchers = ownSubscribers.size > 0;
    if (hasWatchers) _recomputeIfNeeded();
  };

  unsubs = dependencies.map(dep => dep.subscribe(_makeDepSubscriber()));

  let computedInstance: Computed<T>;

  computedInstance = {
    // get() uses internalChunk.get() so trackDependencies in downstream
    // computed instances registers internalChunk as a dependency
    get: () => {
      if (isDirtyFlag) _recomputeIfNeeded();
      return internalChunk.get();
    },

    peek: () => cachedValue,

    subscribe: (callback) => {
      ownSubscribers.add(callback);
      return () => {
        ownSubscribers.delete(callback);
      };
    },

    derive: <D>(fn: (value: T) => D) => {
      // Sentinel keeps this computed in eager mode so internalChunk
      // stays fresh for the derived computed to read from via get()
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
      _recomputeIfNeeded();
    },

    isDirty: () => isDirtyFlag,

    destroy: () => {
      unsubs.forEach(unsub => unsub());
      ownSubscribers.clear();
      internalChunk.destroy();
    },
  };

  return computedInstance;
}
