import { describe, expect, it } from "vitest";
import { chunk } from "../../src/core/core";
import { computed } from "../../src/core/computed";
import { select } from "../../src/core/selector";
import { useChunkValue } from "../../src/use-vue/composables/use-chunk-value";
import { withSetup } from "./helpers";

describe("useChunkValue (vue)", () => {
  it("should return a ref tracking the chunk value", () => {
    const count = chunk(1);
    const { result: value, unmount } = withSetup(() => useChunkValue(count));

    expect(value.value).toBe(1);
    count.set(2);
    expect(value.value).toBe(2);
    unmount();
  });

  it("should work with derived chunks", () => {
    const user = chunk({ name: "Alice" });
    const isAlice = user.derive((u) => u.name === "Alice");
    const { result: value, unmount } = withSetup(() => useChunkValue(isAlice));

    expect(value.value).toBe(true);
    user.set({ name: "Bob" });
    expect(value.value).toBe(false);
    unmount();
  });

  it("should work with computed chunks", () => {
    const price = chunk(10);
    const qty = chunk(3);
    const total = computed(() => price.get() * qty.get());
    const { result: value, unmount } = withSetup(() => useChunkValue(total));

    expect(value.value).toBe(30);
    qty.set(5);
    expect(value.value).toBe(50);
    unmount();
  });

  it("should work with select()", () => {
    const user = chunk({ name: "Alice", age: 30 });
    const age = select(user, (u) => u.age);
    const { result: value, unmount } = withSetup(() => useChunkValue(age));

    expect(value.value).toBe(30);
    user.set({ name: "Alice", age: 31 });
    expect(value.value).toBe(31);
    unmount();
  });

  it("should apply a selector directly", () => {
    const user = chunk({ name: "Alice", age: 30 });
    const { result: name, unmount } = withSetup(() => useChunkValue(user, (u) => u.name));

    expect(name.value).toBe("Alice");
    user.set({ name: "Bob", age: 30 });
    expect(name.value).toBe("Bob");
    unmount();
  });

  it("should stop tracking after unmount", () => {
    const count = chunk(0);
    const { result: value, unmount } = withSetup(() => useChunkValue(count));

    unmount();
    count.set(42);
    expect(value.value).toBe(0);
  });
});
