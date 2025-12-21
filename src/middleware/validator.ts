import { Middleware } from "../core/core";

export const nonNegativeValidator: Middleware<number> = (value) => {
  if (value < 0) {
    throw new Error("Value must be non-negative!");
  }
  return value; // Return the value if valid
};
