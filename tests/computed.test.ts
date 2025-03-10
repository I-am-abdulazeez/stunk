import { describe, it, expect } from 'vitest';
import { chunk } from '../src/core/core';
import { computed } from '../src/core/computed';
import { resolve } from './utils';

describe('computed', () => {
  it('should compute the value based on dependencies', async () => {
    const num1 = chunk(2);
    const num2 = chunk(3);

    const sum = computed(() => num1.get() + num2.get());

    expect(sum.get()).toBe(5);
  });

  it('should recompute when a dependency changes', async () => {
    const num1 = chunk(4);
    const num2 = chunk(5);

    const product = computed(() => num1.get() * num2.get());

    expect(product.get()).toBe(20);

    num1.set(10);

    // Trigger recomputation
    expect(product.get()).toBe(50);
  });

  it('should cache the computed value until a dependency changes', async () => {
    const num1 = chunk(1);
    const num2 = chunk(2);

    const sum = computed(() => num1.get() + num2.get());

    expect(sum.get()).toBe(3);

    num1.set(1); // Setting to the same value, should not trigger recompute
    const cachedValue = sum.get();
    expect(cachedValue).toBe(3); // Cached value should be returned
  });

  it('should mark as dirty when a dependency changes', async () => {
    const num1 = chunk(7);
    const num2 = chunk(8);

    const diff = computed(() => num2.get() - num1.get());

    // I have no idea why it passes with this
    await resolve()

    expect(diff.isDirty()).toBe(false);

    num2.set(10);

    expect(diff.isDirty()).toBe(true);
  });

  it('should throw error when attempting to set computed value', () => {
    const num1 = chunk(10);
    const num2 = chunk(20);

    const sum = computed(() => num1.get() + num2.get());

    expect(() => sum.set(100)).toThrow('Cannot set values directly on computed. Modify the source chunk instead.');
  });

  it('should manually recompute the value', async () => {
    const num1 = chunk(1);
    const num2 = chunk(2);

    const sum = computed(() => num1.get() + num2.get());

    expect(sum.get()).toBe(3);

    num1.set(4);
    expect(sum.isDirty()).toBe(true);

    sum.recompute(); // Manually recompute
    expect(sum.get()).toBe(6);
    await resolve()
    expect(sum.isDirty()).toBe(false);
  });

  it('should support multiple dependencies', async () => {
    const a = chunk(2);
    const b = chunk(3);
    const c = chunk(4);

    const result = computed(() => a.get() * b.get() + c.get());

    expect(result.get()).toBe(10);

    b.set(5);

    await resolve()

    expect(result.get()).toBe(14);
  });
});
