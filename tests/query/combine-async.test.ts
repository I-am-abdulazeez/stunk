import { describe, expect, it } from "vitest";
import { asyncChunk } from "../../src/query/async-chunk";
import { combineAsyncChunks } from "../../src/query/combine-async-chunk";

interface User {
  id: number;
  name: string;
}

interface Post {
  id: number;
  title: string;
}

interface Config {
  theme: string;
  language: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createDelayedResponse = <T>(data: T, ms = 50): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(data), ms));

describe('combineAsyncChunks', () => {
  it('should reflect loading state before any chunk resolves', async () => {
    const userChunk = asyncChunk<User>(() => createDelayedResponse({ id: 1, name: 'Test User' }, 100));
    const postsChunk = asyncChunk<Post[]>(() => createDelayedResponse([], 100));

    const combined = combineAsyncChunks({ user: userChunk, posts: postsChunk });

    expect(combined.get()).toEqual({
      loading: true,
      error: null,
      errors: {},
      data: { user: null, posts: null },
    });
  });

  it('should resolve all chunks into a single state', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const mockPosts: Post[] = [{ id: 1, title: 'Post 1' }, { id: 2, title: 'Post 2' }];

    const userChunk = asyncChunk<User>(() => createDelayedResponse(mockUser, 50));
    const postsChunk = asyncChunk<Post[]>(() => createDelayedResponse(mockPosts, 100));

    const combined = combineAsyncChunks({ user: userChunk, posts: postsChunk });

    await delay(150);

    const state = combined.get();
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
    expect(state.errors).toEqual({});
    expect(state.data).toEqual({ user: mockUser, posts: mockPosts });
  });

  it('should remain in loading state until all chunks resolve', async () => {
    const userChunk = asyncChunk<User>(() => createDelayedResponse({ id: 1, name: 'Test User' }, 50));
    const postsChunk = asyncChunk<Post[]>(() => createDelayedResponse([], 200));

    const combined = combineAsyncChunks({ user: userChunk, posts: postsChunk });

    await delay(100); // user resolved, posts still loading

    expect(combined.get().loading).toBe(true);
    expect(combined.get().data.user).toEqual({ id: 1, name: 'Test User' });
    expect(combined.get().data.posts).toBe(null);

    await delay(150); // posts resolved

    expect(combined.get().loading).toBe(false);
  });

  it('should surface a per-chunk error and set it as the top-level error', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };

    const userChunk = asyncChunk<User>(() => createDelayedResponse(mockUser, 50));
    const postsChunk = asyncChunk<Post[]>(() => { throw new Error('Failed to fetch posts'); });

    const combined = combineAsyncChunks({ user: userChunk, posts: postsChunk });

    await delay(150);

    const state = combined.get();
    expect(state.loading).toBe(false);
    expect(state.error?.message).toBe('Failed to fetch posts');
    expect(state.errors).toMatchObject({ posts: expect.any(Error) });
    expect(state.data.user).toEqual(mockUser);
    expect(state.data.posts).toBe(null);
  });

  it('should surface multiple errors independently', async () => {
    const userChunk = asyncChunk<User>(() => { throw new Error('User error'); });
    const postsChunk = asyncChunk<Post[]>(() => { throw new Error('Posts error'); });

    const combined = combineAsyncChunks({ user: userChunk, posts: postsChunk });

    await delay(150);

    const state = combined.get();
    expect(state.loading).toBe(false);
    expect(state.error).not.toBe(null); // first error wins
    expect(state.errors.user?.message).toBe('User error');
    expect(state.errors.posts?.message).toBe('Posts error');
    expect(state.data.user).toBe(null);
    expect(state.data.posts).toBe(null);
  });

  it('should handle a single chunk', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(() => createDelayedResponse(mockUser, 50));

    const combined = combineAsyncChunks({ user: userChunk });

    await delay(100);

    const state = combined.get();
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
    expect(state.data.user).toEqual(mockUser);
  });

  it('should handle three or more chunks', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const mockPosts: Post[] = [{ id: 1, title: 'Post 1' }];
    const mockConfig: Config = { theme: 'dark', language: 'en' };

    const userChunk = asyncChunk<User>(() => createDelayedResponse(mockUser, 50));
    const postsChunk = asyncChunk<Post[]>(() => createDelayedResponse(mockPosts, 75));
    const configChunk = asyncChunk<Config>(() => createDelayedResponse(mockConfig, 100));

    const combined = combineAsyncChunks({
      user: userChunk,
      posts: postsChunk,
      config: configChunk,
    });

    await delay(150);

    const state = combined.get();
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
    expect(state.data).toEqual({
      user: mockUser,
      posts: mockPosts,
      config: mockConfig,
    });
  });

  it('should notify subscribers when any chunk updates', async () => {
    const mockUser: User = { id: 1, name: 'Test User' };
    const userChunk = asyncChunk<User>(() => createDelayedResponse(mockUser, 50));
    const postsChunk = asyncChunk<Post[]>(() => createDelayedResponse([], 100));

    const combined = combineAsyncChunks({ user: userChunk, posts: postsChunk });

    const states: any[] = [];
    combined.subscribe(s => states.push({ ...s }));

    await delay(150);

    expect(states.length).toBeGreaterThan(0);
    expect(states.at(-1).loading).toBe(false);
    expect(states.at(-1).data.user).toEqual(mockUser);
  });
});
