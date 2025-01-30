import { chunk } from "../src/core/core";
import { logger } from "../src/middleware/logger";
import { nonNegativeValidator } from "../src/middleware/validator";

describe("Middleware Tests", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();  // Restores all spies
    jest.clearAllTimers();    // Clears any lingering timers
  });

  test("Logger middleware should log updates", () => {
    const count = chunk(0, [logger]);

    const unsubscribe = count.subscribe(() => { }); // Subscribe to capture updates

    try {
      count.set(5); // Should log: "Setting value: 5"
      expect(consoleSpy).toHaveBeenCalledWith("Setting value:", 5);
    } finally {
      unsubscribe(); // Ensure cleanup after test
      consoleSpy.mockRestore();
    }
  });

  test("Non-negative validator middleware should prevent negative values", () => {
    const count = chunk(0, [nonNegativeValidator]);

    expect(() => count.set(-5)).toThrow("Value must be non-negative!");
    expect(count.get()).toBe(0); // Value should remain unchanged
  });
});
