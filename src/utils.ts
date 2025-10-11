import { chunk, Chunk, Middleware, NamedMiddleware } from "./core/core";

import { AsyncChunk } from "./core/async-chunk";
import { CombinedData, CombinedState } from "./core/types";

export function isValidChunkValue(value: unknown): boolean {
  return value !== null;
}

export function isValidChunk<T>(value: unknown, validateBehavior = false): value is Chunk<T> {
  if (!isChunk(value)) {
    return false;
  }

  if (!validateBehavior) {
    return true;
  }

  try {
    const currentValue = value.get();
    value.set(currentValue);
    return true;
  } catch {
    return false;
  }
}

export function isChunk<T>(value: unknown): value is Chunk<T> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const chunk = value as Record<string, unknown>;
  const requiredMethods = [
    'get',
    'set',
    'subscribe',
    'derive',
    'peek',
    'reset',
    'destroy'
  ] as const;

  return requiredMethods.every(method =>
    typeof chunk[method] === 'function'
  );
}

/**
 * Only executes the function once ever.
 * Returns the cached result on subsequent calls.
 * Use case: Expensive initialization, singleton patterns
 */
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

/**
 * Combines multiple async chunks into a single chunk.
 * The combined chunk tracks loading, error, and data states from all source chunks.
 */
export function combineAsyncChunks<T extends Record<string, AsyncChunk<any>>>(
  chunks: T
): Chunk<CombinedState<T>> {
  const initialData = Object.keys(chunks).reduce((acc, key) => {
    acc[key as keyof T] = null;
    return acc;
  }, {} as CombinedData<T>);

  const initialState: CombinedState<T> = {
    loading: Object.keys(chunks).length > 0,
    error: null,
    errors: {},
    data: initialData
  };

  const combined = chunk(initialState);

  // Subscribe to each async chunk
  Object.entries(chunks).forEach(([key, asyncChunk]) => {
    asyncChunk.subscribe((state) => {
      const currentState = combined.get();

      // Recalculate loading and error states from all chunks
      let hasLoading = false;
      let firstError: Error | null = null;
      const allErrors: Partial<{ [K in keyof T]: Error }> = {};

      Object.entries(chunks).forEach(([chunkKey, chunk]) => {
        const chunkState = chunk.get();

        // Check loading state
        if (chunkState.loading) {
          hasLoading = true;
        }
        // Collect errors
        if (chunkState.error) {
          if (!firstError) firstError = chunkState.error;
          allErrors[chunkKey as keyof T] = chunkState.error;
        }
      });

      // Update combined state
      combined.set({
        loading: hasLoading,
        error: firstError,
        errors: allErrors,
        data: {
          ...currentState.data,
          [key]: state.data
        },
      });
    });
  });

  return combined;
}

export function processMiddleware<T>(
  initialValue: T,
  middleware: (Middleware<T> | NamedMiddleware<T>)[]
): T {

  if (initialValue === undefined) {
    throw new Error("Value cannot be undefined.");
  }

  let currentValue = initialValue;
  let index = 0;

  while (index < middleware.length) {
    const current = middleware[index];

    const middlewareFn = typeof current === 'function' ? current : current.fn;
    const middlewareName = typeof current === 'function'
      ? `middleware at index ${index}`
      : (current.name || `middleware at index ${index}`);

    let nextCalled = false;
    let nextValue: T | undefined = undefined;

    try {
      middlewareFn(currentValue, (val: T) => {
        if (nextCalled) {
          throw new Error(`next() was called multiple times in "${middlewareName}"`);
        }
        nextCalled = true;
        nextValue = val;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Middleware "${middlewareName}" failed: ${errorMessage}`);
    }

    // If next() wasn't called, stop the chain
    if (!nextCalled) {
      break;
    }

    // Undefined means next() was called without a value
    if (nextValue === undefined) {
      throw new Error(
        `Middleware "${middlewareName}" called next() without providing a value.`
      );
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

export function validateObjectShape<T>(
  original: T,
  updated: T,
  path = '',
  options: { checkMissing?: boolean; checkTypes?: boolean } = {}
) {
  const { checkMissing = true, checkTypes = true } = options;

  if (original === null || updated === null) {
    return;
  }

  // Both must be objects or both primitives
  if (typeof original !== typeof updated) {
    const fullPath = path || 'root';
    console.error(
      `🚨 Stunk: Type mismatch at '${fullPath}'. ` +
      `Expected ${typeof original}, got ${typeof updated}.`
    );
    return;
  }

  // Only validate if both are objects
  if (typeof original !== 'object' || typeof updated !== 'object') {
    return;
  }

  // Handle array vs object mismatch
  if (Array.isArray(original) !== Array.isArray(updated)) {
    const fullPath = path || 'root';
    console.error(
      `🚨 Stunk: Type mismatch at '${fullPath}'. ` +
      `Expected ${Array.isArray(original) ? 'array' : 'object'}, ` +
      `got ${Array.isArray(updated) ? 'array' : 'object'}.`
    );
    return;
  }

  // Validate arrays
  if (Array.isArray(original) && Array.isArray(updated)) {
    // Only validate if original has items and they're objects
    if (original.length > 0 && typeof original[0] === 'object') {
      for (let i = 0; i < updated.length; i++) {
        validateObjectShape(
          original[0],
          updated[i],
          `${path}[${i}]`,
          options
        );
      }
    }
    return;
  }

  // Validate objects
  const originalKeys = Object.keys(original as object);
  const updatedKeys = Object.keys(updated as object);

  // Check for extra keys
  const extraKeys = updatedKeys.filter(key => !originalKeys.includes(key));
  if (extraKeys.length > 0) {
    const fullPath = path || 'root';
    console.error(
      `🚨 Stunk: Unknown properties at '${fullPath}': ${extraKeys.join(', ')}`
    );
    console.error('Expected keys:', originalKeys);
    console.error('Received keys:', updatedKeys);
  }

  // Check for missing keys
  if (checkMissing) {
    const missingKeys = originalKeys.filter(key => !updatedKeys.includes(key));
    if (missingKeys.length > 0) {
      const fullPath = path || 'root';
      console.error(
        `🚨 Stunk: Missing properties at '${fullPath}': ${missingKeys.join(', ')}`
      );
    }
  }

  // Recurse into common keys
  for (const key of originalKeys) {
    const originalValue = (original as any)[key];
    const updatedValue = (updated as any)[key];

    // Check primitive type changes
    if (checkTypes &&
      typeof originalValue !== 'object' &&
      typeof originalValue !== typeof updatedValue) {
      console.error(
        `🚨 Stunk: Type mismatch at '${path ? path + '.' : ''}${key}'. ` +
        `Expected ${typeof originalValue}, got ${typeof updatedValue}.`
      );
    }

    // Recurse for nested objects
    validateObjectShape(
      originalValue,
      updatedValue,
      path ? `${path}.${key}` : key,
      options
    );
  }
}
