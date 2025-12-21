import { Middleware } from "../core/core";

export const logger: Middleware<any> = (value) => {
  console.log("Setting value:", value);
  return value;
};
