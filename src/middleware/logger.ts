import type { Middleware } from "../core/core";

export const logger: <T>() => Middleware<T> = () => (value, next) => {
  console.log("Setting value:", value);
  next(value);
};
