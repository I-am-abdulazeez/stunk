import { isChunk } from "../utils";
import { chunk, Chunk } from "./core";

export function computed<T>(computeFn: () => T): Chunk<T> {
  // Track the currently executing computed function
  let currentComputation: (() => T) | null = null;

  // Set to track dependencies
  const dependencies = new Set<Chunk<any>>();

  const trackingProxy = new Proxy({}, {
    get(target, prop) {
      if (currentComputation && prop === 'value') {
        const chunkValue = (this as any)[prop];
        if (isChunk(chunkValue)) {
          dependencies.add(chunkValue);
          return chunkValue.get();
        }
      }
      return (this as any)[prop];
    },
  });

  // Initial computation
  let cachedValue: T;
  let isDirty = true;

  const computeValue = () => {
    if (!isDirty) return cachedValue

    // Reset dependencies
    dependencies.clear();

    // Set the current computation context
    currentComputation = computeFn;


    try {
      // Compute with tracking
      cachedValue = computeFn.call(trackingProxy);
      isDirty = false;
    } finally {
      // Clear the current computation context
      currentComputation = null;
    }
    return cachedValue;

  }

  // Create the computed chunk
  const computedChunk = chunk(computeValue());

  // Subscribe to all detected dependencies
  dependencies.forEach(dep => {
    dep.subscribe(() => {
      isDirty = true;
      computedChunk.set(computeValue());
    });
  });

  return {
    ...computedChunk,
    get: () => {
      if (isDirty) {
        return computeValue();
      }
      return cachedValue;
    },
    // Prevent direct setting
    set: () => {
      throw new Error('Cannot directly set a computed value');
    }
  };

}
