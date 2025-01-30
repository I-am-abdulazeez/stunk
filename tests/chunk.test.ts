import { chunk } from "../src/core/core";

test("Chunk should get and set values correctly", () => {
  const chunky = chunk<number>(0);
  expect(chunky.get()).toBe(0);
  chunky.set(10);
  expect(chunky.get()).toBe(10);
});

test("Chunk should notify subscribers on value change", () => {
  const chunky = chunk<number>(0);
  const callback = jest.fn();
  const unsubscribe = chunky.subscribe(callback); // Store unsubscribe function

  chunky.set(5);
  expect(callback).toHaveBeenCalledWith(5);

  chunky.set(10);
  expect(callback).toHaveBeenCalledWith(10);

  unsubscribe(); // Ensure cleanup after test
});

test("Chunk should notify multiple subscribers correctly", () => {
  const chunky = chunk<number>(0);
  const callback1 = jest.fn();
  const callback2 = jest.fn();

  const unsubscribe1 = chunky.subscribe(callback1);
  const unsubscribe2 = chunky.subscribe(callback2);


  chunky.set(10);

  expect(callback1).toHaveBeenCalledWith(10);
  expect(callback2).toHaveBeenCalledWith(10);

  unsubscribe1();
  unsubscribe2();
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


test("Chunk should reset to initial value", () => {
  const count = chunk(5);
  count.set(10);
  expect(count.get()).toBe(10);
  count.reset();
  expect(count.get()).toBe(5);
});


describe('Chunk destroy', () => {
  const countChunk = chunk(0);
  const anotherChunk = chunk(0);
  const countCallback = jest.fn();
  const anotherCallback = jest.fn();

  beforeEach(() => {
    // Reset the mocks
    countCallback.mockClear();
    anotherCallback.mockClear();
  });

  it('should stop notifying subscribers after destroy is called', () => {
    // Subscribe to the chunks
    const countUnsubscribe = countChunk.subscribe(countCallback);
    const anotherUnsubscribe = anotherChunk.subscribe(anotherCallback);

    // Verify initial subscription calls
    expect(countCallback).toHaveBeenCalledTimes(1);
    expect(countCallback).toHaveBeenCalledWith(0);
    expect(anotherCallback).toHaveBeenCalledTimes(1);
    expect(anotherCallback).toHaveBeenCalledWith(0);

    // Clear the mocks to start fresh
    countCallback.mockClear();
    anotherCallback.mockClear();

    // Cleanup subscriptions before destroy
    countUnsubscribe();
    anotherUnsubscribe();

    // Now destroy the chunks - no warning should appear
    countChunk.destroy();
    anotherChunk.destroy();

    // Try setting new values after destruction
    countChunk.set(30);
    anotherChunk.set(40);

    // Ensure that the subscribers were not notified after destroy
    expect(countCallback).toHaveBeenCalledTimes(0);
    expect(anotherCallback).toHaveBeenCalledTimes(0);
  });

  it('should reset to initial value after destroy', () => {
    // Set some values
    countChunk.set(10);
    anotherChunk.set(20);

    // Destroy the chunks (no subscribers at this point, so no warning)
    countChunk.destroy();
    anotherChunk.destroy();

    // Subscribe new callbacks after destroy
    const newCountCallback = jest.fn();
    const newAnotherCallback = jest.fn();

    const newCountUnsubscribe = countChunk.subscribe(newCountCallback);
    const newAnotherUnsubscribe = anotherChunk.subscribe(newAnotherCallback);

    // Should receive initial values
    expect(newCountCallback).toHaveBeenCalledWith(0);
    expect(newAnotherCallback).toHaveBeenCalledWith(0);

    // Cleanup
    newCountUnsubscribe();
    newAnotherUnsubscribe();
  });

  // Clean up after all tests
  afterAll(() => {
    countChunk.destroy();
    anotherChunk.destroy();
  });
});
