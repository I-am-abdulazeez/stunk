import { describe, expect, it, vi } from "vitest";
import { mutation } from "../../src/query/mutation";
import { asyncChunk } from "../../src/query/async-chunk";
import { useMutation } from "../../src/use-vue/composables/use-mutation";
import { withSetup, delay } from "./helpers";

describe("useMutation (vue)", () => {
  it("should start in the initial state", () => {
    const createPost = mutation(async (title: string) => ({ id: 1, title }));
    const { result, unmount } = withSetup(() => useMutation(createPost));

    expect(result.loading.value).toBe(false);
    expect(result.data.value).toBe(null);
    expect(result.error.value).toBe(null);
    expect(result.isSuccess.value).toBe(false);
    unmount();
  });

  it("should track loading during the mutation and data on success", async () => {
    const createPost = mutation(async (title: string) => {
      await delay(10);
      return { id: 1, title };
    });

    const { result, unmount } = withSetup(() => useMutation(createPost));

    const promise = result.mutate("Hello");
    await vi.waitFor(() => expect(result.loading.value).toBe(true));

    await promise;

    expect(result.loading.value).toBe(false);
    expect(result.data.value).toEqual({ id: 1, title: "Hello" });
    expect(result.isSuccess.value).toBe(true);
    expect(result.error.value).toBe(null);
    unmount();
  });

  it("should resolve with { data, error } and never throw on failure", async () => {
    const failing = mutation(async (_title: string) => {
      await delay(5);
      throw new Error("save failed");
    });

    const { result, unmount } = withSetup(() => useMutation(failing));

    const { data, error } = await result.mutate("Hello");

    expect(data).toBe(null);
    expect(error).toBeInstanceOf(Error);
    expect(result.error.value?.message).toBe("save failed");
    expect(result.isSuccess.value).toBe(false);
    expect(result.loading.value).toBe(false);
    unmount();
  });

  it("should reset state back to initial", async () => {
    const createPost = mutation(async (title: string) => ({ id: 1, title }));
    const { result, unmount } = withSetup(() => useMutation(createPost));

    await result.mutate("Hello");
    expect(result.isSuccess.value).toBe(true);

    result.reset();

    expect(result.data.value).toBe(null);
    expect(result.error.value).toBe(null);
    expect(result.isSuccess.value).toBe(false);
    unmount();
  });

  it("should reload invalidated chunks after a successful mutation", async () => {
    let fetchCount = 0;
    const posts = asyncChunk(async () => {
      fetchCount++;
      return ["post-1"];
    });

    await vi.waitFor(() => expect(fetchCount).toBe(1));

    const createPost = mutation(async (title: string) => ({ id: 1, title }), {
      invalidates: [posts],
    });

    const { result, unmount } = withSetup(() => useMutation(createPost));

    await result.mutate("Hello");

    await vi.waitFor(() => expect(fetchCount).toBe(2));
    unmount();
  });

  it("should stop syncing after unmount", async () => {
    const createPost = mutation(async (title: string) => {
      await delay(10);
      return { id: 1, title };
    });

    const { result, unmount } = withSetup(() => useMutation(createPost));

    const promise = createPost.mutate("Hello");
    unmount();
    await promise;

    expect(result.data.value).toBe(null);
    expect(createPost.get().data).toEqual({ id: 1, title: "Hello" });
  });
});
