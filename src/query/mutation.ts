import type { AsyncChunk } from "./async-chunk";
import type { GlobalQueryConfig } from "./configure-query";
import { getGlobalQueryConfig } from "./configure-query";
import { chunk } from "../core/core";

export type MutationFn<TData, TVariables> = (variables: TVariables) => Promise<TData>;

export interface MutationOptions<TData, TError extends Error = Error, TVariables = void> {
  /** Chunks to automatically reload after a successful mutation */
  invalidates?: AsyncChunk<any, any>[];
  /** Called after a successful mutation with the returned data and original variables */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Called when the mutation fails with the error and original variables */
  onError?: (error: TError, variables: TVariables) => void;
  /** Called after every attempt — success or failure — useful for unconditional cleanup */
  onSettled?: (data: TData | null, error: TError | null, variables: TVariables) => void;
}

export interface MutationState<TData, TError extends Error = Error> {
  /** True while the mutation is in progress */
  loading: boolean;
  /** The data returned from the last successful mutation, or null */
  data: TData | null;
  /** The error from the last failed mutation, or null */
  error: TError | null;
  /** True after a successful mutation — distinct from data since data can be null on success */
  isSuccess: boolean;
}

export interface MutationResult<TData, TError extends Error = Error> {
  /** The returned data on success, or null on failure */
  data: TData | null;
  /** The error on failure, or null on success */
  error: TError | null;
}

export interface Mutation<TData, TError extends Error = Error, TVariables = void> {
  /**
   * Execute the mutation. Always resolves — never throws.
   * Returns `{ data, error }` so you can await it or fire and forget safely.
   *
   * @example
   * // Fire and forget — safe
   * createPost.mutate({ title: 'Hello' });
   *
   * // Await for local UI control — no try/catch needed
   * const { data, error } = await createPost.mutate({ title: 'Hello' });
   * if (!error) router.push('/posts');
   */
  mutate: (...args: TVariables extends void ? [] : [variables: TVariables]) => Promise<MutationResult<TData, TError>>;
  /** Returns the current mutation state */
  get: () => MutationState<TData, TError>;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe: (callback: (state: MutationState<TData, TError>) => void) => () => void;
  /** Reset state back to initial — clears data, error, isSuccess */
  reset: () => void;
}

/** Global mutation config shape — used internally by configureQuery */
export type GlobalMutationConfig = NonNullable<GlobalQueryConfig['mutation']>;

/**
 * Creates a reactive mutation for POST, PUT, DELETE, or any async side effect.
 *
 * Always returns a promise that resolves — never throws.
 * On success, automatically reloads any chunks listed in `invalidates`.
 *
 * @param mutationFn - Async function that performs the side effect.
 * @param options.invalidates - Chunks to reload after a successful mutation.
 * @param options.onSuccess - Called with data and variables on success.
 * @param options.onError - Called with error and variables on failure.
 * @param options.onSettled - Called after every attempt regardless of outcome.
 *
 * @example
 * const createPost = mutation(
 *   async (data: NewPost) => fetchAPI('/posts', { method: 'POST', body: data }),
 *   {
 *     invalidates: [postsChunk],
 *     onSuccess: (data) => toast.success('Post created!'),
 *     onError: (err) => toast.error(err.message),
 *   }
 * );
 *
 * // Fire and forget
 * createPost.mutate({ title: 'Hello' });
 *
 * // Await for local control
 * const { data, error } = await createPost.mutate({ title: 'Hello' });
 * if (!error) router.push('/posts');
 */
export function mutation<TData, TError extends Error = Error, TVariables = void>(
  mutationFn: MutationFn<TData, TVariables>,
  options: MutationOptions<TData, TError, TVariables> = {}
): Mutation<TData, TError, TVariables> {
  const globalMutation = getGlobalQueryConfig().mutation ?? {};

  const {
    invalidates = [],
    onSuccess = globalMutation.onSuccess as ((data: TData, variables: TVariables) => void) | undefined,
    onError = globalMutation.onError as ((error: TError, variables: TVariables) => void) | undefined,
    onSettled,
  } = options;

  const initialState: MutationState<TData, TError> = {
    loading: false,
    data: null,
    error: null,
    isSuccess: false,
  };

  const stateChunk = chunk<MutationState<TData, TError>>(initialState);

  const mutate = async (...args: TVariables extends void ? [] : [variables: TVariables]): Promise<MutationResult<TData, TError>> => {
    const variables = args[0] as TVariables;
    stateChunk.set({
      loading: true,
      data: null,
      error: null,
      isSuccess: false,
    });

    try {
      const data = await mutationFn(variables);

      stateChunk.set({
        loading: false,
        data,
        error: null,
        isSuccess: true,
      });

      // Reload all invalidated chunks after success
      if (invalidates.length > 0) {
        await Promise.all(invalidates.map(c => c.reload()));
      }

      if (onSuccess) onSuccess(data, variables);
      if (onSettled) onSettled(data, null, variables);

      return { data, error: null };
    } catch (err) {
      const error = err as TError;

      stateChunk.set({
        loading: false,
        data: null,
        error,
        isSuccess: false,
      });

      if (onError) onError(error, variables);
      if (onSettled) onSettled(null, error, variables);

      return { data: null, error };
    }
  };

  return {
    mutate,
    get: () => stateChunk.get(),
    subscribe: (callback) => stateChunk.subscribe(callback),
    reset: () => stateChunk.set(initialState),
  };
}
