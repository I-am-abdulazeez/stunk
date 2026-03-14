import { afterAll, beforeEach, describe, expect, it, test, vi } from "vitest";
import { batch, chunk, trackDependencies } from "../../src/core/core";


test("should get and set values correctly", () => {
  const c = chunk<number>(0);
  expect(c.get()).toBe(0);

  c.set(10);
  expect(c.get()).toBe(10);

  c.set(prev => prev + 1);
  expect(c.get()).toBe(11);
});

test("should notify subscribers on value change", () => {
  const c = chunk<number>(0);
  const callback = vi.fn();
  const unsubscribe = c.subscribe(callback);

  c.set(5);
  expect(callback).toHaveBeenCalledWith(5);

  c.set(10);
  expect(callback).toHaveBeenCalledWith(10);

  unsubscribe();
});

test("should notify multiple subscribers correctly", () => {
  const c = chunk<number>(0);
  const cb1 = vi.fn();
  const cb2 = vi.fn();

  const unsub1 = c.subscribe(cb1);
  const unsub2 = c.subscribe(cb2);

  c.set(10);
  expect(cb1).toHaveBeenCalledWith(10);
  expect(cb2).toHaveBeenCalledWith(10);

  unsub1();
  unsub2();
});

test("should not call subscriber on initial subscribe — no immediate call", () => {
  const c = chunk<number>(0);
  const callback = vi.fn();
  const unsubscribe = c.subscribe(callback);

  expect(callback).toHaveBeenCalledTimes(0);

  c.set(5);
  expect(callback).toHaveBeenCalledWith(5);
  expect(callback).toHaveBeenCalledTimes(1);

  unsubscribe();
  c.set(10);
  expect(callback).toHaveBeenCalledTimes(1); // unsubscribed — not called again
});

test("should reset to initial value", () => {
  const c = chunk(5);
  c.set(10);
  expect(c.get()).toBe(10);
  c.reset();
  expect(c.get()).toBe(5);
});


