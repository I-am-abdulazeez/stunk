import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { infiniteAsyncChunk } from "../../src/query/infinite-async-chunk";

interface Post {
  id: number;
  title: string;
}

interface SearchParams {
  query?: string;
  category?: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createDelayedResponse = <T>(data: T, ms = 50): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(data), ms));

const createPostPage = (page: number, pageSize: number, total = 30) => {
  const start = (page - 1) * pageSize;
  return {
    data: Array.from({ length: Math.min(pageSize, total - start) }, (_, i) => ({
      id: start + i + 1,
      title: `Post ${start + i + 1}`,
    })),
    hasMore: start + pageSize < total,
    total,
  };
};

describe('infiniteAsyncChunk — core', () => {
  it('should not auto-fetch on creation since fetcher expects params', () => {
    const chunk = infiniteAsyncChunk(
      async ({ page, pageSize }: { page: number; pageSize: number }) =>
        createDelayedResponse(createPostPage(page, pageSize))
    );

    expect(chunk.get().loading).toBe(false);
    expect(chunk.get().data).toBe(null);
  });

  it('should load first page and accumulate on nextPage', async () => {
    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize), 50),
      { pageSize: 10 }
    );

    chunk.reload();
    await delay(100);

    let state = chunk.get();
    expect(state.data).toHaveLength(10);
    expect(state.data?.[0].id).toBe(1);
    expect(state.pagination?.page).toBe(1);
    expect(state.pagination?.hasMore).toBe(true);

    await chunk.nextPage();
    await delay(100);

    state = chunk.get();
    expect(state.data).toHaveLength(20);
    expect(state.data?.[0].id).toBe(1);   // page 1 still present
    expect(state.data?.[10].id).toBe(11);  // page 2 appended
    expect(state.pagination?.page).toBe(2);
  });

  it('should accumulate across multiple pages correctly', async () => {
    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize, 30), 50),
      { pageSize: 10 }
    );

    chunk.reload();
    await delay(100);

    await chunk.nextPage();
    await delay(100);

    await chunk.nextPage();
    await delay(100);

    const state = chunk.get();
    expect(state.data).toHaveLength(30);
    expect(state.pagination?.hasMore).toBe(false);
    expect(state.pagination?.page).toBe(3);
  });

  it('should not advance past the last page when hasMore is false', async () => {
    let fetchCount = 0;

    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) => {
        fetchCount++;
        return createDelayedResponse(createPostPage(page, pageSize, 10), 50);
      },
      { pageSize: 10 }
    );

    chunk.reload();
    await delay(100);

    expect(chunk.get().pagination?.hasMore).toBe(false);
    const countAfterLoad = fetchCount;

    await chunk.nextPage(); // should be blocked
    await delay(100);

    expect(fetchCount).toBe(countAfterLoad);
    expect(chunk.get().pagination?.page).toBe(1);
  });

  it('should reset pagination and clear accumulated data', async () => {
    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize, 30), 50),
      { pageSize: 10 }
    );

    chunk.reload();
    await delay(100);

    await chunk.nextPage();
    await delay(100);

    expect(chunk.get().data).toHaveLength(20);
    expect(chunk.get().pagination?.page).toBe(2);

    await chunk.resetPagination();
    await delay(100);

    expect(chunk.get().data).toHaveLength(10);
    expect(chunk.get().pagination?.page).toBe(1);
  });

  it('should call onSuccess with the full accumulated data array', async () => {
    const successSnapshots: Post[][] = [];

    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize, 30), 50),
      {
        pageSize: 10,
        onSuccess: (data) => successSnapshots.push([...data]),
      }
    );

    chunk.reload();
    await delay(100);

    expect(successSnapshots).toHaveLength(1);
    expect(successSnapshots[0]).toHaveLength(10);

    await chunk.nextPage();
    await delay(100);

    expect(successSnapshots).toHaveLength(2);
    expect(successSnapshots[1]).toHaveLength(20); // full accumulated array
  });

  it('should call onError when fetch fails', async () => {
    const errors: Error[] = [];

    const chunk = infiniteAsyncChunk<Post>(
      async () => { throw new Error('Fetch failed'); },
      { onError: (e) => errors.push(e) }
    );

    chunk.reload();
    await delay(100);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Fetch failed');
  });
});

describe('infiniteAsyncChunk — params', () => {
  it('should pass user params to the fetcher alongside pagination', async () => {
    let lastParams: any;

    const chunk = infiniteAsyncChunk<Post, Error, SearchParams>(
      async (params) => {
        lastParams = { ...params };
        return createDelayedResponse(createPostPage(params.page, params.pageSize, 30), 50);
      },
      { pageSize: 10 }
    );

    chunk.setParams({ query: 'stunk', category: 'state' });
    await delay(100);

    expect(lastParams.query).toBe('stunk');
    expect(lastParams.category).toBe('state');
    expect(lastParams.page).toBe(1);
    expect(lastParams.pageSize).toBe(10);
  });

  it('should merge params on subsequent setParams calls', async () => {
    let lastParams: any;

    const chunk = infiniteAsyncChunk<Post, Error, SearchParams>(
      async (params) => {
        lastParams = { ...params };
        return createDelayedResponse(createPostPage(params.page, params.pageSize), 50);
      },
      { pageSize: 10 }
    );

    chunk.setParams({ query: 'stunk' });
    await delay(100);
    expect(lastParams.query).toBe('stunk');
    expect(lastParams.category).toBeUndefined();

    chunk.setParams({ category: 'state' });
    await delay(100);
    expect(lastParams.query).toBe('stunk');
    expect(lastParams.category).toBe('state');
  });

  it('should clear a specific param when null is passed to setParams', async () => {
    let lastParams: any;

    const chunk = infiniteAsyncChunk<Post, Error, SearchParams>(
      async (params) => {
        lastParams = { ...params };
        return createDelayedResponse(createPostPage(params.page, params.pageSize), 50);
      },
      { pageSize: 10 }
    );

    chunk.setParams({ query: 'stunk', category: 'state' });
    await delay(100);
    expect(lastParams.category).toBe('state');

    chunk.setParams({ category: null });
    await delay(100);
    expect('category' in lastParams).toBe(false);
    expect(lastParams.query).toBe('stunk');
  });

  it('should clear all params on clearParams', async () => {
    let lastParams: any;

    const chunk = infiniteAsyncChunk<Post, Error, SearchParams>(
      async (params) => {
        lastParams = { ...params };
        return createDelayedResponse(createPostPage(params.page, params.pageSize), 50);
      },
      { pageSize: 10 }
    );

    chunk.setParams({ query: 'stunk', category: 'state' });
    await delay(100);

    chunk.clearParams();
    await delay(100);

    expect(lastParams.query).toBeUndefined();
    expect(lastParams.category).toBeUndefined();
  });
});

