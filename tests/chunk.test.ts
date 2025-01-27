// tests/chunk.test.ts

import { createChunk } from "../src/core";

test("Chunk should get and set values correctly", () => {
  const chunk = createChunk<number>(0);
  expect(chunk.get()).toBe(0);
  chunk.set(10);
  expect(chunk.get()).toBe(10);
});

test("Chunk should notify subscribers on value change", () => {
  const chunk = createChunk<number>(0);
  const callback = jest.fn();
  chunk.subscribe(callback);

  chunk.set(5);
  expect(callback).toHaveBeenCalledWith(5);

  chunk.set(10);
  expect(callback).toHaveBeenCalledWith(10);
});

test("Chunk should allow unsubscribing from updates", () => {
  const chunk = createChunk<number>(0);
  const callback = jest.fn();
  const unsubscribe = chunk.subscribe(callback);

  chunk.set(5);
  expect(callback).toHaveBeenCalledWith(5);

  unsubscribe();
  chunk.set(10); // No callback should be called now
  expect(callback).toHaveBeenCalledTimes(1);
});
