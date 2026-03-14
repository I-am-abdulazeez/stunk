import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { asyncChunk, type PaginatedAsyncChunk } from "../../src/query/async-chunk";

interface User {
  id: number;
  name: string;
}

interface Post {
  id: number;
  title: string;
}


const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createDelayedResponse = <T>(data: T, ms = 50): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(data), ms));


describe('asyncChunk — core', () => {
  it('should reflect loading state on initial fetch', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(() => createDelayedResponse(mockUser));

    expect(userChunk.get()).toEqual({
      loading: true,
      error: null,
      data: null,
      lastFetched: undefined,
      isPlaceholderData: false,
      pagination: undefined,
    });

    await delay(100);

    const state = userChunk.get();
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
    expect(state.data).toEqual(mockUser);
    expect(typeof state.lastFetched).toBe('number');
    expect(state.isPlaceholderData).toBe(false);
  });

  it('should handle errors and expose them on state', async () => {
    const userChunk = asyncChunk<User>(() => { throw new Error('Failed to fetch'); });

    await delay(100);

    const state = userChunk.get();
    expect(state.loading).toBe(false);
    expect(state.error?.message).toBe('Failed to fetch');
    expect(state.data).toBe(null);
    expect(state.lastFetched).toBeUndefined();
  });

  it('should retry the specified number of times before failing', async () => {
    let attempts = 0;
    const mockUser: User = { id: 1, name: 'Test User' };

    const userChunk = asyncChunk<User>(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('Temporary error');
        return mockUser;
      },
      { retryCount: 2, retryDelay: 50 }
    );

    await delay(400);

    expect(attempts).toBe(3);
    expect(userChunk.get().data).toEqual(mockUser);
    expect(userChunk.get().error).toBe(null);
  });

  it('should call onError when all retries are exhausted', async () => {
    const errors: Error[] = [];

    const userChunk = asyncChunk<User>(
      async () => { throw new Error('Test error'); },
      { onError: (e) => errors.push(e) }
    );

    await delay(100);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Test error');
  });

  it('should call onSuccess after every successful fetch', async () => {
    const successData: User[] = [];
    const mockUser: User = { id: 1, name: 'Test User' };

    const userChunk = asyncChunk<User>(
      async () => mockUser,
      { onSuccess: (data) => successData.push(data) }
    );

    await delay(100);

    expect(successData).toHaveLength(1);
    expect(successData[0]).toEqual(mockUser);

    await userChunk.reload();
    await delay(100);

    expect(successData).toHaveLength(2);
  });

  it('should support initial data without triggering a fetch', () => {
    const initialUser: User = { id: 0, name: 'Initial User' };
    const userChunk = asyncChunk<User>(
      async () => ({ id: 1, name: 'Fetched User' }),
      { initialData: initialUser }
    );

    expect(userChunk.get().data).toEqual(initialUser);
  });

  it('should not fetch when disabled', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(
      async () => mockUser,
      { enabled: false }
    );

    expect(userChunk.get()).toEqual({
      loading: false,
      error: null,
      data: null,
      lastFetched: undefined,
      isPlaceholderData: false,
      pagination: undefined,
    });

    await delay(100);
    expect(userChunk.get().data).toBe(null);
  });

  it('should support enabled as a function for dynamic disabling', async () => {
    let shouldFetch = false;
    const mockUser: User = { id: 1, name: 'Test User' };

    const userChunk = asyncChunk<User>(
      async () => mockUser,
      { enabled: () => shouldFetch }
    );

    await delay(100);
    expect(userChunk.get().data).toBe(null);

    shouldFetch = true;
    await userChunk.reload();
    await delay(100);

    expect(userChunk.get().data).toEqual(mockUser);
  });

  it('should support optimistic updates via mutate', () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(
      async () => mockUser,
      { initialData: mockUser }
    );

    userChunk.mutate(current => ({ ...current!, name: 'Updated Name' }));

    expect(userChunk.get().data?.name).toBe('Updated Name');
  });

  it('should apply concurrent mutations in order', () => {
    const mockUser: User = { id: 1, name: 'Initial' };
    const userChunk = asyncChunk<User>(
      async () => mockUser,
      { initialData: mockUser }
    );

    userChunk.mutate(curr => ({ ...curr!, name: 'First' }));
    userChunk.mutate(curr => ({ ...curr!, name: 'Second' }));
    userChunk.mutate(curr => ({ ...curr!, name: 'Third' }));

    expect(userChunk.get().data?.name).toBe('Third');
  });

  it('should force a new fetch on reload', async () => {
    let counter = 0;
    const userChunk = asyncChunk<User>(async () => {
      counter++;
      return { id: counter, name: `User ${counter}` };
    });

    await delay(100);
    expect(userChunk.get().data?.id).toBe(1);

    await userChunk.reload();
    await delay(100);
    expect(userChunk.get().data?.id).toBe(2);
  });

  it('should not refetch on refresh when data is still fresh (staleTime)', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(
      async () => { callCount++; return { id: callCount, name: `User ${callCount}` }; },
      { refresh: { staleTime: 1000 } }
    );

    await delay(100);
    expect(callCount).toBe(1);

    await userChunk.refresh();
    expect(callCount).toBe(1); // still fresh, no refetch

    await userChunk.reload(); // force ignores staleTime
    await delay(100);
    expect(callCount).toBe(2);
  });

  it('should refetch on refresh when data is stale', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(
      async () => { callCount++; return { id: callCount, name: `User ${callCount}` }; },
      { refresh: { staleTime: 50 } }
    );

    await delay(100);
    expect(callCount).toBe(1);

    await delay(60); // let data go stale

    await userChunk.refresh();
    await delay(100);
    expect(callCount).toBe(2);
  });

  it('should reset state and re-fetch', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(async () => {
      callCount++;
      return { id: callCount, name: `User ${callCount}` };
    });

    await delay(100);
    expect(userChunk.get().data).toEqual({ id: 1, name: 'User 1' });

    userChunk.mutate(() => ({ id: 999, name: 'Mutated' }));
    expect(userChunk.get().data?.id).toBe(999);

    userChunk.reset();
    expect(userChunk.get().loading).toBe(true);
    expect(userChunk.get().data).toBe(null);

    await delay(100);
    expect(userChunk.get().data).toEqual({ id: 2, name: 'User 2' });
  });

  it('should notify all subscribers on state change', async () => {
    const userChunk = asyncChunk<User>(
      () => createDelayedResponse({ id: 1, name: 'Test User' }, 50)
    );

    const states1: any[] = [];
    const states2: any[] = [];

    userChunk.subscribe(s => states1.push({ ...s }));
    userChunk.subscribe(s => states2.push({ ...s }));

    await delay(100);

    expect(states1.length).toBe(states2.length);
    expect(states1.at(-1)).toEqual(states2.at(-1));
  });
});