describe('infiniteAsyncChunk — enabled', () => {
  it('should not fetch when enabled is false', async () => {
    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize), 50),
      { enabled: false }
    );

    chunk.reload();
    await delay(100);

    expect(chunk.get().data).toBe(null);
    expect(chunk.get().loading).toBe(false);
  });

  it('should support enabled as a function', async () => {
    let canFetch = false;

    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize), 50),
      { enabled: () => canFetch }
    );

    chunk.reload();
    await delay(100);
    expect(chunk.get().data).toBe(null);

    canFetch = true;
    chunk.reload();
    await delay(100);
    expect(chunk.get().data).toHaveLength(10);
  });
});

describe('infiniteAsyncChunk — keepPreviousData', () => {
  it('should keep previous data visible while loading next page', async () => {
    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize, 30), 100),
      { pageSize: 10, keepPreviousData: true }
    );

    chunk.reload();
    await delay(150);

    expect(chunk.get().data).toHaveLength(10);

    chunk.nextPage(); // don't await — check state mid-flight
    const duringLoad = chunk.get();
    expect(duringLoad.loading).toBe(true);
    expect(duringLoad.isPlaceholderData).toBe(true);
    expect(duringLoad.data).toHaveLength(10); // previous data still visible

    await delay(150);
    expect(chunk.get().isPlaceholderData).toBe(false);
    expect(chunk.get().data).toHaveLength(20);
  });
});

describe('infiniteAsyncChunk — deduplication', () => {
  it('should deduplicate concurrent reload calls on a keyed chunk', async () => {
    let fetchCount = 0;

    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) => {
        fetchCount++;
        return createDelayedResponse(createPostPage(page, pageSize), 100);
      },
      { key: 'infinite-dedup-test' }
    );

    chunk.reload();
    chunk.reload();
    chunk.reload();

    await delay(250);

    expect(fetchCount).toBe(1);
    expect(chunk.get().data).toHaveLength(10);
  });

  it('should allow a new request after the in-flight one completes', async () => {
    let fetchCount = 0;

    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) => {
        fetchCount++;
        return createDelayedResponse(createPostPage(page, pageSize), 50);
      },
      { key: 'infinite-sequential-test' }
    );

    chunk.reload();
    await delay(100);
    expect(fetchCount).toBe(1);

    chunk.reload();
    await delay(100);
    expect(fetchCount).toBe(2);
  });
});

describe('infiniteAsyncChunk — side effects', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('should auto-refetch on interval', async () => {
    let fetchCount = 0;

    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) => {
        fetchCount++;
        return createPostPage(page, pageSize);
      },
      { refetchInterval: 1000 }
    );

    // infiniteAsyncChunk doesn't auto-fetch — trigger manually
    chunk.reload();
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchCount).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchCount).toBe(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchCount).toBe(3);

    chunk.forceCleanup();
  });

  it('should stop auto-refetch after forceCleanup', async () => {
    let fetchCount = 0;

    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) => {
        fetchCount++;
        return createPostPage(page, pageSize);
      },
      { refetchInterval: 1000 }
    );

    chunk.reload();
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchCount).toBe(1);

    chunk.forceCleanup();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchCount).toBe(1); // no more fetches
  });
});

describe('infiniteAsyncChunk — initialData', () => {
  it('should seed the chunk with initial data before first fetch', () => {
    const seedData: Post[] = [{ id: 0, title: 'Cached Post' }];

    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize), 50),
      { initialData: seedData }
    );

    expect(chunk.get().data).toEqual(seedData);
    expect(chunk.get().loading).toBe(false);
  });
});

describe('infiniteAsyncChunk — cleanup', () => {
  it('should not tear down when subscribers are still active', async () => {
    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize), 50),
      { pageSize: 10 }
    );

    const unsub1 = chunk.subscribe(() => { });
    const unsub2 = chunk.subscribe(() => { });

    chunk.reload();
    await delay(100);

    unsub1();
    chunk.cleanup(); // unsub2 still active — should not teardown

    expect(chunk.get().data).toHaveLength(10);

    unsub2();
    chunk.cleanup(); // now safe
  });

  it('should force teardown via forceCleanup regardless of subscribers', async () => {
    const chunk = infiniteAsyncChunk<Post>(
      async ({ page, pageSize }) =>
        createDelayedResponse(createPostPage(page, pageSize), 50),
      { pageSize: 10 }
    );

    chunk.subscribe(() => { });
    chunk.subscribe(() => { });

    chunk.reload();
    await delay(100);

    chunk.forceCleanup(); // should not throw
    expect(chunk.get().data).toHaveLength(10);
  });
});
