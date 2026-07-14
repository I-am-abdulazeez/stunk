import { describe, expect, it, vi } from "vitest";
import { ref, nextTick, defineComponent, h } from "vue";
import { render, screen, waitFor } from "@testing-library/vue";
import { asyncChunk, paginatedAsyncChunk } from "../../src/query/async-chunk";
import { useAsyncChunk } from "../../src/use-vue/composables/use-async-chunk";
import { withSetup, delay } from "./helpers";

describe("useAsyncChunk (vue) — basic state", () => {
  it("should expose loading then data after the initial fetch", async () => {
    const userChunk = asyncChunk(async () => {
      await delay(10);
      return { name: "Alice" };
    });

    const { result, unmount } = withSetup(() => useAsyncChunk(userChunk));

    expect(result.loading.value).toBe(true);
    expect(result.data.value).toBe(null);

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
      expect(result.data.value).toEqual({ name: "Alice" });
      expect(result.error.value).toBe(null);
      expect(result.lastFetched.value).toBeTypeOf("number");
    });

    unmount();
  });

  it("should expose the error when the fetch fails", async () => {
    const failing = asyncChunk(async () => {
      await delay(5);
      throw new Error("boom");
    });

    const { result, unmount } = withSetup(() => useAsyncChunk(failing));

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
      expect(result.error.value).toBeInstanceOf(Error);
      expect(result.error.value?.message).toBe("boom");
      expect(result.data.value).toBe(null);
    });

    unmount();
  });

  it("should call onSuccess with the fetched data", async () => {
    const onSuccess = vi.fn();
    const userChunk = asyncChunk(async () => {
      await delay(5);
      return "hello";
    });

    const { unmount } = withSetup(() => useAsyncChunk(userChunk, { onSuccess }));

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("hello");
    });

    unmount();
  });

  it("should call onError with the fetch error", async () => {
    const onError = vi.fn();
    const failing = asyncChunk(async () => {
      await delay(5);
      throw new Error("nope");
    });

    const { unmount } = withSetup(() => useAsyncChunk(failing, { onError }));

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toBe("nope");
    });

    unmount();
  });

  it("should update data via mutate without a network request", async () => {
    let fetchCount = 0;
    const userChunk = asyncChunk(async () => {
      fetchCount++;
      return "original";
    });

    const { result, unmount } = withSetup(() => useAsyncChunk(userChunk));

    await vi.waitFor(() => expect(result.data.value).toBe("original"));

    result.mutate(() => "mutated");
    expect(result.data.value).toBe("mutated");
    expect(fetchCount).toBe(1);

    unmount();
  });

  it("should reset back to initial state and refetch", async () => {
    const userChunk = asyncChunk(async () => {
      await delay(5);
      return "fresh";
    });

    const { result, unmount } = withSetup(() => useAsyncChunk(userChunk));

    await vi.waitFor(() => expect(result.data.value).toBe("fresh"));

    result.mutate(() => "dirty");
    result.reset();

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
      expect(result.data.value).toBe("fresh");
    });

    unmount();
  });

  it("should stop syncing after unmount", async () => {
    const userChunk = asyncChunk(async () => {
      await delay(5);
      return "done";
    });

    const { result, unmount } = withSetup(() => useAsyncChunk(userChunk));

    unmount();
    await delay(20);

    expect(result.loading.value).toBe(true);
    expect(result.data.value).toBe(null);
    expect(userChunk.get().data).toBe("done");
  });
});

describe("useAsyncChunk (vue) — fetchOnMount", () => {
  it("should not refetch when data is already loaded", async () => {
    let fetchCount = 0;
    const userChunk = asyncChunk(async () => {
      fetchCount++;
      return "cached";
    });

    await vi.waitFor(() => expect(fetchCount).toBe(1));

    const { result, unmount } = withSetup(() => useAsyncChunk(userChunk));

    await delay(20);
    expect(fetchCount).toBe(1);
    expect(result.data.value).toBe("cached");

    unmount();
  });

  it("should force a refetch with fetchOnMount even when data exists", async () => {
    let fetchCount = 0;
    const userChunk = asyncChunk(async () => {
      fetchCount++;
      return "cached";
    });

    await vi.waitFor(() => expect(fetchCount).toBe(1));

    const { unmount } = withSetup(() =>
      useAsyncChunk(userChunk, { fetchOnMount: true })
    );

    await vi.waitFor(() => expect(fetchCount).toBe(2));

    unmount();
  });
});