describe('asyncChunk — params', () => {
  it('should not auto-fetch when fetcher expects params', () => {
    const userChunk = asyncChunk(async (params: { id: number }) =>
      ({ id: params.id, name: `User ${params.id}` })
    );

    expect(userChunk.get().loading).toBe(false);
    expect(userChunk.get().data).toBe(null);
  });

  it('should fetch when setParams is called', async () => {
    const userChunk = asyncChunk(async (params: { id: number }) =>
      createDelayedResponse({ id: params.id, name: `User ${params.id}` }, 50)
    );

    userChunk.setParams({ id: 1 });
    await delay(100);
    expect(userChunk.get().data).toEqual({ id: 1, name: 'User 1' });

    userChunk.setParams({ id: 2 });
    await delay(100);
    expect(userChunk.get().data).toEqual({ id: 2, name: 'User 2' });
  });

  it('should merge params on subsequent setParams calls', async () => {
    interface SearchParams { query: string; category?: string; limit?: number; }
    let lastParams: SearchParams | undefined;

    const searchChunk = asyncChunk(async (params: SearchParams) => {
      lastParams = { ...params };
      return createDelayedResponse({ results: [] }, 50);
    });

    searchChunk.setParams({ query: 'test', limit: 10 });
    await delay(100);
    expect(lastParams).toEqual({ query: 'test', limit: 10 });

    searchChunk.setParams({ category: 'books' });
    await delay(100);
    expect(lastParams).toEqual({ query: 'test', limit: 10, category: 'books' });
  });

  it('should clear a specific param when null is passed to setParams', async () => {
    interface SearchParams { query: string; category?: string | null; }
    let lastParams: SearchParams | undefined;

    const searchChunk = asyncChunk(async (params: SearchParams) => {
      lastParams = { ...params };
      return createDelayedResponse({ results: [] }, 50);
    });

    searchChunk.setParams({ query: 'test', category: 'books' });
    await delay(100);
    expect(lastParams?.category).toBe('books');

    searchChunk.setParams({ category: null });
    await delay(100);
    expect(lastParams).toEqual({ query: 'test' });
    expect('category' in lastParams!).toBe(false);
  });

  it('should clear all params on clearParams', async () => {
    interface SearchParams { query: string; limit: number; }
    let lastParams: SearchParams | undefined;

    const searchChunk = asyncChunk(async (params: SearchParams) => {
      lastParams = { ...params };
      return createDelayedResponse({ results: [] }, 50);
    });

    searchChunk.setParams({ query: 'test', limit: 10 });
    await delay(100);
    expect(lastParams).toEqual({ query: 'test', limit: 10 });

    searchChunk.clearParams();
    await delay(100);
    expect(lastParams).toEqual({});
  });

  it('should override params on reload', async () => {
    let lastId: number | undefined;

    const userChunk = asyncChunk(async (params: { id: number }) => {
      lastId = params.id;
      return createDelayedResponse({ id: params.id, name: `User ${params.id}` }, 50);
    });

    userChunk.setParams({ id: 1 });
    await delay(100);
    expect(lastId).toBe(1);

    await userChunk.reload({ id: 5 });
    await delay(100);
    expect(lastId).toBe(5);
    expect(userChunk.get().data?.id).toBe(5);
  });
});


