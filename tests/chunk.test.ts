import { afterAll, beforeEach, describe, expect, it, test, vi } from "vitest";
import { batch, chunk } from "../src/core/core";

test("Chunk should get and set values correctly", () => {
  const chunky = chunk<number>(0);
  expect(chunky.get()).toBe(0);
  chunky.set(10);
  expect(chunky.get()).toBe(10);
  chunky.set((prev) => prev + 1);
  expect(chunky.get()).toBe(11);
});

test("Chunk should notify subscribers on value change", () => {
  const chunky = chunk<number>(0);
  const callback = vi.fn();
  const unsubscribe = chunky.subscribe(callback);

  chunky.set(5);
  expect(callback).toHaveBeenCalledWith(5);

  chunky.set(10);
  expect(callback).toHaveBeenCalledWith(10);

  chunky.set(10);
  expect(callback).toHaveBeenCalledWith(10);

  unsubscribe();
});

test("Chunk should notify multiple subscribers correctly", () => {
  const chunky = chunk<number>(0);
  const callback1 = vi.fn();
  const callback2 = vi.fn();

  const unsubscribe1 = chunky.subscribe(callback1);
  const unsubscribe2 = chunky.subscribe(callback2);

  chunky.set(10);

  expect(callback1).toHaveBeenCalledWith(10);
  expect(callback2).toHaveBeenCalledWith(10);

  unsubscribe1();
  unsubscribe2();
});

// ✅ UPDATED: No initial subscription call
test("Chunk should allow unsubscribing from updates", () => {
  const chunky = chunk<number>(0);
  const callback = vi.fn();
  const unsubscribe = chunky.subscribe(callback);

  // No initial subscription call anymore
  expect(callback).toHaveBeenCalledTimes(0);

  chunky.set(5);
  expect(callback).toHaveBeenCalledWith(5);
  expect(callback).toHaveBeenCalledTimes(1);

  unsubscribe();
  chunky.set(10);
  expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called after unsubscribe
});

describe("Chunk Derivation", () => {
  it("should create a derived chunk and update it when the original chunk changes", () => {
    const count = chunk(5);
    const doubleCount = count.derive((value) => value * 2);

    const countSpy = vi.fn();
    const doubleCountSpy = vi.fn();

    // Subscribe to both chunks
    count.subscribe(countSpy);
    doubleCount.subscribe(doubleCountSpy);

    expect(count.get()).toBe(5);
    expect(doubleCount.get()).toBe(10);

    // No initial calls
    expect(countSpy).toHaveBeenCalledTimes(0);
    expect(doubleCountSpy).toHaveBeenCalledTimes(0);

    // Update count and verify updates
    count.set(10);
    expect(count.get()).toBe(10);
    expect(doubleCount.get()).toBe(20);
    expect(countSpy).toHaveBeenCalledWith(10);
    expect(doubleCountSpy).toHaveBeenCalledWith(20);
  });

  it("should not update the derived chunk if the original chunk value does not change", () => {
    const count = chunk(5);
    const doubleCount = count.derive((value) => value * 2);

    const doubleCountSpy = vi.fn();
    doubleCount.subscribe(doubleCountSpy);

    // Setting the same value
    count.set(5);
    expect(doubleCount.get()).toBe(10);
    expect(doubleCountSpy).toHaveBeenCalledTimes(0); // No change, so no notification
  });
});

test("Chunk should reset to initial value", () => {
  const count = chunk(5);
  count.set(10);
  expect(count.get()).toBe(10);
  count.reset();
  expect(count.get()).toBe(5);
});

