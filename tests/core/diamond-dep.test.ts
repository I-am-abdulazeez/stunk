import { describe, it, expect, vi } from 'vitest';
import { chunk } from '../../src/core/core';
import { computed } from '../../src/core/computed';

describe('computed > diamond dependency pattern', () => {
  it('should handle diamond dependency pattern correctly', () => {
    // Create the root chunk (A)
    const root = chunk(1);

    // Create two intermediate computeds (B and C) that depend on root
    const left = computed(() => root.get() * 2);
    const right = computed(() => root.get() + 5);

    // Create a final computed (D) that depends on both B and C
    const final = computed(() => `${left.get()}-${right.get()}`);

    // Verify initial computed values
    expect(root.get()).toBe(1);
    expect(left.get()).toBe(2);    // 1 * 2
    expect(right.get()).toBe(6);   // 1 + 5
    expect(final.get()).toBe('2-6');

    // Setup a spy to track updates
    const subscriber = vi.fn();
    const unsubscribe = final.subscribe(subscriber);

    // No initial call
    expect(subscriber).toHaveBeenCalledTimes(0);

    // Update the root
    root.set(4);

    expect(root.get()).toBe(4);
    expect(left.get()).toBe(8);    // 4 * 2
    expect(right.get()).toBe(9);   // 4 + 5
    expect(final.get()).toBe('8-9');

    expect(subscriber).toHaveBeenCalledWith('8-9');
    expect(subscriber).toHaveBeenCalledTimes(1);

    // Clean up
    unsubscribe();
  });

  it('should handle complex update chains in diamond patterns', () => {
    const root = chunk(10);

    // First level of dependencies
    const pathA = computed(() => root.get() + 5);
    const pathB = computed(() => root.get() * 2);

    // Define the type for our merged state
    type MergedState = { sum: number; product: number };

    // Second level - depends on both branches
    const merged = computed(() => ({
      sum: pathA.get() + pathB.get(),
      product: pathA.get() * pathB.get()
    }));

    // Verify initial values
    expect(pathA.get()).toBe(15);    // 10 + 5
    expect(pathB.get()).toBe(20);    // 10 * 2
    expect(merged.get()).toEqual({ sum: 35, product: 300 });

    // Set up capture for updates
    const updates: MergedState[] = [];

    const unsubscribe = merged.subscribe(val => {
      updates.push({ ...val });
    });

    // First update
    root.set(20);

    // Verify values after first update
    expect(pathA.get()).toBe(25);    // 20 + 5
    expect(pathB.get()).toBe(40);    // 20 * 2
    expect(merged.get()).toEqual({ sum: 65, product: 1000 });

    // Second update
    root.set(0);

    // Verify values after second update
    expect(pathA.get()).toBe(5);     // 0 + 5
    expect(pathB.get()).toBe(0);     // 0 * 2
    expect(merged.get()).toEqual({ sum: 5, product: 0 });

    // Check that we received both updates
    expect(updates).toEqual([
      { sum: 65, product: 1000 },
      { sum: 5, product: 0 }
    ]);

    // Clean up
    unsubscribe();
  });
});
