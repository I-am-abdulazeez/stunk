import { describe, expect, it, vi } from "vitest";
import { chunk } from "../../src/core/core";
import { select } from "../../src/core/selector";
import { useChunk } from "../../src/use-vue/composables/use-chunk";
import { withSetup } from "./helpers";

describe("useChunk (vue)", () => {
  it("should return the current chunk value as a computed", () => {
    const count = chunk(5);
    const { result, unmount } = withSetup(() => useChunk(count));

    expect(result.value.value).toBe(5);
    unmount();
  });

  it("should update the computed when the chunk changes externally", () => {
    const count = chunk(0);
    const { result, unmount } = withSetup(() => useChunk(count));

    count.set(10);
    expect(result.value.value).toBe(10);
    unmount();
  });

  it("should update the chunk by assigning to value.value", () => {
    const count = chunk(0);
    const { result, unmount } = withSetup(() => useChunk(count));

    result.value.value = 7;
    expect(count.get()).toBe(7);
    expect(result.value.value).toBe(7);
    unmount();
  });

  it("should support updater functions when assigning to value.value", () => {
    const count = chunk(1);
    const { result, unmount } = withSetup(() => useChunk(count));

    result.value.value = (current) => current + 4;
    expect(result.value.value).toBe(5);
    unmount();
  });

  it("should reset the chunk to its initial value", () => {
    const count = chunk(3);
    const { result, unmount } = withSetup(() => useChunk(count));

    result.value.value = 99;
    result.reset();
    expect(result.value.value).toBe(3);
    expect(count.get()).toBe(3);
    unmount();
  });

  it("should apply a selector and track only the selected slice", () => {
    const user = chunk({ name: "Alice", age: 30 });
    const { result, unmount } = withSetup(() => useChunk(user, (u) => u.name));

    expect(result.value.value).toBe("Alice");

    user.set({ name: "Alice", age: 31 });
    expect(result.value.value).toBe("Alice");

    user.set({ name: "Bob", age: 31 });
    expect(result.value.value).toBe("Bob");
    unmount();
  });

  it("should be read-only for read-only selected chunks — writes are a no-op", () => {
    const count = chunk(2);
    const doubled = select(count, (n) => n * 2);
    const { result, unmount } = withSetup(() => useChunk(doubled));

    expect(result.value.value).toBe(4);

    // value is a plain ComputedRef here (a type error in real usage) —
    // assignment is a dev-mode no-op (Vue warns), matching a genuinely
    // read-only chunk.
    (result.value as { value: number }).value = 100;
    expect(result.value.value).toBe(4);

    result.reset();
    expect(result.value.value).toBe(4);
    unmount();
  });

  it("should be read-only when a selector is used, even on a writable source chunk", () => {
    const user = chunk({ name: "Alice", age: 30 });
    const { result, unmount } = withSetup(() => useChunk(user, (u) => u.name));

    // selecting always returns a read-only computed (a type error in real usage)
    (result.value as { value: string }).value = "Mallory";
    expect(result.value.value).toBe("Alice");
    expect(user.get()).toEqual({ name: "Alice", age: 30 });
    unmount();
  });

  it("should track derived chunks reactively", () => {
    const count = chunk(2);
    const doubled = count.derive((n) => n * 2);
    const { result, unmount } = withSetup(() => useChunk(doubled));

    count.set(5);
    expect(result.value.value).toBe(10);
    unmount();
  });

  it("should unsubscribe when the component unmounts", () => {
    const count = chunk(0);
    const { result, unmount } = withSetup(() => useChunk(count));

    unmount();
    count.set(50);
    expect(result.value.value).toBe(0);
  });

  it("should not leak the selector's internal subscription to the source chunk after unmount", () => {
    const user = chunk({ name: "Alice", age: 30 });
    const originalSubscribe = user.subscribe.bind(user);
    const capturedUnsubscribes: ReturnType<typeof vi.fn>[] = [];

    user.subscribe = ((callback: (value: { name: string; age: number }) => void) => {
      const unsubscribe = originalSubscribe(callback);
      const spy = vi.fn(unsubscribe);
      capturedUnsubscribes.push(spy);
      return spy;
    }) as typeof user.subscribe;

    const { unmount } = withSetup(() => useChunk(user, (u) => u.name));

    // select() registers exactly one internal subscription on the source chunk
    expect(capturedUnsubscribes).toHaveLength(1);
    expect(capturedUnsubscribes[0]).not.toHaveBeenCalled();

    unmount();

    expect(capturedUnsubscribes[0]).toHaveBeenCalledTimes(1);
  });

  it("should not destroy the shared source chunk when destroy is called on a selector-based useChunk", () => {
    const user = chunk({ name: "Alice", age: 30 });
    const { result, unmount } = withSetup(() => useChunk(user, (u) => u.name));

    // Mutate before destroy — a source-destroying bug resets this back to
    // the initial value, which a same-as-initial assertion would miss.
    user.set({ name: "Bob", age: 31 });
    result.destroy();

    // Only the internal per-component derived chunk should be torn down —
    // a shared source chunk must survive, untouched, for other consumers.
    expect(user.get()).toEqual({ name: "Bob", age: 31 });

    const listener = vi.fn();
    const unsubscribeListener = user.subscribe(listener);
    user.set({ name: "Carol", age: 40 });
    expect(listener).toHaveBeenCalledWith({ name: "Carol", age: 40 });
    unsubscribeListener();

    unmount();
  });

  it("should destroy the chunk via the returned destroy", () => {
    const count = chunk(1);
    const { result, unmount } = withSetup(() => useChunk(count));

    result.value.value = 9;
    result.destroy();
    expect(count.get()).toBe(1);
    unmount();
  });
});
