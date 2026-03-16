import type { Middleware } from "../core/core";

/**
 * Middleware that logs every value passed to `set()` to the console.
 *
 * @example
 * const count = chunk(0, { middleware: [logger()] });
 * count.set(5); // logs: "Setting value: 5"
 */
export const logger: <T>() => Middleware<T> = () => (value) => {
  console.log("Setting value:", value);
  return value;
};
