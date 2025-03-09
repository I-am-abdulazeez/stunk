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
      data: null
    });

    // Wait for async operation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check final state
    expect(userChunk.get()).toEqual({
      loading: false,
      error: null,
      data: mockUser
    });
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

    // Initial state
    expect(combined.get()).toEqual({
      loading: true,
      error: null,
      data: {
        user: null,
        posts: null
      }
    });

    // Wait for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    // Check final state
    expect(combined.get()).toEqual({
      loading: false,
      error: null,
      data: {
        user: mockUser,
        posts: mockPosts
      }
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
});

// Helper function
function createDelayedResponse<T>(data: T, delay = 50): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), delay));
}
