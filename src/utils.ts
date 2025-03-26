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
  data: CombinedData<T>;
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

export function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) {
    return true;
  }

  if (!a || !b || typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key) || (a as any)[key] !== (b as any)[key]) {
        return false;
      }
    }
    return true;
  }

  // For primitive types, return false. Strict equality already handled by initial check
  return false;
}
