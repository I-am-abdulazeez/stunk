import { chunk } from "../src/core";

test("Chunk should get and set values correctly", () => {
  const chunky = chunk<number>(0);
  expect(chunky.get()).toBe(0);
  chunky.set(10);
  expect(chunky.get()).toBe(10);
});

test("Chunk should notify new subscribers with current value", () => {
  const chunky = chunk<number>(0);
  chunky.set(5);
  const callback = jest.fn();

  // Subscribe after state is set
  chunky.subscribe(callback);
  expect(callback).toHaveBeenCalledWith(5);
});

test("Chunk should notify multiple subscribers correctly", () => {
  const chunky = chunk<number>(0);
  const callback1 = jest.fn();
  const callback2 = jest.fn();

  chunky.subscribe(callback1);
  chunky.subscribe(callback2);

  chunky.set(10);

  expect(callback1).toHaveBeenCalledWith(10);
  expect(callback2).toHaveBeenCalledWith(10);
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

test("Chunk should reset to initial value and notify subscribers", () => {
  const count = chunk(5);
  const callback = jest.fn();

  count.subscribe(callback);
  count.set(10);
  expect(count.get()).toBe(10);

  count.reset();
  expect(count.get()).toBe(5);
  expect(callback).toHaveBeenCalledWith(5); // Subscriber should be notified
});

describe("Chunk Derivation", () => {
  it("should create a derived chunk and update it when the original chunk changes", () => {
    // Create an initial chunk with value 5
    const count = chunk(5);

    // No need to check for `derive` being undefined
    const doubleCount = count.derive((value) => value * 2);

    const countSpy = jest.fn();
    const doubleCountSpy = jest.fn();

    // Subscribe to both chunks
    count.subscribe(countSpy);
    doubleCount.subscribe(doubleCountSpy);

    // Check initial values
    expect(count.get()).toBe(5); // count should be 5
    expect(doubleCount.get()).toBe(10); // doubleCount should be 10 (5 * 2)

    // Check that the spies were called once with the initial values
    expect(countSpy).toHaveBeenCalledWith(5);
    expect(doubleCountSpy).toHaveBeenCalledWith(10);

    // Change the count value to 10
    count.set(10);

    // Check the new values
    expect(count.get()).toBe(10); // count should be 10
    expect(doubleCount.get()).toBe(20); // doubleCount should be 20 (10 * 2)

    // Check that the spies were called with the updated values
    expect(countSpy).toHaveBeenCalledWith(10);
    expect(doubleCountSpy).toHaveBeenCalledWith(20);
  });
});

describe("Chunk Destroy", () => {
  it("should reset the chunk to its initial value and clear all subscribers", () => {
    const count = chunk(5);
    const callback = jest.fn();

    // Subscribe to the chunk
    count.subscribe(callback);

    // Update the chunk's value
    count.set(10);
    expect(count.get()).toBe(10);
    expect(callback).toHaveBeenCalledWith(10);

    // Destroy the chunk
    count.destroy();

    // Check that the value is reset
    expect(count.get()).toBe(5);

    // Update the chunk again
    count.set(20);

    // Check that the callback was not called after destroy
    expect(callback).toHaveBeenCalledTimes(1); // Only called once (for set(10))
  });

  it("should not notify subscribers after destroy", () => {
    const count = chunk(5);
    const callback = jest.fn();

    // Subscribe to the chunk
    count.subscribe(callback);

    // Destroy the chunk
    count.destroy();

    // Update the chunk's value
    count.set(10);

    // Check that the callback was not called
    expect(callback).toHaveBeenCalledTimes(0);
  });

  it("should allow reusing the chunk after destroy (if needed)", () => {
    const count = chunk(5);
    const callback = jest.fn();

    // Subscribe to the chunk
    count.subscribe(callback);

    // Destroy the chunk
    count.destroy();

    // Re-subscribe and update the chunk
    count.subscribe(callback);
    count.set(10);

    // Check that the callback is called again
    expect(callback).toHaveBeenCalledWith(10);
  });
});