describe('asyncChunk — keepPreviousData', () => {
  it('should keep previous data visible while loading when keepPreviousData is true', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(
      async () => {
        callCount++;
        return createDelayedResponse({ id: callCount, name: `User ${callCount}` }, 50);
      },
      { keepPreviousData: true }
    );

    await delay(100);
    expect(userChunk.get().data).toEqual({ id: 1, name: 'User 1' });

    // Trigger a reload — previous data should remain visible during loading
    userChunk.reload();
    const duringLoad = userChunk.get();
    expect(duringLoad.loading).toBe(true);
    expect(duringLoad.data).toEqual({ id: 1, name: 'User 1' }); // still showing
    expect(duringLoad.isPlaceholderData).toBe(true);

    await delay(100);
    const afterLoad = userChunk.get();
    expect(afterLoad.data).toEqual({ id: 2, name: 'User 2' });
    expect(afterLoad.isPlaceholderData).toBe(false);
  });

  it('should clear isPlaceholderData on error', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(
      async () => {
        callCount++;
        if (callCount === 1) return { id: 1, name: 'User 1' };
        throw new Error('Fetch failed');
      },
      { keepPreviousData: true }
    );

    await delay(100);
    expect(userChunk.get().data).toEqual({ id: 1, name: 'User 1' });

    await userChunk.reload();
    await delay(100);

    const state = userChunk.get();
    expect(state.isPlaceholderData).toBe(false);
    expect(state.error?.message).toBe('Fetch failed');
  });

  it('should set isPlaceholderData to false when no previous data exists', async () => {
    const userChunk = asyncChunk<User>(
      () => createDelayedResponse({ id: 1, name: 'User 1' }, 50),
      { keepPreviousData: true }
    );

    // On first load there's no previous data — isPlaceholderData should be false
    expect(userChunk.get().isPlaceholderData).toBe(false);
    await delay(100);
    expect(userChunk.get().isPlaceholderData).toBe(false);
  });
});


