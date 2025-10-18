import type { Middleware } from "../core/core";

export const nonNegativeValidator: Middleware<number> = (value, next) => {
  if (value < 0) {
    throw new Error("Value must be non-negative!");
  }
  next(value);
};
