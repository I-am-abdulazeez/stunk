import { describe, it, expect, afterEach, vi } from 'vitest';
import { chunk } from '../src/core/core';
import { computed, runAfterTick } from '../src/core/computed';
import { asyncChunk } from '../src/core/asyncChunk';

const resolve = () => Promise.resolve()

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

    await resolve()

    expect(product.get()).toBe(50);
  });

  it('should cache the computed value until a dependency changes', async () => {
    const num1 = chunk(1);
    const num2 = chunk(2);

    const sum = computed(() => num1.get() + num2.get());

    const initialValue = sum.get();
    expect(initialValue).toBe(3);

    num1.set(1); // Setting to the same value, should not trigger recompute

    const cachedValue = sum.get();
    expect(cachedValue).toBe(3); // Cached value should be returned
  });

  it('should throw error when attempting to set computed value', async () => {
    const num1 = chunk(10);
    const num2 = chunk(20);

    const sum = computed(() => num1.get() + num2.get());

    expect(() => sum.set(100)).toThrow('Cannot directly set a computed value');
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

  it('should work with an async chunk', async () => {
    const a = asyncChunk(() => {
      return new Promise<number>((resolve) => {
        setTimeout(resolve, 200, 5)
      })
    }, { initialData: 0 });
    const b = chunk(3);
    const c = chunk(4);

    function redo() {
      const data = a.get().data!

      return data * b.get() + c.get()
    }

    const result = computed(() => {
      return redo()
    });

    expect(result.get()).toBe(4);


    await new Promise((res) => { setTimeout(res, 200) })

    const data = a.get().data!
    const res = data * b.get() + c.get()
    expect(res).toBe(19)
  })

  it('should run only once synchronously', async () => {
    const fn = vi.fn()

    const runOnce = runAfterTick(fn)

    for (let i = 0; i < 100; i++) runOnce();

    await resolve()

    expect(fn).toHaveBeenCalledTimes(1)
  })
});
