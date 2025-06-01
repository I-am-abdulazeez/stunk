import { useState, useEffect, useCallback } from "react";
import { AsyncChunk, AsyncState } from "../../core/asyncChunk";

/**
 * A hook that handles asynchronous state with built-in reactivity.
 * Provides loading, error, and data states with full asyncChunk functionality.
 */
export function useAsyncChunk<T, E extends Error>(asyncChunk: AsyncChunk<T, E>) {
  const [state, setState] = useState<AsyncState<T, E>>(() => asyncChunk.get());

  useEffect(() => {
    const unsubscribe = asyncChunk.subscribe((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();

      asyncChunk.cleanup();
    };
  }, [asyncChunk]);

  const reload = useCallback((...params: any[]) => {
    if ('setParams' in asyncChunk && params.length > 0) {
      return (asyncChunk as any).reload(...params);
    }
    return asyncChunk.reload();
  }, [asyncChunk]);

  const refresh = useCallback((...params: any[]) => {
    if ('setParams' in asyncChunk && params.length > 0) {
      return (asyncChunk as any).refresh(...params);
    }
    return asyncChunk.refresh();
  }, [asyncChunk]);

  const mutate = useCallback(
    (mutator: (currentData: T | null) => T) => asyncChunk.mutate(mutator),
    [asyncChunk]
  );

  const reset = useCallback(() => asyncChunk.reset(), [asyncChunk]);

  const setParams = useCallback((...params: any[]) => {
    if ('setParams' in asyncChunk) {
      (asyncChunk as any).setParams(...params);
    }
  }, [asyncChunk]);

  const { data, loading, error, lastFetched } = state;

  const result = {
    state,
    data,
    loading,
    error,
    lastFetched,
    reload,
    refresh,
    mutate,
    reset,
  };

  // Only add setParams if the asyncChunk supports it
  if ('setParams' in asyncChunk) {
    (result as any).setParams = setParams;
  }

  return result;
}