describe("useAsyncChunk (vue) — enabled & params", () => {
  it("should not fetch while enabled is false, then fetch when it flips true", async () => {
    let fetchCount = 0;
    const userChunk = asyncChunk(async ({ id }: { id: number }) => {
      fetchCount++;
      return `user-${id}`;
    });

    const enabled = ref(false);
    const { result, unmount } = withSetup(() =>
      useAsyncChunk(userChunk, { params: { id: 1 }, enabled })
    );

    await delay(20);
    expect(fetchCount).toBe(0);
    expect(result.data.value).toBe(null);

    enabled.value = true;
    await nextTick();

    await vi.waitFor(() => {
      expect(fetchCount).toBe(1);
      expect(result.data.value).toBe("user-1");
    });

    unmount();
  });

  it("should cancel the in-flight request when enabled flips false", async () => {
    const userChunk = asyncChunk(async ({ id }: { id: number }) => {
      await delay(50);
      return `user-${id}`;
    });

    const enabled = ref(true);
    const { result, unmount } = withSetup(() =>
      useAsyncChunk(userChunk, { params: { id: 1 }, enabled })
    );

    await vi.waitFor(() => expect(result.loading.value).toBe(true));

    enabled.value = false;
    await nextTick();

    expect(result.loading.value).toBe(false);

    await delay(60);
    expect(result.data.value).toBe(null);

    unmount();
  });

  it("should refetch when reactive params change", async () => {
    let fetchCount = 0;
    const userChunk = asyncChunk(async ({ id }: { id: number }) => {
      fetchCount++;
      return `user-${id}`;
    });

    const id = ref(1);
    const { result, unmount } = withSetup(() =>
      useAsyncChunk(userChunk, { params: () => ({ id: id.value }) })
    );

    await vi.waitFor(() => expect(result.data.value).toBe("user-1"));

    id.value = 2;
    await nextTick();

    await vi.waitFor(() => {
      expect(result.data.value).toBe("user-2");
      expect(fetchCount).toBe(2);
    });

    unmount();
  });

  it("should fetch only once when enabled flips true and params change together", async () => {
    let fetchCount = 0;
    const userChunk = asyncChunk(async ({ id }: { id: number }) => {
      fetchCount++;
      return `user-${id}`;
    });

    const enabled = ref(false);
    const id = ref(1);
    const { result, unmount } = withSetup(() =>
      useAsyncChunk(userChunk, { params: () => ({ id: id.value }), enabled })
    );

    await delay(20);
    expect(fetchCount).toBe(0);

    // Both change in the same tick — must produce exactly one fetch
    enabled.value = true;
    id.value = 2;
    await nextTick();

    await vi.waitFor(() => expect(result.data.value).toBe("user-2"));
    await delay(20);
    expect(fetchCount).toBe(1);

    unmount();
  });

  it("should expose setParams and clearParams for param chunks", async () => {
    const userChunk = asyncChunk(async ({ id }: { id: number }) => `user-${id}`);

    const { result, unmount } = withSetup(() => useAsyncChunk(userChunk));
    const withParams = result as typeof result & {
      setParams: (params: { id: number | null }) => void;
      clearParams: () => void;
    };

    expect(typeof withParams.setParams).toBe("function");
    expect(typeof withParams.clearParams).toBe("function");

    withParams.setParams({ id: 3 });
    await vi.waitFor(() => expect(result.data.value).toBe("user-3"));

    unmount();
  });
});

describe("useAsyncChunk (vue) — pagination", () => {
  it("should expose pagination state and advance pages", async () => {
    const pages = paginatedAsyncChunk(
      async ({ page }: { page: number; pageSize: number }) => ({
        data: [`page-${page}`],
        hasMore: true,
      }),
      { pagination: { pageSize: 10, mode: "replace" } }
    );

    const { result, unmount } = withSetup(() => useAsyncChunk(pages));
    const paginated = result as typeof result & {
      pagination: { value?: { page: number } };
      nextPage: () => Promise<void>;
    };

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(["page-1"]);
      expect(paginated.pagination.value?.page).toBe(1);
    });

    await paginated.nextPage();

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(["page-2"]);
      expect(paginated.pagination.value?.page).toBe(2);
    });

    unmount();
  });
});

describe("useAsyncChunk (vue) — scoped resolution", () => {
  const TestConsumer = defineComponent({
    props: {
      chunk: { type: Object, required: true },
      label: { type: String, required: true },
    },
    setup(props) {
      const { data, pagination, nextPage } = useAsyncChunk(props.chunk as any) as any;
      return () =>
        h("div", [
          h("span", { "data-testid": `${props.label}-page` }, String(pagination?.value?.page ?? "n/a")),
          h("span", { "data-testid": `${props.label}-data` }, JSON.stringify(data.value)),
          h("button", { "data-testid": `${props.label}-next`, onClick: () => nextPage() }, "next"),
        ]);
    },
  });

  it("should give each component its own instance for a scoped chunk", async () => {
    const sharedExport = paginatedAsyncChunk(
      async ({ page }: { page: number; pageSize: number }) => ({
        data: [`page-${page}`],
        hasMore: true,
      }),
      {
        pagination: { pageSize: 10, mode: "replace" },
        scoped: true,
      } as any
    );

    render(
      defineComponent(() => () =>
        h("div", [
          h(TestConsumer, { chunk: sharedExport, label: "a" }),
          h(TestConsumer, { chunk: sharedExport, label: "b" }),
        ])
      )
    );

    await waitFor(() => {
      expect(screen.getByTestId("a-data").textContent).toContain("page-1");
      expect(screen.getByTestId("b-data").textContent).toContain("page-1");
    });

    // Advance only consumer A to page 2
    screen.getByTestId("a-next").click();
    await delay(50);

    await waitFor(() => {
      expect(screen.getByTestId("a-page").textContent).toBe("2");
      // B must remain on page 1 — independent instance, not shared state
      expect(screen.getByTestId("b-page").textContent).toBe("1");
    });
  });

  it("should share state across components for a non-scoped chunk", async () => {
    const sharedExport = paginatedAsyncChunk(
      async ({ page }: { page: number; pageSize: number }) => ({
        data: [`page-${page}`],
        hasMore: true,
      }),
      { pagination: { pageSize: 10, mode: "replace" } }
    );

    render(
      defineComponent(() => () =>
        h("div", [
          h(TestConsumer, { chunk: sharedExport, label: "a" }),
          h(TestConsumer, { chunk: sharedExport, label: "b" }),
        ])
      )
    );

    await waitFor(() => {
      expect(screen.getByTestId("a-page").textContent).toBe("1");
      expect(screen.getByTestId("b-page").textContent).toBe("1");
    });

    screen.getByTestId("a-next").click();
    await delay(50);

    // Both consumers observe the same underlying chunk — B updates too
    await waitFor(() => {
      expect(screen.getByTestId("a-page").textContent).toBe("2");
      expect(screen.getByTestId("b-page").textContent).toBe("2");
    });
  });
});
