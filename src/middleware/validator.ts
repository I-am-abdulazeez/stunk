import type { Middleware } from "../core/core";

/**
 * Middleware that throws if a numeric value is set below zero.
 *
 * @example
 * const balance = chunk(100, { middleware: [nonNegativeValidator] });
 * balance.set(-1); // throws: "Value must be non-negative!"
 */
export const nonNegativeValidator: Middleware<number> = (value) => {
  if (value < 0) {
    throw new Error("Value must be non-negative!");
  }
  return value;
};
