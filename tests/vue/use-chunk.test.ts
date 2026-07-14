import { describe, expect, it } from "vitest";
import { chunk } from "../../src/core/core";
import { select } from "../../src/core/selector";
import { useChunk } from "../../src/use-vue/composables/use-chunk";
import { withSetup } from "./helpers";

describe("useChunk (vue)", () => {
  it("should return the current chunk value as a ref", () => {
    const count = chunk(5);
    const { result, unmount } = withSetup(() => useChunk(count));
    const [value] = result;

    expect(value.value).toBe(5);
    unmount();
  });

  it("should update the ref when the chunk changes externally", () => {
    const count = chunk(0);
    const { result, unmount } = withSetup(() => useChunk(count));
    const [value] = result;

    count.set(10);
    expect(value.value).toBe(10);
    unmount();
  });

  it("should update the chunk via the returned setter", () => {
    const count = chunk(0);
    const { result, unmount } = withSetup(() => useChunk(count));
    const [value, setValue] = result;

    setValue(7);
    expect(count.get()).toBe(7);
    expect(value.value).toBe(7);
    unmount();
  });

  it("should support updater functions in the setter", () => {
    const count = chunk(1);
    const { result, unmount } = withSetup(() => useChunk(count));
    const [value, setValue] = result;

    setValue((current) => current + 4);
    expect(value.value).toBe(5);
    unmount();
  });

  it("should reset the chunk to its initial value", () => {
    const count = chunk(3);
    const { result, unmount } = withSetup(() => useChunk(count));
    const [value, setValue, reset] = result;

    setValue(99);
    reset();
    expect(value.value).toBe(3);
    expect(count.get()).toBe(3);
    unmount();
  });

  it("should apply a selector and track only the selected slice", () => {
    const user = chunk({ name: "Alice", age: 30 });
    const { result, unmount } = withSetup(() => useChunk(user, (u) => u.name));
    const [name] = result;

    expect(name.value).toBe("Alice");

    user.set({ name: "Alice", age: 31 });
    expect(name.value).toBe("Alice");

    user.set({ name: "Bob", age: 31 });
    expect(name.value).toBe("Bob");
    unmount();
  });

  it("should treat set and reset as no-ops for read-only selected chunks", () => {
    const count = chunk(2);
    const doubled = select(count, (n) => n * 2);
    const { result, unmount } = withSetup(() => useChunk(doubled));
    const [value, setValue, reset] = result;

    expect(value.value).toBe(4);

    setValue(100);
    expect(value.value).toBe(4);

    reset();
    expect(value.value).toBe(4);
    unmount();
  });

  it("should track derived chunks reactively", () => {
    const count = chunk(2);
    const doubled = count.derive((n) => n * 2);
    const { result, unmount } = withSetup(() => useChunk(doubled));
    const [value] = result;

    count.set(5);
    expect(value.value).toBe(10);
    unmount();
  });

  it("should unsubscribe when the component unmounts", () => {
    const count = chunk(0);
    const { result, unmount } = withSetup(() => useChunk(count));
    const [value] = result;

    unmount();
    count.set(50);
    expect(value.value).toBe(0);
  });

  it("should destroy the chunk via the returned destroy", () => {
    const count = chunk(1);
    const { result, unmount } = withSetup(() => useChunk(count));
    const [, setValue, , destroy] = result;

    setValue(9);
    destroy();
    expect(count.get()).toBe(1);
    unmount();
  });
});
