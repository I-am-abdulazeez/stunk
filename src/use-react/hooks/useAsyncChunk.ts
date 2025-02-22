import { useState, useEffect, useCallback } from "react";

import { AsyncChunk, AsyncState } from "../../core/asyncChunk";

/**
 * A hook that handles asynchronous state with built-in reactivity.
 * Provides loading, error, and data states.
 */
export function useAsyncChunk<T>(asyncChunk: AsyncChunk<T>) {
  const [state, setState] = useState<AsyncState<T>>(() => asyncChunk.get());

  useEffect(() => {
    const unsubscribe = asyncChunk.subscribe((newState) => {
      setState(newState);
    });

    return () => unsubscribe();
  }, [asyncChunk]);

  const reload = useCallback(() => asyncChunk.reload(), [asyncChunk]);
  const mutate = useCallback(
    (mutator: (currentData: T | null) => T) => asyncChunk.mutate(mutator),
    [asyncChunk]
  );
  const reset = useCallback(() => asyncChunk.reset(), [asyncChunk]);

  const { data, loading, error } = state;

  return {
    state,
    data,
    loading,
    error,
    reload,
    mutate,
    reset
  };
}