describe("chunk — initialization", () => {
  it("should reject undefined as initial value", () => {
    expect(() => chunk(undefined as any, { name: "Bola" })).toThrow(
      "[Bola] Initial value cannot be undefined."
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

  it("should allow 0, false, and empty string as initial values", () => {
    expect(chunk(0).get()).toBe(0);
    expect(chunk(false).get()).toBe(false);
    expect(chunk("").get()).toBe("");
  });

  it("should allow objects and arrays as initial values", () => {
    const obj = { name: "Stunk", version: 3 };
    const arr = [1, 2, 3];

    expect(chunk(obj).get()).toEqual(obj);
    expect(chunk(arr).get()).toEqual(arr);
  });
});


describe("chunk — set with updater", () => {
  it("should update value using updater function", () => {
    const c = chunk(5);
    c.set(value => value + 1);
    expect(c.get()).toBe(6);
  });

  it("should notify subscribers only if value changes", () => {
    const c = chunk(5);
    const subscriber = vi.fn();
    c.subscribe(subscriber);

    c.set(value => value); // same value — no notification
    expect(subscriber).not.toHaveBeenCalled();

    c.set(value => value + 1);
    expect(subscriber).toHaveBeenCalledWith(6);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("should handle complex update logic", () => {
    const c = chunk(5);
    c.set(value => value > 3 ? value * 2 : value + 1);
    expect(c.get()).toBe(10);
  });

  it("should maintain type safety with objects", () => {
    interface User { name: string; age: number; }

    const c = chunk<User>({ name: "John", age: 30 });
    c.set(user => ({ ...user, age: user.age + 1 }));

    expect(c.get().age).toBe(31);
    expect(c.get().name).toBe("John");
  });
});


describe("chunk — peek", () => {
  it("should return current value", () => {
    const c = chunk(5);
    expect(c.peek()).toBe(5);

    c.set(10);
    expect(c.peek()).toBe(10);
  });

  it("should not trigger subscribers", () => {
    const c = chunk(5);
    const callback = vi.fn();
    c.subscribe(callback);

    c.peek();
    expect(callback).toHaveBeenCalledTimes(0);

    c.set(10);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(10);
  });

  it("should not register as a tracked dependency", () => {
    const c = chunk(1);
    const [_, deps] = trackDependencies(() => {
      c.peek();
      return null;
    });
    expect(deps).toHaveLength(0);
  });

  it("should register as a tracked dependency when using get", () => {
    const c = chunk(1);
    const [_, deps] = trackDependencies(() => {
      c.get();
      return null;
    });
    expect(deps).toHaveLength(1);
    expect(deps[0]).toBe(c);
  });
});


describe("chunk — derive", () => {
  it("should create a derived chunk with the correct initial value", () => {
    const count = chunk(5);
    const doubled = count.derive(v => v * 2);

    expect(count.get()).toBe(5);
    expect(doubled.get()).toBe(10);
  });

  it("should update derived chunk when source changes", () => {
    const count = chunk(5);
    const doubled = count.derive(v => v * 2);

    const countSpy = vi.fn();
    const doubledSpy = vi.fn();

    count.subscribe(countSpy);
    doubled.subscribe(doubledSpy);

    expect(countSpy).toHaveBeenCalledTimes(0);
    expect(doubledSpy).toHaveBeenCalledTimes(0);

    count.set(10);
    expect(count.get()).toBe(10);
    expect(doubled.get()).toBe(20);
    expect(countSpy).toHaveBeenCalledWith(10);
    expect(doubledSpy).toHaveBeenCalledWith(20);
  });

  it("should not update derived chunk if source value does not change", () => {
    const count = chunk(5);
    const doubled = count.derive(v => v * 2);

    const doubledSpy = vi.fn();
    doubled.subscribe(doubledSpy);

    count.set(5); // same value
    expect(doubledSpy).toHaveBeenCalledTimes(0);
  });

  it("should return a ReadOnlyChunk — set and reset are hidden at the type level", () => {
    const c = chunk({ name: "John" });
    const derived = c.derive(v => v.name);

    // In v2, ReadOnlyChunk hides set/reset at the TypeScript type level only.
    // The underlying chunk still has these methods at runtime.
    // v3 will enforce read-only at runtime too.
    // @ts-expect-error — set does not exist on ReadOnlyChunk<T>
    expect(typeof derived.set).toBe("function");
    // @ts-expect-error — reset does not exist on ReadOnlyChunk<T>
    expect(typeof derived.reset).toBe("function");
  });

  it("should support chained derivation", () => {
    const count = chunk(2);
    const doubled = count.derive(v => v * 2);
    const quadrupled = doubled.derive(v => v * 2);

    expect(quadrupled.get()).toBe(8);

    count.set(3);
    expect(doubled.get()).toBe(6);
    expect(quadrupled.get()).toBe(12);
  });

  it("should clean up source subscription on derived chunk destroy", () => {
    const source = chunk({ name: "John" });
    const derived = source.derive(v => v.name);

    const callback = vi.fn();
    derived.subscribe(callback);

    derived.destroy();
    source.set({ name: "Jane" });

    expect(callback).not.toHaveBeenCalled();
  });
});


describe("chunk — destroy", () => {
  const countChunk = chunk(0);
  const anotherChunk = chunk(0);
  const countCallback = vi.fn();
  const anotherCallback = vi.fn();

  beforeEach(() => {
    countCallback.mockClear();
    anotherCallback.mockClear();
  });

  it("should stop notifying subscribers after destroy", () => {
    const unsub1 = countChunk.subscribe(countCallback);
    const unsub2 = anotherChunk.subscribe(anotherCallback);

    expect(countCallback).toHaveBeenCalledTimes(0);
    expect(anotherCallback).toHaveBeenCalledTimes(0);

    unsub1();
    unsub2();

    countChunk.destroy();
    anotherChunk.destroy();

    countChunk.set(30);
    anotherChunk.set(40);

    expect(countCallback).toHaveBeenCalledTimes(0);
    expect(anotherCallback).toHaveBeenCalledTimes(0);
  });

  it("should reset to initial value after destroy", () => {
    countChunk.set(10);
    anotherChunk.set(20);

    countChunk.destroy();
    anotherChunk.destroy();

    const newCountCb = vi.fn();
    const newAnotherCb = vi.fn();

    const unsub1 = countChunk.subscribe(newCountCb);
    const unsub2 = anotherChunk.subscribe(newAnotherCb);

    expect(newCountCb).toHaveBeenCalledTimes(0);
    expect(newAnotherCb).toHaveBeenCalledTimes(0);

    expect(countChunk.get()).toBe(0);
    expect(anotherChunk.get()).toBe(0);

    unsub1();
    unsub2();
  });

  afterAll(() => {
    countChunk.destroy();
    anotherChunk.destroy();
  });
});


describe("chunk — batch", () => {
  it("should not notify on same primitive value", () => {
    const c = chunk(1);
    const callback = vi.fn();
    c.subscribe(callback);

    batch(() => { c.set(1); });

    expect(callback).not.toHaveBeenCalled();
  });

  it("should notify once on primitive change inside batch", () => {
    const c = chunk(1);
    const callback = vi.fn();
    c.subscribe(callback);

    batch(() => { c.set(2); });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(2);
  });

  it("should notify once for multiple updates inside a batch", () => {
    const c = chunk(0);
    const callback = vi.fn();
    c.subscribe(callback);

    batch(() => {
      c.set(1);
      c.set(2);
      c.set(3);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(3);
  });

  it("should notify on shallow different objects inside batch", () => {
    const c = chunk({ a: 1 });
    const callback = vi.fn();
    c.subscribe(callback);

    batch(() => { c.set({ a: 2 }); });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({ a: 2 });
  });

  it("should batch updates across multiple chunks", () => {
    const c1 = chunk(0);
    const c2 = chunk(0);
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    c1.subscribe(cb1);
    c2.subscribe(cb2);

    batch(() => {
      c1.set(1);
      c2.set(2);
    });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledWith(1);
    expect(cb2).toHaveBeenCalledWith(2);
  });

  it("should handle nested batch calls correctly", () => {
    const c = chunk(0);
    const callback = vi.fn();
    c.subscribe(callback);

    batch(() => {
      batch(() => {
        c.set(1);
        c.set(2);
      });
      c.set(3);
    });

    // Outer batch should fire once with final value
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(3);
  });
});
