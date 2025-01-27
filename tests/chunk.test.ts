// tests/chunk.test.ts

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

  chunky.set(5);
  expect(callback).toHaveBeenCalledWith(5);

  unsubscribe();
  chunky.set(10); // No callback should be called now
  expect(callback).toHaveBeenCalledTimes(1);
});
