import { chunk } from "../src/core";
import { logger } from "../src/middleware/logger";
import { nonNegativeValidator } from "../src/middleware/validator";

test("Logger middleware should log updates", () => {
  const consoleSpy = jest.spyOn(console, "log");
  const count = chunk(0, [logger]);

  count.set(5); // Should log: Setting value: 5
  expect(consoleSpy).toHaveBeenCalledWith("Setting value:", 5);

  consoleSpy.mockRestore(); // Clean up the spy
});

test("Non-negative validator middleware should prevent negative values", () => {
  const count = chunk(0, [nonNegativeValidator]);

  expect(() => count.set(-5)).toThrow("Value must be non-negative!");
  expect(count.get()).toBe(0); // Value should remain unchanged
});
