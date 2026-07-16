import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { infiniteAsyncChunk } from "../../src/query/infinite-async-chunk";
import { useInfiniteAsyncChunk } from "../../src/use-vue/composables/use-infinite-async-chunk";
import { withSetup, delay } from "./helpers";

type IntersectionCallback = (entries: { isIntersecting: boolean }[]) => void;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: IntersectionCallback;
  observed = new Set<Element>();
  disconnected = false;

  constructor(callback: IntersectionCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.add(el);
  }

  unobserve(el: Element) {
    this.observed.delete(el);
  }

  disconnect() {
    this.observed.clear();
    this.disconnected = true;
  }

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

function createPagesChunk(totalPages = 3, fetchDelay = 0) {
  let fetchCount = 0;
  const chunk = infiniteAsyncChunk(
    async ({ page = 1 }: { page?: number; pageSize: number }) => {
      fetchCount++;
      if (fetchDelay) await delay(fetchDelay);
      return { data: [`item-${page}`], hasMore: page < totalPages };
    },
    { pageSize: 10 }
  );
  return { chunk, getFetchCount: () => fetchCount };
}

describe("useInfiniteAsyncChunk (vue)", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should load page 1 on mount and accumulate pages via loadMore", async () => {
    const { chunk } = createPagesChunk();
    const { result, unmount } = withSetup(() => useInfiniteAsyncChunk(chunk));

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(["item-1"]);
      expect(result.hasMore.value).toBe(true);
    });

    result.loadMore();
    await vi.waitFor(() => {
      expect(result.data.value).toEqual(["item-1", "item-2"]);
      expect(result.pagination.value?.page).toBe(2);
    });

    result.loadMore();
    await vi.waitFor(() => {
      expect(result.data.value).toEqual(["item-1", "item-2", "item-3"]);
      expect(result.hasMore.value).toBe(false);
    });

    unmount();
  });

  it("should ignore loadMore when there are no more pages", async () => {
    const { chunk, getFetchCount } = createPagesChunk(1);
    const { result, unmount } = withSetup(() => useInfiniteAsyncChunk(chunk));

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(["item-1"]);
      expect(result.hasMore.value).toBe(false);
    });

    result.loadMore();
    await delay(20);

    expect(getFetchCount()).toBe(1);
    expect(result.data.value).toEqual(["item-1"]);
    unmount();
  });

  it("should ignore loadMore while a page is already loading", async () => {
    const { chunk, getFetchCount } = createPagesChunk(5, 20);
    const { result, unmount } = withSetup(() => useInfiniteAsyncChunk(chunk));

    await vi.waitFor(() => expect(result.data.value).toEqual(["item-1"]));

    result.loadMore();
    result.loadMore();
    result.loadMore();

    await vi.waitFor(() => expect(result.data.value).toEqual(["item-1", "item-2"]));
    await delay(30);

    expect(getFetchCount()).toBe(2);
    unmount();
  });

  it("should report isFetchingMore only while fetching a subsequent page", async () => {
    const { chunk } = createPagesChunk(3, 20);
    const { result, unmount } = withSetup(() => useInfiniteAsyncChunk(chunk));

    // Initial load — loading, but not "fetching more"
    expect(result.isFetchingMore.value).toBe(false);
    await vi.waitFor(() => expect(result.data.value).toEqual(["item-1"]));

    result.loadMore();
    await vi.waitFor(() => expect(result.isFetchingMore.value).toBe(true));

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(["item-1", "item-2"]);
      expect(result.isFetchingMore.value).toBe(false);
    });

    unmount();
  });

  it("should load the next page when the sentinel intersects and stop when it leaves", async () => {
    // Slow fetches so each page load is an unambiguous landmark — the
    // reactive cascade would outrun waitFor's poll interval otherwise
    const { chunk, getFetchCount } = createPagesChunk(5, 100);
    const { result, unmount } = withSetup(() => useInfiniteAsyncChunk(chunk));

    await vi.waitFor(() => expect(result.data.value).toEqual(["item-1"]));

    const observer = MockIntersectionObserver.instances[0];
    expect(observer).toBeDefined();

    const sentinel = document.createElement("div");
    result.observerTarget.value = sentinel;
    await nextTick();

    expect(observer.observed.has(sentinel)).toBe(true);

    observer.trigger(true);
    await vi.waitFor(() => expect(result.loading.value).toBe(true));

    // New content pushes the sentinel out of the viewport while page 2 is
    // still in flight — the cascade must stop after it lands
    observer.trigger(false);

    await vi.waitFor(() => expect(result.data.value).toEqual(["item-1", "item-2"]));
    await delay(150);
    expect(result.data.value).toEqual(["item-1", "item-2"]);
    expect(getFetchCount()).toBe(2);

    unmount();
  });

  it("should auto-load once loading settles when the sentinel was already visible during the initial load", async () => {
    const { chunk, getFetchCount } = createPagesChunk(2, 10);
    const { result, unmount } = withSetup(() => useInfiniteAsyncChunk(chunk));

    const observer = MockIntersectionObserver.instances[0];
    const sentinel = document.createElement("div");
    result.observerTarget.value = sentinel;
    await nextTick();

    // The sentinel is visible while page 1 is still loading. A real
    // IntersectionObserver notifies exactly once here and never again —
    // no crossing happens if the sentinel stays in the viewport.
    observer.trigger(true);
    expect(result.loading.value).toBe(true);

    // Once loading settles, page 2 must load without another notification.
    await vi.waitFor(() =>
      expect(result.data.value).toEqual(["item-1", "item-2"])
    );
    expect(result.hasMore.value).toBe(false);
    expect(getFetchCount()).toBe(2);

    unmount();
  });

  it("should not load when the sentinel intersects but hasMore is false", async () => {
    const { chunk, getFetchCount } = createPagesChunk(1);
    const { result, unmount } = withSetup(() => useInfiniteAsyncChunk(chunk));

    await vi.waitFor(() => expect(result.hasMore.value).toBe(false));

    const observer = MockIntersectionObserver.instances[0];
    const sentinel = document.createElement("div");
    result.observerTarget.value = sentinel;
    await nextTick();

    observer.trigger(true);
    await delay(20);

    expect(getFetchCount()).toBe(1);
    unmount();
  });

  it("should not create an observer when autoLoad is false", async () => {
    const { chunk } = createPagesChunk();
    const { result, unmount } = withSetup(() =>
      useInfiniteAsyncChunk(chunk, { autoLoad: false })
    );

    await vi.waitFor(() => expect(result.data.value).toEqual(["item-1"]));

    expect(MockIntersectionObserver.instances).toHaveLength(0);
    unmount();
  });

  it("should disconnect the observer on unmount", async () => {
    const { chunk } = createPagesChunk();
    const { result, unmount } = withSetup(() => useInfiniteAsyncChunk(chunk));

    await vi.waitFor(() => expect(result.data.value).toEqual(["item-1"]));

    const observer = MockIntersectionObserver.instances[0];
    unmount();

    expect(observer.disconnected).toBe(true);
  });
});
