import type { Middleware } from "../core/core";

<<<<<<< HEAD
export const logger: Middleware<any> = (value) => {
  console.log("Setting value:", value);
  return value;
};
=======
/**
 * Middleware that logs every value passed to `set()` to the console.
 *
 * @example
 * const count = chunk(0, { middleware: [logger()] });
 * count.set(5); // logs: "Setting value: 5"
 */
export function logger<T>(): Middleware<T> {
  return (value) => {
    console.log("Setting value:", value);
    return value;
  };
}
>>>>>>> v3
