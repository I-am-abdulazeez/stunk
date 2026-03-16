import { describe, it, expect, vi } from 'vitest';
import { chunk, batch } from '../../src/core/core';
import { computed } from '../../src/core/computed';

function createSubscriber(chunk: any) {
  const fn = vi.fn();
  const cleanup = chunk.subscribe(() => fn(chunk.get()));
  return { fn, cleanup };
}

describe('computed', () => {
  it('should compute the value based on dependencies', () => {
    const num1 = chunk(2);
    const num2 = chunk(3);

    const sum = computed(() => num1.get() + num2.get());
    expect(sum.get()).toBe(5);
  });

  it('should recompute when a dependency changes', () => {
    const num1 = chunk(4);
    const num2 = chunk(5);

    const product = computed(() => num1.get() * num2.get());
    expect(product.get()).toBe(20);

    num1.set(10);
    expect(product.get()).toBe(50);
  });

  it('should cache the computed value until a dependency changes', () => {
    const num1 = chunk(1);
    const num2 = chunk(2);

    const sum = computed(() => num1.get() + num2.get());
    expect(sum.get()).toBe(3);

    num1.set(1);
    expect(sum.get()).toBe(3);
  });

  it('should be read-only (no set or reset methods)', () => {
    const num1 = chunk(10);
    const num2 = chunk(20);

    const sum = computed(() => num1.get() + num2.get());

    // @ts-ignore
    expect(sum.set).toBeUndefined();
    // @ts-ignore
    expect(sum.reset).toBeUndefined();
  });

  it('should manually recompute the value', () => {
    const num1 = chunk(1);
    const num2 = chunk(2);

    const sum = computed(() => num1.get() + num2.get());
    expect(sum.get()).toBe(3);

    num1.set(4);
    sum.recompute();
    expect(sum.get()).toBe(6);
  });

  it('should support multiple dependencies', () => {
    const a = chunk(2);
    const b = chunk(3);
    const c = chunk(4);

    const result = computed(() => a.get() * b.get() + c.get());
    expect(result.get()).toBe(10);

    b.set(5);
    expect(result.get()).toBe(14);
  });

  it('should handle nested computed values correctly', () => {
    const a = chunk(2);
    const b = chunk(3);

    const sum = computed(() => a.get() + b.get());
    const doubled = computed(() => sum.get() * 2);

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

    const sum = computed(() => a.get() + b.get());
    const { fn: subscriber, cleanup } = createSubscriber(sum);

    expect(subscriber).toHaveBeenCalledTimes(0);

    a.set(7);
    expect(subscriber).toHaveBeenCalledWith(17);
    expect(subscriber).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('should mark computed as dirty when dependencies change', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.get());
    expect(sum.isDirty()).toBe(false);

    a.set(7);
    expect(sum.isDirty()).toBe(true);

    expect(sum.get()).toBe(17);
    expect(sum.isDirty()).toBe(false);
  });

  it('should handle notifications properly even when computed value does not change', () => {
    const a = chunk(5);
    const alwaysFifteen = computed(() => 15);

    const { fn: subscriber, cleanup } = createSubscriber(alwaysFifteen);

    expect(subscriber).toHaveBeenCalledTimes(0);

    a.set(7);
    expect(alwaysFifteen.get()).toBe(15);
    expect(subscriber).toHaveBeenCalledTimes(0);

    cleanup();
  });

  it('should not recompute unnecessarily', () => {
    const a = chunk(4);
    const b = chunk(6);
    const computeFn = vi.fn(() => a.get() + b.get());

    const sum = computed(computeFn);
    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    // batch with same values — no recompute
    batch(() => {
      a.set(4);
      b.set(6);
    });

    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    batch(() => { a.set(5); });

    expect(sum.get()).toBe(11);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it('should only compute once on initialization', () => {
    const a = chunk(1);
    const b = chunk(2);
    const computeFn = vi.fn(() => a.get() + b.get());

    const sum = computed(() => computeFn());
    expect(sum.get()).toBe(3);
    expect(computeFn).toHaveBeenCalledTimes(1);

    sum.get();
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('should recompute when dependencies actually change values', () => {
    const a = chunk(4);
    const b = chunk(6);
    const computeFn = vi.fn(() => a.get() + b.get());

    const sum = computed(computeFn);
    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    a.set(5);

    expect(sum.get()).toBe(11);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it('should work with batched operations', () => {
    const a = chunk(4);
    const b = chunk(6);
    const computeFn = vi.fn(() => a.get() + b.get());

    const sum = computed(computeFn);
    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    computeFn.mockClear();

    batch(() => {
      a.set(5);
      b.set(7);
    });

    expect(sum.get()).toBe(12);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('should notify subscribers when dependencies change values', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.get());
    const { fn: subscriber, cleanup } = createSubscriber(sum);

    expect(subscriber).toHaveBeenCalledTimes(0);

    a.set(7);
    expect(subscriber).toHaveBeenCalledWith(17);
    expect(subscriber).toHaveBeenCalledTimes(1);

    subscriber.mockReset();

    a.set(7); // same value
    expect(subscriber).not.toHaveBeenCalled();

    cleanup();
  });

  it('should correctly handle the isDirty state', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.get());
    expect(sum.isDirty()).toBe(false);

    a.set(7);
    expect(sum.isDirty()).toBe(true);

    sum.get();
    expect(sum.isDirty()).toBe(false);

    b.set(12);
    expect(sum.isDirty()).toBe(true);

    sum.recompute();
    expect(sum.isDirty()).toBe(false);
  });

  it('should handle dynamic dependencies', () => {
    const flag = chunk(true);
    const a = chunk(1);
    const b = chunk(2);

    const result = computed(() => flag.get() ? a.get() : b.get());

    expect(result.get()).toBe(1);

    flag.set(false);
    expect(result.get()).toBe(2);

    b.set(5);
    expect(result.get()).toBe(5);

    const computeFn = vi.fn(() => result.get());
    const spy = computed(() => computeFn());

    computeFn.mockClear();
    a.set(100);

    expect(spy.get()).toBe(5);
  });

  it('should not track dependencies when using peek()', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.peek());
    expect(sum.get()).toBe(15);

    b.set(20);
    expect(sum.get()).toBe(15); // b not tracked

    a.set(7);
    expect(sum.get()).toBe(27); // 7 + 20
  });

  it('should handle object values with shallow equality', () => {
    const obj = chunk({ count: 5 });
    const doubled = computed(() => ({ count: obj.get().count * 2 }));

    const subscriber = vi.fn();
    doubled.subscribe(subscriber);

    expect(doubled.get()).toEqual({ count: 10 });

    obj.set({ count: 5 }); // same value, different ref
    expect(subscriber).not.toHaveBeenCalled();

    obj.set({ count: 6 });
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith({ count: 12 });
  });

  it('should clean up subscriptions on destroy', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.get());
    const subscriber = vi.fn();
    sum.subscribe(subscriber);

    expect(sum.get()).toBe(15);

    sum.destroy();

    a.set(100);
    b.set(200);

    expect(subscriber).not.toHaveBeenCalled();
  });

  it('should support deriving from computed values', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.get());
    const doubled = sum.derive(val => val * 2);

    expect(doubled.get()).toBe(30);

    a.set(10);
    expect(sum.get()).toBe(20);
    expect(doubled.get()).toBe(40);
  });
});


