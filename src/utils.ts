import { Chunk, Middleware, NamedMiddleware } from "./core/core";

export interface ChunkMeta {
  name: string;
  id: number;
}

export function isValidChunkValue(value: unknown): boolean {
  // null is a valid chunk value in v3 (undefined is not)
  return value !== undefined;
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

export function processMiddleware<T>(
  initialValue: T,
  middleware: (Middleware<T> | NamedMiddleware<T>)[]
): T {
  if (initialValue === undefined) {
    throw new Error("Value cannot be undefined.");
  }

<<<<<<< HEAD
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
  if (initialValue === null) {
    throw new Error("Value cannot be null.");
=======
  // null is a valid value in v3 — pass it through unchanged if no middleware
  if (middleware.length === 0) {
    return initialValue;
>>>>>>> v3
  }

  let currentValue = initialValue;

  for (let i = 0; i < middleware.length; i++) {
    const current = middleware[i];

    const middlewareFn = typeof current === 'function' ? current : current.fn;
    const middlewareName = typeof current === 'function'
      ? `index ${i}`
      : (current.name || `index ${i}`);

    try {
      const result = middlewareFn(currentValue);

      // If undefined is returned, stop processing the middleware chain
      if (result === undefined) break;

<<<<<<< HEAD
      // Null values are not allowed
=======
      // Null returned from middleware is not allowed — middleware must
      // return a value or undefined to stop the chain
>>>>>>> v3
      if (result === null) {
        throw new Error(`Middleware "${middlewareName}" returned null value.`);
      }

      currentValue = result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Middleware "${middlewareName}" threw an error: ${errorMessage}`);
    }
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

  // Allow undefined → T transitions — undefined is used as "not yet set"
  // (e.g. lastFetched starts as undefined then becomes a number after fetch)
  if (original === undefined || updated === undefined) {
    return;
  }

  if (typeof original !== typeof updated) {
    const fullPath = path || 'root';
    console.error(
      `🚨 Stunk: Type mismatch at '${fullPath}'. ` +
      `Expected ${typeof original}, got ${typeof updated}.`
    );
    return;
  }

  if (typeof original !== 'object' || typeof updated !== 'object') {
    return;
  }

  if (Array.isArray(original) !== Array.isArray(updated)) {
    const fullPath = path || 'root';
    console.error(
      `🚨 Stunk: Type mismatch at '${fullPath}'. ` +
      `Expected ${Array.isArray(original) ? 'array' : 'object'}, ` +
      `got ${Array.isArray(updated) ? 'array' : 'object'}.`
    );
    return;
  }

  if (Array.isArray(original) && Array.isArray(updated)) {
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

  const originalKeys = Object.keys(original as object);
  const updatedKeys = Object.keys(updated as object);

  const extraKeys = updatedKeys.filter(key => !originalKeys.includes(key));
  if (extraKeys.length > 0) {
    const fullPath = path || 'root';
    console.error(
      `🚨 Stunk: Unknown properties at '${fullPath}': ${extraKeys.join(', ')}`
    );
    console.error('Expected keys:', originalKeys);
    console.error('Received keys:', updatedKeys);
  }

  if (checkMissing) {
    const missingKeys = originalKeys.filter(key => !updatedKeys.includes(key));
    if (missingKeys.length > 0) {
      const fullPath = path || 'root';
      console.error(
        `🚨 Stunk: Missing properties at '${fullPath}': ${missingKeys.join(', ')}`
      );
    }
  }

  for (const key of originalKeys) {
    const originalValue = (original as any)[key];
    const updatedValue = (updated as any)[key];

    // Skip undefined → T or T → null transitions — both are valid v3 patterns
    if (originalValue === undefined || updatedValue === undefined || updatedValue === null) {
      continue;
    }

    if (checkTypes &&
      typeof originalValue !== 'object' &&
      typeof originalValue !== typeof updatedValue) {
      console.error(
        `🚨 Stunk: Type mismatch at '${path ? path + '.' : ''}${key}'. ` +
        `Expected ${typeof originalValue}, got ${typeof updatedValue}.`
      );
    }

    validateObjectShape(
      originalValue,
      updatedValue,
      path ? `${path}.${key}` : key,
      options
    );
  }
}

export function getChunkMeta<T>(chunk: Chunk<T>): ChunkMeta | undefined {
  return (chunk as any)[Symbol.for('stunk.meta')];
}
