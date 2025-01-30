import { Middleware } from "../core/core";

export const logger: Middleware<any> = (value, next) => {
  console.log("Setting value:", value);
  next(value);
};