describe('computed — subscriberCount edge cases', () => {
  it('should not go below zero when unsubscribe is called multiple times', () => {
    const a = chunk(1);
    const sum = computed(() => a.get() + 1);

    const unsub = sum.subscribe(() => { });

    // Call unsubscribe multiple times
    unsub();
    unsub();
    unsub();

    // subscriberCount should not be negative — eager recompute should still work correctly
    // Set a value to trigger the dep subscriber
    a.set(2);

    // get() should still work correctly
    expect(sum.get()).toBe(3);
  });

  it('should stop eager recompute when last subscriber unsubscribes', () => {
    const a = chunk(1);
    const computeFn = vi.fn(() => a.get() + 1);
    const sum = computed(computeFn);

    const unsub1 = sum.subscribe(() => { });
    const unsub2 = sum.subscribe(() => { });

    computeFn.mockClear();

    // Both subscribers active — eager recompute should fire
    a.set(2);
    expect(computeFn).toHaveBeenCalledTimes(1);

    computeFn.mockClear();

    unsub1();
    unsub2();

    // No subscribers — should NOT eagerly recompute
    a.set(3);
    expect(computeFn).toHaveBeenCalledTimes(0);

    // But get() should still recompute lazily
    expect(sum.get()).toBe(4);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });
});


