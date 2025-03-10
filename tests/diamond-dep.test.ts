import { describe, it, expect, vi } from 'vitest';

import { chunk } from '../src/core/core';
import { computed } from '../src/core/computed';


describe('computed > diamond dependency pattern', () => {
  it('should handle diamond dependency pattern correctly', () => {
    // Create the root chunk (A)
    const root = chunk(1);

    // Create two intermediate chunks (B and C) that depend on root
    const left = computed([root], value => value * 2);
    const right = computed([root], value => value + 5);

    // Create a final computed chunk (D) that depends on both B and C
    const final = computed([left, right], (leftValue, rightValue) => `${leftValue}-${rightValue}`);

    // Verify initial computed values before subscribing
    expect(root.get()).toBe(1);
    expect(left.get()).toBe(2);    // 1 * 2
    expect(right.get()).toBe(6);   // 1 + 5
    expect(final.get()).toBe('2-6');

    // Setup a spy to track updates
    const subscriber = vi.fn();
    const unsubscribe = final.subscribe(subscriber);

    expect(subscriber).toHaveBeenCalledWith('2-6');
    subscriber.mockClear();

    // Update the root
    root.set(4);

    expect(root.get()).toBe(4);
    expect(left.get()).toBe(8);    // 4 * 2
    expect(right.get()).toBe(9);   // 4 + 5
    expect(final.get()).toBe('8-9');

    expect(subscriber).toHaveBeenCalledWith('8-9');

    // Clean up
    unsubscribe();
  });

  it('should handle complex update chains in diamond patterns', () => {
    const root = chunk(10);

    // First level of dependencies
    const pathA = computed([root], val => val + 5);
    const pathB = computed([root], val => val * 2);

    // Define the type for our merged state
    type MergedState = { sum: number; product: number };

    // Second level - depends on both branches
    const merged = computed(
      [pathA, pathB],
      (a, b) => ({ sum: a + b, product: a * b })
    );

    // Verify initial values before subscribing
    expect(pathA.get()).toBe(15);    // 10 + 5
    expect(pathB.get()).toBe(20);    // 10 * 2
    expect(merged.get()).toEqual({ sum: 35, product: 300 });

    // Set up capture for last values only
    let lastUpdate: MergedState | null = null;
    const updates: MergedState[] = [];

    const unsubscribe = merged.subscribe(val => {
      lastUpdate = { ...val };
    });

    // First update
    root.set(20);
    if (lastUpdate) updates.push(lastUpdate);

    // Verify values after first update
    expect(pathA.get()).toBe(25);    // 20 + 5
    expect(pathB.get()).toBe(40);    // 20 * 2
    expect(merged.get()).toEqual({ sum: 65, product: 1000 });

    // Second update
    root.set(0);
    if (lastUpdate) updates.push(lastUpdate);

    // Verify values after second update
    expect(pathA.get()).toBe(5);     // 0 + 5
    expect(pathB.get()).toBe(0);     // 0 * 2
    expect(merged.get()).toEqual({ sum: 5, product: 0 });

    // Check that we received both values, ignoring intermediate ones
    expect(updates).toEqual([
      { sum: 65, product: 1000 },
      { sum: 5, product: 0 }
    ]);

    // Clean up
    unsubscribe();
  });
});
