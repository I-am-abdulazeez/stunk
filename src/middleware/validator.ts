import { Middleware } from "../core";

export const nonNegativeValidator: Middleware<number> = (value, next) => {
  if (value < 0) {
    throw new Error("Value must be non-negative!");
  }
  next(value); // If validation passes, proceed with the update
};