describe('asyncChunk — request deduplication', () => {
  it('should deduplicate concurrent requests for the same named chunk', async () => {
    let fetchCount = 0;

    const userChunk = asyncChunk<User>(
      async () => {
        fetchCount++;
        return createDelayedResponse({ id: 1, name: 'Test User' }, 100);
      },
      { key: 'user-dedup-test' }
    );

    // Fire multiple reloads simultaneously
    userChunk.reload();
    userChunk.reload();
    userChunk.reload();

    await delay(250);

    // Only one actual fetch should have fired
    expect(fetchCount).toBe(1);
    expect(userChunk.get().data).toEqual({ id: 1, name: 'Test User' });
  });

  it('should allow a new request after the in-flight one completes', async () => {
    let fetchCount = 0;

    const userChunk = asyncChunk<User>(
      async () => {
        fetchCount++;
        return createDelayedResponse({ id: fetchCount, name: `User ${fetchCount}` }, 50);
      },
      { key: 'user-sequential-test' }
    );

    await delay(100); // first fetch completes
    expect(fetchCount).toBe(1);

    await userChunk.reload(); // second fetch — no in-flight, should proceed
    await delay(100);
    expect(fetchCount).toBe(2);
  });
});


describe('asyncChunk — side effects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should auto-refetch on interval', async () => {
    let fetchCount = 0;

    const userChunk = asyncChunk<User>(
      async () => {
        fetchCount++;
        return { id: fetchCount, name: `User ${fetchCount}` };
      },
      { refresh: { refetchInterval: 1000 } }
    );

    // Initial fetch
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchCount).toBe(1);

    // Advance by interval
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchCount).toBe(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchCount).toBe(3);

    userChunk.forceCleanup();
  });

  it('should stop auto-refetch after cleanup', async () => {
    let fetchCount = 0;

    const userChunk = asyncChunk<User>(
      async () => {
        fetchCount++;
        return { id: fetchCount, name: `User ${fetchCount}` };
      },
      { refresh: { refetchInterval: 1000 } }
    );

    await vi.advanceTimersByTimeAsync(100);
    expect(fetchCount).toBe(1);

    userChunk.forceCleanup();

    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchCount).toBe(1); // no more fetches
  });

  it('should refetch on window focus when refetchOnWindowFocus is true', async () => {
    let fetchCount = 0;

    const userChunk = asyncChunk<User>(
      async () => {
        fetchCount++;
        return { id: fetchCount, name: `User ${fetchCount}` };
      },
      { refresh: { refetchOnWindowFocus: true, staleTime: 0 } }
    );

    await vi.runAllTimersAsync();
    expect(fetchCount).toBe(1);

    // Simulate window focus
    window.dispatchEvent(new Event('focus'));
    await vi.runAllTimersAsync();
    expect(fetchCount).toBe(2);

    userChunk.forceCleanup();
  });

  it('should not refetch on window focus when data is still fresh', async () => {
    let fetchCount = 0;

    const userChunk = asyncChunk<User>(
      async () => {
        fetchCount++;
        return { id: fetchCount, name: `User ${fetchCount}` };
      },
      { refresh: { refetchOnWindowFocus: true, staleTime: 60_000 } }
    );

    await vi.advanceTimersByTimeAsync(100);
    expect(fetchCount).toBe(1);

    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchCount).toBe(1); // still fresh, no refetch

    userChunk.forceCleanup();
  });
});


