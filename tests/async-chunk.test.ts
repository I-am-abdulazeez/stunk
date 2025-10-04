import { describe, expect, it } from "vitest"
import { asyncChunk, PaginatedAsyncChunk } from '../src/core/asyncChunk';
import { combineAsyncChunks } from '../src/utils';

// Mock types for testing
interface User {
  id: number;
  name: string;
}

interface Post {
  id: number;
  title: string;
}

// Helper to create a delayed response
const createDelayedResponse = <T>(data: T, delay = 50): Promise<T> => {
  return new Promise((resolve) => setTimeout(() => resolve(data), delay));
};

describe('asyncChunk', () => {
  it('should handle successful async operations', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(async () => {
      return createDelayedResponse(mockUser);
    });

    expect(userChunk.get()).toEqual({
      loading: true,
      error: null,
      data: null,
      lastFetched: undefined
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const finalState = userChunk.get();
    expect(finalState.loading).toBe(false);
    expect(finalState.error).toBe(null);
    expect(finalState.data).toEqual(mockUser);
    expect(typeof finalState.lastFetched).toBe('number');
  });

  it('should handle errors', async () => {
    const errorMessage = 'Failed to fetch';
    const userChunk = asyncChunk<User>(async () => {
      throw new Error(errorMessage);
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const state = userChunk.get();
    expect(state.loading).toBe(false);
    expect(state.error?.message).toBe(errorMessage);
    expect(state.data).toBe(null);
    expect(state.lastFetched).toBe(undefined);
  });

  it('should handle retries', async () => {
    let attempts = 0;
    const mockUser: User = { id: 1, name: 'Test User' };

    const userChunk = asyncChunk<User>(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary error');
        }
        return mockUser;
      },
      { retryCount: 2, retryDelay: 50 }
    );

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(attempts).toBe(3);
    expect(userChunk.get().data).toEqual(mockUser);
  });

  it('should support optimistic updates via mutate', () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(
      async () => mockUser,
      { initialData: mockUser }
    );

    userChunk.mutate(current => ({
      ...current!,
      name: 'Updated Name'
    }));

    const state = userChunk.get();
    expect(state.data?.name).toBe('Updated Name');
  });

  it('should reload data when requested', async () => {
    let counter = 0;
    const userChunk = asyncChunk<User>(async () => {
      counter++;
      return { id: counter, name: `User ${counter}` };
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(userChunk.get().data?.id).toBe(1);

    await userChunk.reload();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(userChunk.get().data?.id).toBe(2);
  });

  it('should handle disabled state', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(
      async () => mockUser,
      { enabled: false }
    );

    expect(userChunk.get()).toEqual({
      loading: false,
      error: null,
      data: null,
      lastFetched: undefined
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(userChunk.get().data).toBe(null);
  });

  it('should handle initial data', () => {
    const initialUser: User = { id: 0, name: 'Initial User' };
    const userChunk = asyncChunk<User>(
      async () => ({ id: 1, name: 'Test User' }),
      { initialData: initialUser }
    );

    expect(userChunk.get().data).toEqual(initialUser);
  });

  it('should handle functions with parameters', async () => {
    interface FetchParams {
      id: number;
    }

    const fetchUserById = async (params: FetchParams): Promise<User> => {
      return createDelayedResponse({ id: params.id, name: `User ${params.id}` }, 50);
    };

    const userChunk = asyncChunk(fetchUserById);

    expect(userChunk.get().loading).toBe(false);

    userChunk.setParams({ id: 1 });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(userChunk.get().data).toEqual({ id: 1, name: 'User 1' });

    userChunk.setParams({ id: 2 });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(userChunk.get().data).toEqual({ id: 2, name: 'User 2' });
  });

  it('should handle setParams for parameterized functions', async () => {
    interface FetchParams {
      id: number;
    }

    const fetchUserById = async (params: FetchParams): Promise<User> => {
      return createDelayedResponse({ id: params.id, name: `User ${params.id}` }, 50);
    };

    const userChunk = asyncChunk(fetchUserById);

    userChunk.setParams({ id: 5 });
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(userChunk.get().data).toEqual({ id: 5, name: 'User 5' });
  });

  it('should handle refresh vs reload difference', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(
      async () => {
        callCount++;
        return { id: callCount, name: `User ${callCount}` };
      },
      {
        refresh: { staleTime: 1000 }
      }
    );

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(callCount).toBe(1);

    await userChunk.refresh();
    expect(callCount).toBe(1);

    await userChunk.reload();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(callCount).toBe(2);
  });

  it('should handle stale time correctly', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(
      async () => {
        callCount++;
        return { id: callCount, name: `User ${callCount}` };
      },
      {
        refresh: { staleTime: 50 }
      }
    );

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(callCount).toBe(1);

    await new Promise(resolve => setTimeout(resolve, 60));

    await userChunk.refresh();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(callCount).toBe(2);
  });

  it('should handle reset functionality', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(async () => {
      callCount++;
      return { id: callCount, name: `User ${callCount}` };
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(userChunk.get().data).toEqual({ id: 1, name: 'User 1' });

    userChunk.mutate(() => ({ id: 999, name: 'Mutated User' }));
    expect(userChunk.get().data).toEqual({ id: 999, name: 'Mutated User' });

    userChunk.reset();
    expect(userChunk.get().data).toBe(null);
    expect(userChunk.get().loading).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(userChunk.get().data).toEqual({ id: 2, name: 'User 2' });
  });

  it('should handle onError callback', async () => {
    const errors: Error[] = [];
    const userChunk = asyncChunk<User>(
      async () => {
        throw new Error('Test error');
      },
      {
        onError: (error) => errors.push(error)
      }
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Test error');
  });

  it('should handle multiple subscribers', async () => {
    const userChunk = asyncChunk<User>(async () => {
      return createDelayedResponse({ id: 1, name: 'Test User' }, 50);
    });

    const states1: any[] = [];
    const states2: any[] = [];

    userChunk.subscribe(state => states1.push({ ...state }));
    userChunk.subscribe(state => states2.push({ ...state }));

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(states1).toHaveLength(states2.length);
    expect(states1[states1.length - 1]).toEqual(states2[states2.length - 1]);
  });

  it('should handle concurrent mutations', () => {
    const userChunk = asyncChunk<User>(
      async () => ({ id: 1, name: 'Test User' }),
      { initialData: { id: 1, name: 'Initial' } }
    );

    userChunk.mutate(current => ({ ...current!, name: 'First' }));
    userChunk.mutate(current => ({ ...current!, name: 'Second' }));
    userChunk.mutate(current => ({ ...current!, name: 'Third' }));

    expect(userChunk.get().data?.name).toBe('Third');
  });

  it('should handle cleanup properly', async () => {
    const userChunk = asyncChunk<User>(
      async () => ({ id: 1, name: 'Test User' }),
      {
        refresh: { refetchInterval: 50 }
      }
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    userChunk.cleanup();

    expect(userChunk.get().data).toEqual({ id: 1, name: 'Test User' });
  });

  it('should handle params merging with setParams', async () => {
    interface SearchParams {
      query: string;
      category?: string;
      limit?: number;
    }

    let lastParams: SearchParams | undefined;

    const searchChunk = asyncChunk(async (params: SearchParams) => {
      lastParams = params;
      return createDelayedResponse({ results: [], params }, 50);
    });

    searchChunk.setParams({ query: 'test', limit: 10 });
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(lastParams).toEqual({ query: 'test', limit: 10 });

    searchChunk.setParams({ category: 'books' });
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(lastParams).toEqual({ query: 'test', limit: 10, category: 'books' });
  });

  it('should handle reload with params override', async () => {
    interface FetchParams {
      id: number;
    }

    let lastId: number | undefined;

    const userChunk = asyncChunk(async (params: FetchParams) => {
      lastId = params.id;
      return createDelayedResponse({ id: params.id, name: `User ${params.id}` }, 50);
    });

    userChunk.setParams({ id: 1 });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(lastId).toBe(1);

    await userChunk.reload({ id: 5 });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(lastId).toBe(5);
    expect(userChunk.get().data?.id).toBe(5);
  });

  it('should handle FetcherResponse format', async () => {
    const userChunk = asyncChunk(async () => {
      return createDelayedResponse({
        data: { id: 1, name: 'Test User' },
        total: 100,
        hasMore: true
      }, 50);
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const state = userChunk.get();
    expect(state.data).toEqual({ id: 1, name: 'Test User' });
  });
});

describe('asyncChunk with pagination', () => {
  it('should handle basic pagination (replace mode)', async () => {
    const fetchUsers = async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const start = (page - 1) * pageSize;
      const users = Array.from({ length: pageSize }, (_, i) => ({
        id: start + i + 1,
        name: `User ${start + i + 1}`
      }));

      return createDelayedResponse({
        data: users,
        total: 50,
        hasMore: page * pageSize < 50
      }, 50);
    };

    const usersChunk = asyncChunk(fetchUsers, {
      pagination: { pageSize: 10, mode: 'replace' }
    }) as PaginatedAsyncChunk<User[], Error> & {
      setParams: (params: any) => void;
      reload: (params?: any) => Promise<void>;
      refresh: (params?: any) => Promise<void>;
    };

    usersChunk.reload();
    await new Promise(resolve => setTimeout(resolve, 100));

    let state = usersChunk.get();
    expect(state.data).toHaveLength(10);
    expect(state.data?.[0].id).toBe(1);
    expect(state.pagination?.page).toBe(1);
    expect(state.pagination?.hasMore).toBe(true);

    await usersChunk.nextPage();
    await new Promise(resolve => setTimeout(resolve, 100));

    state = usersChunk.get();
    expect(state.data).toHaveLength(10);
    expect(state.data?.[0].id).toBe(11);
    expect(state.pagination?.page).toBe(2);
  });

  it('should handle pagination (accumulate mode)', async () => {
    const fetchPosts = async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const start = (page - 1) * pageSize;
      const posts = Array.from({ length: pageSize }, (_, i) => ({
        id: start + i + 1,
        title: `Post ${start + i + 1}`
      }));

      return createDelayedResponse({
        data: posts,
        hasMore: page < 3
      }, 50);
    };

    const postsChunk = asyncChunk(fetchPosts, {
      pagination: { pageSize: 5, mode: 'accumulate' }
    }) as PaginatedAsyncChunk<Post[], Error> & {
      setParams: (params: any) => void;
      reload: (params?: any) => Promise<void>;
    };

    postsChunk.reload();
    await new Promise(resolve => setTimeout(resolve, 100));

    let state = postsChunk.get();
    expect(state.data).toHaveLength(5);
    expect(state.pagination?.page).toBe(1);

    await postsChunk.nextPage();
    await new Promise(resolve => setTimeout(resolve, 100));

    state = postsChunk.get();
    expect(state.data).toHaveLength(10);
    expect(state.data?.[0].id).toBe(1);
    expect(state.data?.[9].id).toBe(10);
    expect(state.pagination?.page).toBe(2);
  });

  it('should handle goToPage', async () => {
    const fetchData = async ({ page }: { page: number }) => {
      return createDelayedResponse({
        data: [{ page, value: `Page ${page}` }],
        hasMore: page < 5
      }, 50);
    };

    const dataChunk = asyncChunk(fetchData, {
      pagination: { pageSize: 1, mode: 'replace' }
    }) as PaginatedAsyncChunk<any[], Error> & { reload: () => Promise<void> };

    dataChunk.reload();
    await new Promise(resolve => setTimeout(resolve, 100));

    await dataChunk.goToPage(3);
    await new Promise(resolve => setTimeout(resolve, 100));

    const state = dataChunk.get();
    expect(state.pagination?.page).toBe(3);
    expect(state.data?.[0].page).toBe(3);
  });

  it('should handle prevPage', async () => {
    const fetchData = async ({ page }: { page: number }) => {
      return createDelayedResponse({
        data: [{ page }]
      }, 50);
    };

    const dataChunk = asyncChunk(fetchData, {
      pagination: { initialPage: 3, pageSize: 1 }
    }) as PaginatedAsyncChunk<any[], Error> & { reload: () => Promise<void> };

    dataChunk.reload();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(dataChunk.get().pagination?.page).toBe(3);

    await dataChunk.prevPage();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(dataChunk.get().pagination?.page).toBe(2);
  });

  it('should not go below page 1', async () => {
    const fetchData = async ({ page }: { page: number }) => {
      return createDelayedResponse({ data: [{ page }] }, 50);
    };

    const dataChunk = asyncChunk(fetchData, {
      pagination: { pageSize: 1 }
    }) as PaginatedAsyncChunk<any[], Error> & { reload: () => Promise<void> };

    dataChunk.reload();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(dataChunk.get().pagination?.page).toBe(1);

    await dataChunk.prevPage();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(dataChunk.get().pagination?.page).toBe(1);
  });

  it('should handle resetPagination', async () => {
    const fetchData = async ({ page }: { page: number }) => {
      return createDelayedResponse({
        data: [{ page }]
      }, 50);
    };

    const dataChunk = asyncChunk(fetchData, {
      pagination: { pageSize: 1, mode: 'accumulate' }
    }) as PaginatedAsyncChunk<any[], Error> & { reload: () => Promise<void> };

    dataChunk.reload();
    await new Promise(resolve => setTimeout(resolve, 100));

    await dataChunk.nextPage();
    await new Promise(resolve => setTimeout(resolve, 100));

    await dataChunk.nextPage();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(dataChunk.get().pagination?.page).toBe(3);
    expect(dataChunk.get().data).toHaveLength(3);

    await dataChunk.resetPagination();
    await new Promise(resolve => setTimeout(resolve, 100));

    const state = dataChunk.get();
    expect(state.pagination?.page).toBe(1);
    expect(state.data).toHaveLength(1);
  });
});

describe('combineAsyncChunks', () => {
  it('should combine multiple async chunks', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const mockPosts: Post[] = [
      { id: 1, title: 'Post 1' },
      { id: 2, title: 'Post 2' }
    ];

    const userChunk = asyncChunk<User>(async () => {
      return createDelayedResponse(mockUser, 50);
    });

    const postsChunk = asyncChunk<Post[]>(async () => {
      return createDelayedResponse(mockPosts, 100);
    });

    const combined = combineAsyncChunks({
      user: userChunk,
      posts: postsChunk
    });

    expect(combined.get()).toEqual({
      loading: true,
      error: null,
      errors: {},
      data: {
        user: null,
        posts: null
      }
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    const finalState = combined.get();
    expect(finalState.loading).toBe(false);
    expect(finalState.error).toBe(null);
    expect(finalState.errors).toEqual({});
    expect(finalState.data).toEqual({
      user: mockUser,
      posts: mockPosts
    });
  });

  it('should handle errors in combined chunks', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const errorMessage = 'Failed to fetch posts';

    const userChunk = asyncChunk<User>(async () => {
      return createDelayedResponse(mockUser, 50);
    });

    const postsChunk = asyncChunk<Post[]>(async () => {
      throw new Error(errorMessage);
    });

    const combined = combineAsyncChunks({
      user: userChunk,
      posts: postsChunk
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    const state = combined.get();
    expect(state.loading).toBe(false);
    expect(state.error?.message).toBe(errorMessage);
    expect(state.data.user).toEqual(mockUser);
    expect(state.data.posts).toBe(null);
  });
});
