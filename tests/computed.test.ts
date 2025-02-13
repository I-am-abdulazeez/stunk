import { chunk } from '../src/core/core';
import { computed } from '../src/core/computed';

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

    // Trigger recomputation
    expect(product.get()).toBe(50);
  });

  it('should cache the computed value until a dependency changes', () => {
    const num1 = chunk(1);
    const num2 = chunk(2);

    const sum = computed([num1, num2], (a, b) => a + b);

    const initialValue = sum.get();
    expect(initialValue).toBe(3);

    num1.set(1); // Setting to the same value, should not trigger recompute
    const cachedValue = sum.get();
    expect(cachedValue).toBe(3); // Cached value should be returned
  });

  it('should mark as dirty when a dependency changes', () => {
    const num1 = chunk(7);
    const num2 = chunk(8);

    const diff = computed([num1, num2], (a, b) => b - a);

    expect(diff.isDirty()).toBe(false);

    num2.set(10);

    expect(diff.isDirty()).toBe(true);
  });

  it('should throw error when attempting to set computed value', () => {
    const num1 = chunk(10);
    const num2 = chunk(20);

    const sum = computed([num1, num2], (a, b) => a + b);

    expect(() => sum.set(100)).toThrow('Cannot directly set a computed value');
  });

  it('should manually recompute the value', () => {
    const num1 = chunk(1);
    const num2 = chunk(2);

    const sum = computed([num1, num2], (a, b) => a + b);

    expect(sum.get()).toBe(3);

    num1.set(4);
    expect(sum.isDirty()).toBe(true);

    sum.recompute(); // Manually recompute
    expect(sum.get()).toBe(6);
    expect(sum.isDirty()).toBe(false);
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
});
