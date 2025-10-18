import { describe, it, expect, vi } from 'vitest';
import { batch, chunk } from '../../src/core/core';
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

    // @ts-ignore - checking properties don't exist
    expect(sum.set).toBeUndefined();
    // @ts-ignore - checking properties don't exist
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

    // No initial call
    expect(subscriber).toHaveBeenCalledTimes(0);

    a.set(7);

    expect(subscriber).toHaveBeenCalledWith(17);
    expect(subscriber).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("should mark computed as dirty when dependencies change", () => {
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

    // No initial call
    expect(subscriber).toHaveBeenCalledTimes(0);

    a.set(7);

    expect(alwaysFifteen.get()).toBe(15);

    // Should not be called because value didn't change
    expect(subscriber).toHaveBeenCalledTimes(0);

    cleanup();
  });

  it("should not recompute unnecessarily", () => {
    const a = chunk(4);
    const b = chunk(6);
    const computeFn = vi.fn(() => a.get() + b.get());

    const sum = computed(computeFn);

    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    batch(() => {
      a.set(4);
      b.set(6);
    });

    // No changes, so no recompute even if we call get()
    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    batch(() => {
      a.set(5);
    });

    // ✅ Call get() to trigger recompute
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

    a.set(5); // Real change, marks dirty

    // ✅ Call get() to trigger recompute
    expect(sum.get()).toBe(11);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });


  it('should work with batched operations', () => {
    const a = chunk(4);
    const b = chunk(6);
    const computeFn = vi.fn(() => a.get() + b.get());

    // ✅ FIX: Pass computeFn directly
    const sum = computed(computeFn);

    expect(sum.get()).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(1);

    computeFn.mockClear();

    batch(() => {
      a.set(5);
      b.set(7);
    });

    // ✅ FIX: Need to call get() to trigger recompute after batch
    expect(sum.get()).toBe(12);

    // Should compute once after batch
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('should notify subscribers when dependencies change values', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.get());

    const { fn: subscriber, cleanup } = createSubscriber(sum);

    // No initial notification
    expect(subscriber).toHaveBeenCalledTimes(0);

    a.set(7);
    expect(subscriber).toHaveBeenCalledWith(17);
    expect(subscriber).toHaveBeenCalledTimes(1);

    subscriber.mockReset();

    a.set(7); // Same value
    expect(subscriber).not.toHaveBeenCalled();

    cleanup();
  });

  it('should correctly handle the isDirty state', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.get());

    // Not dirty initially (just computed)
    expect(sum.isDirty()).toBe(false);

    a.set(7);
    // Now dirty because dependency changed
    expect(sum.isDirty()).toBe(true);

    // Getting clears dirty flag
    sum.get();
    expect(sum.isDirty()).toBe(false);

    // Manual recompute also clears dirty
    b.set(12);
    expect(sum.isDirty()).toBe(true);

    sum.recompute();
    expect(sum.isDirty()).toBe(false);
  });

  // ✅ NEW TEST: Dynamic dependency tracking
  it('should handle dynamic dependencies', () => {
    const flag = chunk(true);
    const a = chunk(1);
    const b = chunk(2);

    const result = computed(() => {
      return flag.get() ? a.get() : b.get();
    });

    expect(result.get()).toBe(1);

    // Change flag to switch dependency
    flag.set(false);
    expect(result.get()).toBe(2);

    // Now b changes should trigger recompute
    b.set(5);
    expect(result.get()).toBe(5);

    // But a changes should NOT (it's no longer a dependency)
    const computeFn = vi.fn(() => result.get());
    const spy = computed(() => computeFn());

    computeFn.mockClear();
    a.set(100);

    // Should not recompute because a is not a current dependency
    expect(spy.get()).toBe(5);
  });

  // ✅ NEW TEST: peek() doesn't create dependencies
  it('should not track dependencies when using peek()', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.peek());

    expect(sum.get()).toBe(15);

    // Changing b should NOT trigger recompute (peeked, not tracked)
    b.set(20);
    expect(sum.get()).toBe(15); // Still 15, not 25

    // But changing a SHOULD trigger recompute
    a.set(7);
    expect(sum.get()).toBe(27); // 7 + 20 (picks up new b value)
  });

  // ✅ NEW TEST: Computed with objects
  it('should handle object values with shallow equality', () => {
    const obj = chunk({ count: 5 });

    const doubled = computed(() => ({ count: obj.get().count * 2 }));

    const subscriber = vi.fn();
    doubled.subscribe(subscriber);

    expect(doubled.get()).toEqual({ count: 10 });

    // Same value, different reference
    obj.set({ count: 5 });

    // Should NOT notify because shallow equal detected no change
    expect(subscriber).not.toHaveBeenCalled();

    // Different value
    obj.set({ count: 6 });
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith({ count: 12 });
  });

  // ✅ NEW TEST: Cleanup
  it('should clean up subscriptions on destroy', () => {
    const a = chunk(5);
    const b = chunk(10);

    const sum = computed(() => a.get() + b.get());

    const subscriber = vi.fn();
    sum.subscribe(subscriber);

    expect(sum.get()).toBe(15);

    sum.destroy();

    // After destroy, changes should not trigger anything
    a.set(100);
    b.set(200);

    expect(subscriber).not.toHaveBeenCalled();
  });

  // ✅ NEW TEST: Derive from computed
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
