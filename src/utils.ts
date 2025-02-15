import { chunk, Chunk, Middleware } from "./core/core";

import { AsyncChunk } from "./core/asyncChunk";
import { CombinedData, CombinedState, InferAsyncData } from "./core/types";

export function isValidChunkValue(value: any): boolean {
  return value !== null && value !== undefined;
}

export function isChunk<T>(value: any): value is Chunk<T> {
  return value &&
    typeof value.get === 'function' &&
    typeof value.set === 'function' &&
    typeof value.update === 'function' &&
    typeof value.subscribe === 'function' &&
    typeof value.derive === 'function' &&
    typeof value.reset === 'function' &&
    typeof value.destroy === 'function';
}

export function once<T>(fn: () => T): () => T {
  let called = false;
  let result: T;
  return () => {
    if (!called) {
      result = fn();
      called = true;
    }
    return result;
  };
};

export function combineAsyncChunks<T extends Record<string, AsyncChunk<any>>>(
  chunks: T
): Chunk<{
  loading: boolean;
  error: Error | null;
  data: { [K in keyof T]: InferAsyncData<T[K]> | null };
}> {
  // Create initial state with proper typing
  const initialData = Object.keys(chunks).reduce((acc, key) => {
    acc[key as keyof T] = null;
    return acc;
  }, {} as CombinedData<T>);

  const initialState: CombinedState<T> = {
    loading: true,
    error: null,
    data: initialData
  };

  const combined = chunk(initialState);

  Object.entries(chunks).forEach(([key, asyncChunk]) => {
    asyncChunk.subscribe((state) => {
      const currentState = combined.get();

      combined.set({
        loading: Object.values(chunks).some(chunk => chunk.get().loading),
        error: Object.values(chunks)
          .map(chunk => chunk.get().error)
          .find(error => error !== null) || null,
        data: {
          ...currentState.data,
          [key]: state.data
        },
      });
    });
  });

  return combined;
}

export function processMiddleware<T>(initialValue: T, middleware: Middleware<T>[] = []): T {
  if (initialValue === null || initialValue === undefined) {
    throw new Error("Value cannot be null or undefined.");
  }

  let currentValue = initialValue;
  let index = 0;

  while (index < middleware.length) {
    const currentMiddleware = middleware[index];
    let nextCalled = false;
    let nextValue: T | null = null;

    currentMiddleware(currentValue, (val) => {
      nextCalled = true;
      nextValue = val;
    });

    if (!nextCalled) break;

    if (nextValue === null || nextValue === undefined) {
      throw new Error("Value cannot be null or undefined.");
    }

    currentValue = nextValue;
    index++;
  }

  return currentValue;
}
