import { chunk } from "../src/core";

test("Chunk should get and set values correctly", () => {
  const chunky = chunk<number>(0);
  expect(chunky.get()).toBe(0);
  chunky.set(10);
  expect(chunky.get()).toBe(10);
});

test("Chunk should notify subscribers on value change", () => {
  const chunky = chunk<number>(0);
  const callback = jest.fn();
  chunky.subscribe(callback);

  chunky.set(5);
  expect(callback).toHaveBeenCalledWith(5);

  chunky.set(10);
  expect(callback).toHaveBeenCalledWith(10);
});

test("Chunk should allow unsubscribing from updates", () => {
  const chunky = chunk<number>(0);
  const callback = jest.fn();
  const unsubscribe = chunky.subscribe(callback);

  // Initial subscription call
  expect(callback).toHaveBeenCalledWith(0);
  expect(callback).toHaveBeenCalledTimes(1);

  chunky.set(5);
  expect(callback).toHaveBeenCalledWith(5);
  expect(callback).toHaveBeenCalledTimes(2);

  unsubscribe();
  chunky.set(10);
  expect(callback).toHaveBeenCalledTimes(2); // Still called only twice
});

describe("Chunk Derivation", () => {
  it("should create a derived chunk and update it when the original chunk changes", () => {
    const count = chunk(5);
    const doubleCount = count.derive((value) => value * 2);

    const countSpy = jest.fn();
    const doubleCountSpy = jest.fn();

    // Subscribe to both chunks
    count.subscribe(countSpy);
    doubleCount.subscribe(doubleCountSpy);

    // Initial values
    expect(count.get()).toBe(5);
    expect(doubleCount.get()).toBe(10);
    expect(countSpy).toHaveBeenCalledWith(5);
    expect(doubleCountSpy).toHaveBeenCalledWith(10);

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

    const doubleCountSpy = jest.fn();

    // Subscribe to the derived chunk
    doubleCount.subscribe(doubleCountSpy);

    // Setting the same value
    count.set(5);
    expect(doubleCount.get()).toBe(10); // Derived value should remain the same
    expect(doubleCountSpy).toHaveBeenCalledTimes(1); // Only initial value
  });
});

// Path: tests/middleware.test.ts
