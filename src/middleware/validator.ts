<<<<<<< HEAD
import { Middleware } from "../core/core";

=======
import type { Middleware } from "../core/core";

/**
 * Middleware that throws if a numeric value is set below zero.
 *
 * @example
 * const balance = chunk(100, { middleware: [nonNegativeValidator] });
 * balance.set(-1); // throws: "Value must be non-negative!"
 */
>>>>>>> v3
export const nonNegativeValidator: Middleware<number> = (value) => {
  if (value < 0) {
    throw new Error("Value must be non-negative!");
  }
<<<<<<< HEAD
  return value; // Return the value if valid
=======
  return value;
>>>>>>> v3
};
