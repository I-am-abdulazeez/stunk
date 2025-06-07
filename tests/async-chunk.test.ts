import { describe, expect, it } from "vitest"

import { asyncChunk } from '../src/core/asyncChunk';
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

describe('asyncChunk', () => {
  // Helper to create a delayed response
  const createDelayedResponse = <T>(data: T, delay = 50): Promise<T> => {
    return new Promise((resolve) => setTimeout(() => resolve(data), delay));
  };

  it('should handle successful async operations', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(async () => {
      return createDelayedResponse(mockUser);
    });

    // Initial state
    expect(userChunk.get()).toEqual({
      loading: true,
      error: null,
      data: null,
      lastFetched: undefined
    });

    // Wait for async operation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check final state
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

    // Wait for async operation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const state = userChunk.get();
    expect(state.loading).toBe(false);
    expect(state.error?.message).toBe(errorMessage);
    expect(state.data).toBe(null);
    expect(state.lastFetched).toBe(undefined); // Error state shouldn't set lastFetched
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

    // Wait for all retries to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(attempts).toBe(3);
    expect(userChunk.get().data).toEqual(mockUser);
  });

  it('should support optimistic updates via mutate', () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(async () => mockUser);

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

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(userChunk.get().data?.id).toBe(1);

    // Trigger reload
    await userChunk.reload();
    expect(userChunk.get().data?.id).toBe(2);
  });

  it('should handle disabled state', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(
      async () => mockUser,
      { enabled: false }
    );

    // Should not start loading when disabled
    expect(userChunk.get()).toEqual({
      loading: false,
      error: null,
      data: null,
      lastFetched: undefined
    });

    // Wait to ensure it doesn't fetch
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
    const fetchUserById = async (id: number): Promise<User> => {
      return createDelayedResponse({ id, name: `User ${id}` }, 50);
    };

    const userChunk = asyncChunk(fetchUserById);

    // Initial state should not be loading since it expects parameters
    expect(userChunk.get().loading).toBe(false);

    // Load with parameters
    await userChunk.reload(1);
    expect(userChunk.get().data).toEqual({ id: 1, name: 'User 1' });

    // Load with different parameters
    await userChunk.reload(2);
    expect(userChunk.get().data).toEqual({ id: 2, name: 'User 2' });
  });

  it('should handle setParams for parameterized functions', async () => {
    const fetchUserById = async (id: number): Promise<User> => {
      return createDelayedResponse({ id, name: `User ${id}` }, 50);
    };

    const userChunk = asyncChunk(fetchUserById);

    // Set parameters and trigger fetch
    userChunk.setParams(5);
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
        refresh: { staleTime: 1000 } // 1 second stale time
      }
    );

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(callCount).toBe(1);

    // Refresh immediately should not refetch (not stale yet)
    await userChunk.refresh();
    expect(callCount).toBe(1); // Should still be 1

    // Reload should always refetch
    await userChunk.reload();
    expect(callCount).toBe(2); // Should be 2 now
  });

  it('should handle stale time correctly', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(
      async () => {
        callCount++;
        return { id: callCount, name: `User ${callCount}` };
      },
      {
        refresh: { staleTime: 50 } // 50ms stale time
      }
    );

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(callCount).toBe(1);

    // Wait for data to become stale
    await new Promise(resolve => setTimeout(resolve, 60));

    // Now refresh should refetch
    await userChunk.refresh();
    expect(callCount).toBe(2);
  });

  // it('should handle cache expiration', async () => {
  //   const userChunk = asyncChunk<User>(
  //     async () => ({ id: 1, name: 'Test User' }),
  //     {
  //       refresh: { cacheTime: 50 } // 50ms cache time
  //     }
  //   );

  //   // Wait for initial load
  //   await new Promise(resolve => setTimeout(resolve, 100));
  //   expect(userChunk.get().data).toEqual({ id: 1, name: 'Test User' });

  //   // Wait for cache to expire
  //   await new Promise(resolve => setTimeout(resolve, 60));

  //   // Data should be cleared
  //   expect(userChunk.get().data).toBe(null);
  // });

  // it('should handle auto-refresh interval', async () => {
  //   let callCount = 0;
  //   const userChunk = asyncChunk<User>(
  //     async () => {
  //       callCount++;
  //       return { id: callCount, name: `User ${callCount}` };
  //     },
  //     {
  //       refresh: { refetchInterval: 100 } // 100ms interval
  //     }
  //   );

  //   // Wait for initial load
  //   await new Promise(resolve => setTimeout(resolve, 50));
  //   expect(callCount).toBe(1);

  //   // Wait for first auto-refresh
  //   await new Promise(resolve => setTimeout(resolve, 120));
  //   expect(callCount).toBe(2);

  //   // Wait for second auto-refresh
  //   await new Promise(resolve => setTimeout(resolve, 120));
  //   expect(callCount).toBe(3);

  //   // Cleanup to stop interval
  //   userChunk.cleanup();
  // });

  it('should handle reset functionality', async () => {
    let callCount = 0;
    const userChunk = asyncChunk<User>(async () => {
      callCount++;
      return { id: callCount, name: `User ${callCount}` };
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(userChunk.get().data).toEqual({ id: 1, name: 'User 1' });

    // Mutate data
    userChunk.mutate(() => ({ id: 999, name: 'Mutated User' }));
    expect(userChunk.get().data).toEqual({ id: 999, name: 'Mutated User' });

    // Reset should restore to initial state and refetch
    userChunk.reset();
    expect(userChunk.get().data).toBe(null);
    expect(userChunk.get().loading).toBe(true);

    // Wait for refetch after reset
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

    // Both subscribers should receive the same updates
    expect(states1).toHaveLength(states2.length);
    expect(states1[states1.length - 1]).toEqual(states2[states2.length - 1]);
  });

  it('should handle concurrent mutations', () => {
    const userChunk = asyncChunk<User>(
      async () => ({ id: 1, name: 'Test User' }),
      { initialData: { id: 1, name: 'Initial' } }
    );

    // Multiple mutations
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

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cleanup should stop all intervals
    userChunk.cleanup();

    // Even after cleanup, the data should still be accessible
    expect(userChunk.get().data).toEqual({ id: 1, name: 'Test User' });
  });

  it('should handle invalid parameters for parameterized functions', async () => {
    const fetchUserById = (id: number) => {
      if (!id) throw new Error('Invalid ID');
      return Promise.resolve({ id, name: `User ${id}` });
    };

    const userChunk = asyncChunk(fetchUserById);

    // Should not start loading without valid params
    expect(userChunk.get().loading).toBe(false);

    // Try to set invalid params
    userChunk.setParams(null as any);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should still not have loaded
    expect(userChunk.get().data).toBe(null);
    expect(userChunk.get().loading).toBe(false);
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

    // Initial state - updated to match the combineAsyncChunks structure
    expect(combined.get()).toEqual({
      loading: true,
      error: null,
      errors: {}, // Added this property from your combineAsyncChunks
      data: {
        user: null,
        posts: null
      }
    });

    // Wait for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    // Check final state
    const finalState = combined.get();
    expect(finalState.loading).toBe(false);
    expect(finalState.error).toBe(null);
    expect(finalState.errors).toEqual({}); // No errors
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

    // Wait for all operations to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    const state = combined.get();
    expect(state.loading).toBe(false);
    expect(state.error?.message).toBe(errorMessage);
    expect(state.data.user).toEqual(mockUser);
    expect(state.data.posts).toBe(null);
  });

  it('should update loading state correctly', async () => {
    const loadingStates: boolean[] = [];
    const userChunk = asyncChunk<User>(async () => {
      return createDelayedResponse({ id: 1, name: 'Test User' }, 50);
    });

    const postsChunk = asyncChunk<Post[]>(async () => {
      return createDelayedResponse([], 100);
    });

    const combined = combineAsyncChunks({
      user: userChunk,
      posts: postsChunk
    });

    combined.subscribe(state => {
      loadingStates.push(state.loading);
    });

    // Wait for all operations
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should start with loading true and end with false
    expect(loadingStates[0]).toBe(true);
    expect(loadingStates[loadingStates.length - 1]).toBe(false);
  });

  it('should handle partial loading states', async () => {
    const userChunk = asyncChunk<User>(async () => {
      return createDelayedResponse({ id: 1, name: 'Test User' }, 50);
    });

    const postsChunk = asyncChunk<Post[]>(async () => {
      return createDelayedResponse([{ id: 1, title: 'Post 1' }], 100);
    });

    const combined = combineAsyncChunks({
      user: userChunk,
      posts: postsChunk
    });

    const states: any[] = [];
    combined.subscribe(state => states.push({ ...state }));

    await new Promise(resolve => setTimeout(resolve, 150));

    // Should have states where user is loaded but posts are still loading
    const partialState = states.find(state =>
      state.data.user !== null && state.data.posts === null && state.loading === true
    );
    expect(partialState).toBeDefined();
  });

  it('should handle empty chunks object', () => {
    const combined = combineAsyncChunks({});

    expect(combined.get()).toEqual({
      loading: false, // No chunks means no loading
      error: null,
      errors: {},
      data: {}
    });
  });

  it('should handle single chunk', async () => {
    const userChunk = asyncChunk<User>(async () => {
      return createDelayedResponse({ id: 1, name: 'Test User' }, 50);
    });

    const combined = combineAsyncChunks({ user: userChunk });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(combined.get()).toEqual({
      loading: false,
      error: null,
      errors: {},
      data: { user: { id: 1, name: 'Test User' } }
    });
  });

  it('should handle multiple errors correctly', async () => {
    const userChunk = asyncChunk<User>(async () => {
      throw new Error('User error');
    });

    const postsChunk = asyncChunk<Post[]>(async () => {
      throw new Error('Posts error');
    });

    const profileChunk = asyncChunk<{ bio: string }>(async () => {
      return { bio: 'Test bio' };
    });

    const combined = combineAsyncChunks({
      user: userChunk,
      posts: postsChunk,
      profile: profileChunk
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const state = combined.get();
    expect(state.loading).toBe(false);
    expect(state.error?.message).toBe('User error'); // First error
    expect(state.errors).toEqual({
      user: expect.objectContaining({ message: 'User error' }),
      posts: expect.objectContaining({ message: 'Posts error' })
    });
    expect(state.data.profile).toEqual({ bio: 'Test bio' });
  });

  it('should handle chunks with different timing', async () => {
    const fastChunk = asyncChunk<string>(async () => {
      return createDelayedResponse('fast', 25);
    });

    const slowChunk = asyncChunk<string>(async () => {
      return createDelayedResponse('slow', 100);
    });

    const combined = combineAsyncChunks({
      fast: fastChunk,
      slow: slowChunk
    });

    // After 50ms, fast should be done but slow should still be loading
    await new Promise(resolve => setTimeout(resolve, 50));
    let state = combined.get();
    expect(state.data.fast).toBe('fast');
    expect(state.data.slow).toBe(null);
    expect(state.loading).toBe(true);

    // After 150ms, both should be done
    await new Promise(resolve => setTimeout(resolve, 100));
    state = combined.get();
    expect(state.data.fast).toBe('fast');
    expect(state.data.slow).toBe('slow');
    expect(state.loading).toBe(false);
  });

  it('should handle chunks with initial data', async () => {
    const userChunk = asyncChunk<User>(
      async () => createDelayedResponse({ id: 2, name: 'Loaded User' }, 50),
      { initialData: { id: 1, name: 'Initial User' } }
    );

    const postsChunk = asyncChunk<Post[]>(
      async () => createDelayedResponse([{ id: 1, title: 'Post 1' }], 50),
      { initialData: [] }
    );

    const combined = combineAsyncChunks({
      user: userChunk,
      posts: postsChunk
    });

    // Initial state should have initial data
    expect(combined.get().data).toEqual({
      user: { id: 1, name: 'Initial User' },
      posts: []
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Final state should have loaded data
    expect(combined.get().data).toEqual({
      user: { id: 2, name: 'Loaded User' },
      posts: [{ id: 1, title: 'Post 1' }]
    });
  });

  it('should handle disabled chunks', async () => {
    const enabledChunk = asyncChunk<User>(async () => {
      return createDelayedResponse({ id: 1, name: 'Test User' }, 50);
    });

    const disabledChunk = asyncChunk<Post[]>(
      async () => createDelayedResponse([{ id: 1, title: 'Post 1' }], 50),
      { enabled: false }
    );

    const combined = combineAsyncChunks({
      user: enabledChunk,
      posts: disabledChunk
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const state = combined.get();
    expect(state.data.user).toEqual({ id: 1, name: 'Test User' });
    expect(state.data.posts).toBe(null); // Disabled chunk shouldn't load
    expect(state.loading).toBe(false);
  });

  it('should handle chunk mutations', async () => {
    const userChunk = asyncChunk<User>(
      async () => createDelayedResponse({ id: 1, name: 'Test User' }, 50)
    );

    const combined = combineAsyncChunks({ user: userChunk });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Mutate the underlying chunk
    userChunk.mutate(current => ({ ...current!, name: 'Mutated User' }));

    // Combined should reflect the mutation
    expect(combined.get().data.user?.name).toBe('Mutated User');
  });

  it('should handle unsubscription properly', async () => {
    const userChunk = asyncChunk<User>(async () => {
      return createDelayedResponse({ id: 1, name: 'Test User' }, 50);
    });

    const combined = combineAsyncChunks({ user: userChunk });

    const states: any[] = [];
    const unsubscribe = combined.subscribe(state => states.push(state));

    await new Promise(resolve => setTimeout(resolve, 100));

    const statesBefore = states.length;
    unsubscribe();

    // Trigger more updates
    userChunk.mutate(current => ({ ...current!, name: 'Updated' }));

    // Should not receive more updates after unsubscribing
    expect(states.length).toBe(statesBefore);
  });
});

// Helper function
function createDelayedResponse<T>(data: T, delay = 50): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), delay));
}
