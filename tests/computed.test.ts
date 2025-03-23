import { describe, it, expect, vi } from 'vitest';
import { batch, chunk } from '../src/core/core';
import { computed } from '../src/core/computed';

function createSubscriber(chunk: any) {
  const fn = vi.fn();
  const cleanup = chunk.subscribe(() => fn(chunk.get()));
  return { fn, cleanup };
}

describe('computed', () => {
  it('should compute the value based on dependencies', () => {
    const num1 = chunk(2);
    const num2 = chunk(3);

    const sum = computed([num1, num2], (a, b) => a + b);
    expect(sum.get()).toBe(5);
  });

  it('should recompute when a dependency changes', () => {
    const num1 = chunk(4);
    const num2 = chunk(5);

    const product = computed([num1, num2], (a, b) => a * b);
    expect(product.get()).toBe(20);

    num1.set(10);
    expect(product.get()).toBe(50);
  });

  it('should cache the computed value until a dependency changes', () => {
    const num1 = chunk(1);
    const num2 = chunk(2);

    const sum = computed([num1, num2], (a, b) => a + b);
    expect(sum.get()).toBe(3);

    num1.set(1);
    expect(sum.get()).toBe(3);
  });

  it('should throw error when attempting to set computed value', () => {
    const num1 = chunk(10);
    const num2 = chunk(20);

    const sum = computed([num1, num2], (a, b) => a + b);
    expect(() => sum.set(100)).toThrow('Cannot set values directly on computed. Modify the source chunk instead.');
  });

  it('should manually recompute the value', () => {
    const num1 = chunk(1);
    const num2 = chunk(2);

    const sum = computed([num1, num2], (a, b) => a + b);

    expect(sum.get()).toBe(3);

    num1.set(4);

    sum.recompute(); // Manually recompute
    expect(sum.get()).toBe(6);
  });

  it('should support multiple dependencies', () => {
    const a = chunk(2);
    const b = chunk(3);
    const c = chunk(4);

    const result = computed([a, b, c], (x, y, z) => x * y + z);

    expect(result.get()).toBe(10);

    b.set(5);

    expect(result.get()).toBe(14);
  });

  it('should handle nested computed values correctly', () => {
    const a = chunk(2);
    const b = chunk(3);

    const sum = computed([a, b], (x, y) => x + y);
    const doubled = computed([sum], (s) => s * 2);

    expect(sum.get()).toBe(5);
    expect(doubled.get()).toBe(10);

    a.set(5);
    expect(sum.get()).toBe(8);
    expect(doubled.get()).toBe(16);

    b.set(7);
    expect(sum.get()).toBe(12);
    expect(doubled.get()).toBe(24);
  });

  it('should notify subscribers when dependencies change', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed([a, b], (aVal, bVal) => aVal + bVal);

    const { fn: subscriber, cleanup } = createSubscriber(sum);

    expect(subscriber).toHaveBeenCalledWith(15);

    subscriber.mockReset();

    a.set(7);

    expect(subscriber).toHaveBeenCalledWith(17);

    cleanup();
  });


  it("should mark computed as dirty when dependencies change", () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed([a, b], (aVal, bVal) => aVal + bVal);

    expect(sum.isDirty()).toBe(true);

    a.set(7);

    expect(sum.isDirty()).toBe(false);

    expect(sum.get()).toBe(17);
    expect(sum.isDirty()).toBe(false);
  });


  it('should handle notifications properly even when computed value does not change', () => {
    const a = chunk(5);
    const b = chunk(10);

    const alwaysFifteen = computed([a, b], () => 15);

    const { fn: subscriber, cleanup } = createSubscriber(alwaysFifteen);

    subscriber.mockReset();

    a.set(7);

    expect(alwaysFifteen.get()).toBe(15);

    cleanup();
  });

  it("should not recompute unnecessarily", () => {
    const a = chunk(4);
    const b = chunk(6);
    const computeFn = vi.fn((x, y) => x + y);

    const sum = computed([a, b], computeFn);

    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    batch(() => {
      a.set(4); // No real change
      b.set(6); // No real change
    });

    expect(computeFn).toHaveBeenCalledTimes(1);

    batch(() => {
      a.set(5);
    });

    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it('should only compute once on initialization', () => {
    const a = chunk(1);
    const b = chunk(2);
    const computeFn = vi.fn((x, y) => x + y);

    const sum = computed([a, b], computeFn);

    expect(sum.get()).toBe(3);
    expect(computeFn).toHaveBeenCalledTimes(1);

    sum.get();
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('should not recompute when dependencies change but values stay the same', () => {
    const a = chunk(4);
    const b = chunk(6);
    const computeFn = vi.fn((x, y) => x + y);

    const sum = computed([a, b], computeFn);

    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    a.set(4); // Setting to same value
    expect(computeFn).toHaveBeenCalledTimes(1); // Should not recompute

    b.set(6); // Setting to same value
    expect(computeFn).toHaveBeenCalledTimes(1); // Should not recompute
  });

  it('should recompute when dependencies actually change values', () => {
    const a = chunk(4);
    const b = chunk(6);
    const computeFn = vi.fn((x, y) => x + y);

    const sum = computed([a, b], computeFn);

    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    a.set(5); // Real change
    expect(computeFn).toHaveBeenCalledTimes(2);
    expect(sum.get()).toBe(11);
  });

  it('should work with batched operations', () => {
    const a = chunk(4);
    const b = chunk(6);
    const computeFn = vi.fn((x, y) => x + y);

    const sum = computed([a, b], computeFn);

    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    computeFn.mockClear();

    batch(() => {
      a.set(5);
      b.set(7);
    });

    // Only one computation should happen, not two
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(sum.get()).toBe(12);
  });

  it('should notify subscribers when dependencies change values', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed([a, b], (aVal, bVal) => aVal + bVal);

    const { fn: subscriber, cleanup } = createSubscriber(sum);

    // Initial notification
    expect(subscriber).toHaveBeenCalledWith(15);

    subscriber.mockReset();

    a.set(7);
    expect(subscriber).toHaveBeenCalledWith(17);

    subscriber.mockReset();

    a.set(7);
    expect(subscriber).not.toHaveBeenCalled();

    cleanup();
  });

  it('should correctly handle the isDirty state', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed([a, b], (aVal, bVal) => aVal + bVal);

    expect(sum.isDirty()).toBe(true);

    a.set(7);
    expect(sum.isDirty()).toBe(false);

    sum.recompute();
    expect(sum.isDirty()).toBe(false);
  });
});