describe('asyncChunk — cleanup', () => {
  it('should not tear down side effects when subscribers are still active', async () => {
    let fetchCount = 0;

    const userChunk = asyncChunk<User>(
      async () => {
        fetchCount++;
        return { id: fetchCount, name: `User ${fetchCount}` };
      },
    );

    const unsub1 = userChunk.subscribe(() => { });
    const unsub2 = userChunk.subscribe(() => { });

    await delay(100);

    // One component unmounts — calls cleanup
    unsub1();
    userChunk.cleanup(); // should NOT teardown, unsub2 is still active

    expect(userChunk.get().data).toEqual({ id: 1, name: 'User 1' });

    unsub2();
    userChunk.cleanup(); // now safe to teardown
  });

  it('should force teardown via forceCleanup regardless of subscribers', async () => {
    const userChunk = asyncChunk<User>(async () => ({ id: 1, name: 'Test User' }));

    userChunk.subscribe(() => { });
    userChunk.subscribe(() => { });

    await delay(100);

    userChunk.forceCleanup(); // should teardown even with active subscribers
    expect(userChunk.get().data).toEqual({ id: 1, name: 'Test User' });
  });

  it('should decrement subscriber count correctly on unsubscribe', async () => {
    const userChunk = asyncChunk<User>(async () => ({ id: 1, name: 'Test User' }));

    const unsub1 = userChunk.subscribe(() => { });
    const unsub2 = userChunk.subscribe(() => { });

    unsub1();
    unsub2();

    // Both unsubscribed — cleanup should now teardown
    userChunk.cleanup(); // should not throw, should succeed silently
  });
});


describe('asyncChunk — FetcherResponse format', () => {
  it('should unwrap data from FetcherResponse shape', async () => {
    const userChunk = asyncChunk(async () =>
      createDelayedResponse({
        data: { id: 1, name: 'Test User' },
        total: 100,
        hasMore: true
      }, 50)
    );

    await delay(100);
    expect(userChunk.get().data).toEqual({ id: 1, name: 'Test User' });
  });
});