describe('computed — derive freshness', () => {
  it('should return fresh value from derive when parent computed is dirty', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.get());
    const doubled = sum.derive(val => val * 2);

    expect(doubled.get()).toBe(30);

    // Mark sum as dirty
    a.set(10);

    // derived value should reflect the updated sum, not stale cached value
    expect(doubled.get()).toBe(40);
  });

  it('should propagate freshness through multiple derive levels', () => {
    const a = chunk(2);

    const doubled = computed(() => a.get() * 2); // 4
    const quadrupled = doubled.derive(val => val * 2); // 8
    const octupled = quadrupled.derive(val => val * 2); // 16

    expect(octupled.get()).toBe(16); // 2 * 2 * 2 * 2

    a.set(3);
    expect(octupled.get()).toBe(24); // 3 * 2 * 2 * 2
  });

  it('should notify derive subscribers when parent computed changes', () => {
    const a = chunk(5);
    const sum = computed(() => a.get() + 10);
    const doubled = sum.derive(val => val * 2);

    const subscriber = vi.fn();
    doubled.subscribe(subscriber);

    a.set(10);

    expect(doubled.get()).toBe(40); // (10 + 10) * 2
    expect(subscriber).toHaveBeenCalled();
  });
});


describe('computed > diamond dependency pattern', () => {
  it('should handle diamond dependency pattern correctly', () => {
    const root = chunk(1);
    const left = computed(() => root.get() * 2);
    const right = computed(() => root.get() + 5);
    const final = computed(() => `${left.get()}-${right.get()}`);

    expect(left.get()).toBe(2);
    expect(right.get()).toBe(6);
    expect(final.get()).toBe('2-6');

    const subscriber = vi.fn();
    const unsubscribe = final.subscribe(subscriber);

    expect(subscriber).toHaveBeenCalledTimes(0);

    root.set(4);

    expect(left.get()).toBe(8);
    expect(right.get()).toBe(9);
    expect(final.get()).toBe('8-9');

    expect(subscriber).toHaveBeenCalledWith('8-9');
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('should handle complex update chains in diamond patterns', () => {
    const root = chunk(10);

    const pathA = computed(() => root.get() + 5);
    const pathB = computed(() => root.get() * 2);

    type MergedState = { sum: number; product: number };

    const merged = computed(() => ({
      sum: pathA.get() + pathB.get(),
      product: pathA.get() * pathB.get()
    }));

    expect(pathA.get()).toBe(15);
    expect(pathB.get()).toBe(20);
    expect(merged.get()).toEqual({ sum: 35, product: 300 });

    const updates: MergedState[] = [];
    const unsubscribe = merged.subscribe(val => updates.push({ ...val }));

    root.set(20);

    expect(pathA.get()).toBe(25);
    expect(pathB.get()).toBe(40);
    expect(merged.get()).toEqual({ sum: 65, product: 1000 });

    root.set(0);

    expect(pathA.get()).toBe(5);
    expect(pathB.get()).toBe(0);
    expect(merged.get()).toEqual({ sum: 5, product: 0 });

    expect(updates).toEqual([
      { sum: 65, product: 1000 },
      { sum: 5, product: 0 }
    ]);

    unsubscribe();
  });
});
