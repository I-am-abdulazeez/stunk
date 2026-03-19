import type { AsyncChunk } from "./async-chunk";
import type { GlobalQueryConfig } from "./configure-query";

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
  mutate: (variables: TVariables) => Promise<MutationResult<TData, TError>>;
  /** Returns the current mutation state */
  get: () => MutationState<TData, TError>;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe: (callback: (state: MutationState<TData, TError>) => void) => () => void;
  /** Reset state back to initial — clears data, error, isSuccess */
  reset: () => void;
}

/** Global mutation config shape — used internally by configureQuery */
export type GlobalMutationConfig = NonNullable<GlobalQueryConfig['mutation']>;