describe('asyncChunk — pagination', () => {
  it('should handle basic pagination in replace mode', async () => {
    const fetchUsers = async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const start = (page - 1) * pageSize;
      return createDelayedResponse({
        data: Array.from({ length: pageSize }, (_, i) => ({
          id: start + i + 1,
          name: `User ${start + i + 1}`
        })),
        total: 50,
        hasMore: page * pageSize < 50
      }, 50);
    };

    const usersChunk = asyncChunk(fetchUsers, {
      pagination: { pageSize: 10, mode: 'replace' }
    }) as PaginatedAsyncChunk<User[], Error> & { reload: () => Promise<void> };

    usersChunk.reload();
    await delay(100);

    let state = usersChunk.get();
    expect(state.data).toHaveLength(10);
    expect(state.data?.[0].id).toBe(1);
    expect(state.pagination?.page).toBe(1);
    expect(state.pagination?.hasMore).toBe(true);

    await usersChunk.nextPage();
    await delay(100);

    state = usersChunk.get();
    expect(state.data).toHaveLength(10);
    expect(state.data?.[0].id).toBe(11);
    expect(state.pagination?.page).toBe(2);
  });

  it('should accumulate pages in accumulate mode', async () => {
    const fetchPosts = async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const start = (page - 1) * pageSize;
      return createDelayedResponse({
        data: Array.from({ length: pageSize }, (_, i) => ({
          id: start + i + 1,
          title: `Post ${start + i + 1}`
        })),
        hasMore: page < 3
      }, 50);
    };

    const postsChunk = asyncChunk(fetchPosts, {
      pagination: { pageSize: 5, mode: 'accumulate' }
    }) as PaginatedAsyncChunk<Post[], Error> & { reload: () => Promise<void> };

    postsChunk.reload();
    await delay(100);

    expect(postsChunk.get().data).toHaveLength(5);

    await postsChunk.nextPage();
    await delay(100);

    const state = postsChunk.get();
    expect(state.data).toHaveLength(10);
    expect(state.data?.[0].id).toBe(1);
    expect(state.data?.[9].id).toBe(10);
    expect(state.pagination?.page).toBe(2);
  });

  it('should jump to a specific page with goToPage', async () => {
    const fetchData = async ({ page }: { page: number }) =>
      createDelayedResponse({ data: [{ page, value: `Page ${page}` }], hasMore: page < 5 }, 50);

    const dataChunk = asyncChunk(fetchData, {
      pagination: { pageSize: 1, mode: 'replace' }
    }) as PaginatedAsyncChunk<any[], Error> & { reload: () => Promise<void> };

    dataChunk.reload();
    await delay(100);

    await dataChunk.goToPage(3);
    await delay(100);

    expect(dataChunk.get().pagination?.page).toBe(3);
    expect(dataChunk.get().data?.[0].page).toBe(3);
  });

  it('should go to previous page with prevPage', async () => {
    const fetchData = async ({ page }: { page: number }) =>
      createDelayedResponse({ data: [{ page }] }, 50);

    const dataChunk = asyncChunk(fetchData, {
      pagination: { initialPage: 3, pageSize: 1 }
    }) as PaginatedAsyncChunk<any[], Error> & { reload: () => Promise<void> };

    dataChunk.reload();
    await delay(100);

    expect(dataChunk.get().pagination?.page).toBe(3);

    await dataChunk.prevPage();
    await delay(100);

    expect(dataChunk.get().pagination?.page).toBe(2);
  });

  it('should not go below page 1', async () => {
    const fetchData = async ({ page }: { page: number }) =>
      createDelayedResponse({ data: [{ page }] }, 50);

    const dataChunk = asyncChunk(fetchData, {
      pagination: { pageSize: 1 }
    }) as PaginatedAsyncChunk<any[], Error> & { reload: () => Promise<void> };

    dataChunk.reload();
    await delay(100);

    await dataChunk.prevPage();
    await delay(100);

    expect(dataChunk.get().pagination?.page).toBe(1);
  });

  it('should reset pagination to first page and re-fetch', async () => {
    const fetchData = async ({ page }: { page: number }) =>
      createDelayedResponse({ data: [{ page }] }, 50);

    const dataChunk = asyncChunk(fetchData, {
      pagination: { pageSize: 1, mode: 'accumulate' }
    }) as PaginatedAsyncChunk<any[], Error> & { reload: () => Promise<void> };

    dataChunk.reload();
    await delay(100);

    await dataChunk.nextPage();
    await delay(100);
    await dataChunk.nextPage();
    await delay(100);

    expect(dataChunk.get().pagination?.page).toBe(3);
    expect(dataChunk.get().data).toHaveLength(3);

    await dataChunk.resetPagination();
    await delay(100);

    expect(dataChunk.get().pagination?.page).toBe(1);
    expect(dataChunk.get().data).toHaveLength(1);
  });

  it('should not advance past the last page when hasMore is false', async () => {
    let fetchCount = 0;
    const fetchData = async ({ page }: { page: number }) => {
      fetchCount++;
      return createDelayedResponse({ data: [{ page }], hasMore: false }, 50);
    };

    const dataChunk = asyncChunk(fetchData, {
      pagination: { pageSize: 1 }
    }) as PaginatedAsyncChunk<any[], Error> & { reload: () => Promise<void> };

    dataChunk.reload();
    await delay(100);
    const countAfterLoad = fetchCount;

    await dataChunk.nextPage(); // should be blocked — hasMore is false
    await delay(100);

    expect(dataChunk.get().pagination?.page).toBe(1);
    expect(fetchCount).toBe(countAfterLoad); // no extra fetch
  });
});
