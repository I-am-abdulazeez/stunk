import { useState, useEffect, useMemo } from "react";

import { computed, DependencyValues } from "../../core/computed";
import type { Chunk } from "../../core/core";

/**
 * A hook that computes a value based on multiple chunks.
 * Automatically re-computes when any dependency changes.
 */
export function useComputed<TDeps extends Chunk<any>[], TResult>(
  dependencies: [...TDeps],
  computeFn: (...args: DependencyValues<TDeps>) => TResult
): TResult {
  // Create the computed value - memoize it based on dependencies to prevent recreation
  const computedValue = useMemo(
    () => computed(dependencies, computeFn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...dependencies]
  );

  const [state, setState] = useState<TResult>(() => computedValue.get());

  useEffect(() => {
    const unsubscribe = computedValue.subscribe((newValue) => {
      setState(newValue);
    });

    return () => {
      unsubscribe();
    };
  }, [computedValue]);

  return state;
}