describe("Chunk destroy", () => {
  const countChunk = chunk(0);
  const anotherChunk = chunk(0);
  const countCallback = vi.fn();
  const anotherCallback = vi.fn();

  beforeEach(() => {
    countCallback.mockClear();
    anotherCallback.mockClear();
  });

  it("should stop notifying subscribers after destroy is called", () => {
    // Subscribe to the chunks
    const countUnsubscribe = countChunk.subscribe(countCallback);
    const anotherUnsubscribe = anotherChunk.subscribe(anotherCallback);

    // No initial calls
    expect(countCallback).toHaveBeenCalledTimes(0);
    expect(anotherCallback).toHaveBeenCalledTimes(0);

    // Cleanup subscriptions before destroy
    countUnsubscribe();
    anotherUnsubscribe();

    // Now destroy the chunks
    countChunk.destroy();
    anotherChunk.destroy();

    // Try setting new values after destruction
    countChunk.set(30);
    anotherChunk.set(40);

    // Ensure that the subscribers were not notified after destroy
    expect(countCallback).toHaveBeenCalledTimes(0);
    expect(anotherCallback).toHaveBeenCalledTimes(0);
  });

  it("should reset to initial value after destroy", () => {
    // Set some values
    countChunk.set(10);
    anotherChunk.set(20);

    // Destroy the chunks
    countChunk.destroy();
    anotherChunk.destroy();

    // Subscribe new callbacks after destroy
    const newCountCallback = vi.fn();
    const newAnotherCallback = vi.fn();

    const newCountUnsubscribe = countChunk.subscribe(newCountCallback);
    const newAnotherUnsubscribe = anotherChunk.subscribe(newAnotherCallback);

    // Should not receive initial values (no initial call)
    expect(newCountCallback).toHaveBeenCalledTimes(0);
    expect(newAnotherCallback).toHaveBeenCalledTimes(0);

    // But get() should return initial values
    expect(countChunk.get()).toBe(0);
    expect(anotherChunk.get()).toBe(0);

    newCountUnsubscribe();
    newAnotherUnsubscribe();
  });

  afterAll(() => {
    countChunk.destroy();
    anotherChunk.destroy();
  });
});

describe("chunk update", () => {
  it("should update value using updater function", () => {
    const store = chunk(5);
    store.set((value) => value + 1);
    expect(store.get()).toBe(6);
  });

  it("should notify subscribers only if value changes", () => {
    const store = chunk(5);
    const subscriber = vi.fn();
    store.subscribe(subscriber);

    // Update to same value
    store.set((value) => value);
    expect(subscriber).not.toHaveBeenCalled();

    store.set((value) => value + 1);
    expect(subscriber).toHaveBeenCalledWith(6);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("should handle complex update logic", () => {
    const store = chunk(5);
    store.set((value) => {
      if (value > 3) {
        return value * 2;
      }
      return value + 1;
    });
    expect(store.get()).toBe(10);
  });

  it("should maintain type safety", () => {
    interface User {
      name: string;
      age: number;
    }

    const store = chunk<User>({ name: "John", age: 30 });

    store.set((user) => ({
      ...user,
      age: user.age + 1,
    }));

    const user = store.get();
    expect(user.age).toBe(31);
    expect(user.name).toBe("John");
  });
});

describe("Chunk Shallow Check", () => {
  it("should not notify on same primitive", () => {
    const numChunk = chunk(1);
    const callback = vi.fn();
    numChunk.subscribe(callback);

    batch(() => {
      numChunk.set(1);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("should notify on primitive change", () => {
    const numChunk = chunk(1);
    const callback = vi.fn();
    numChunk.subscribe(callback);

    batch(() => {
      numChunk.set(2);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(2);
  });

  it("should notify on shallow different objects", () => {
    const objChunk = chunk({ a: 1 });
    const callback = vi.fn();
    objChunk.subscribe(callback);

    batch(() => {
      objChunk.set({ a: 2 });
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({ a: 2 });
  });
});

// ✅ NEW TEST: peek() doesn't trigger dependency tracking
describe("Chunk peek()", () => {
  it("should return current value without tracking dependencies", () => {
    const count = chunk(5);

    expect(count.peek()).toBe(5);

    count.set(10);
    expect(count.peek()).toBe(10);
  });

  it("should not trigger subscriptions", () => {
    const count = chunk(5);
    const callback = vi.fn();

    count.subscribe(callback);

    // Peek shouldn't trigger callback
    count.peek();
    expect(callback).toHaveBeenCalledTimes(0);

    // But set should
    count.set(10);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(10);
  });
});

// ✅ NEW TEST: undefined is rejected
describe("Chunk initialization", () => {
  it("should reject undefined as initial value", () => {
    expect(() => chunk(undefined)).toThrow(
      "Initial value cannot be undefined. Use null for empty values."
    );
  });

  it("should allow null as initial value", () => {
    const nullChunk = chunk<string | null>(null);
    expect(nullChunk.get()).toBe(null);

    nullChunk.set("value");
    expect(nullChunk.get()).toBe("value");

    nullChunk.set(null);
    expect(nullChunk.get()).toBe(null);
  });

  it("should allow 0, false, and empty string", () => {
    const zeroChunk = chunk(0);
    expect(zeroChunk.get()).toBe(0);

    const falseChunk = chunk(false);
    expect(falseChunk.get()).toBe(false);

    const emptyChunk = chunk("");
    expect(emptyChunk.get()).toBe("");
  });
});
