import type { Middleware } from "../core/core";

export const logger: <T>() => Middleware<T> = () => (value) => {
  console.log("Setting value:", value);
  return value;
};
