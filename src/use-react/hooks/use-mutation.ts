import { useState, useEffect, useCallback } from "react";
import type { Mutation, MutationResult, MutationState } from "../../query/mutation";

export interface UseMutationResult<TData, TError extends Error = Error, TVariables = void> {
  /** Current mutation state */
  loading: boolean;
  data: TData | null;
  error: TError | null;
  isSuccess: boolean;
  /**
   * Execute the mutation. Always resolves — never throws.
   * Safe to fire and forget, or await for local UI control.
   *
   * @example
   * // Fire and forget
   * mutate({ title: 'Hello' });
   *
   * // Await for local control — no try/catch needed
   * const { data, error } = await mutate({ title: 'Hello' });
   * if (!error) router.push('/posts');
   */
  mutate: TVariables extends void
  ? () => Promise<MutationResult<TData, TError>>
  : (variables: TVariables) => Promise<MutationResult<TData, TError>>;
  /** Reset mutation state back to initial */
  reset: () => void;
}

/**
 * Subscribes to a mutation instance and returns its reactive state with `mutate` and `reset`.
 *
 * @param mutation - A `mutation()` instance from `stunk/query`.
 *
 * @example
 * const createPost = mutation(
 *   async (data: NewPost) => fetchAPI('/posts', { method: 'POST', body: data }),
 *   { invalidates: [postsChunk] }
 * );
 *
 * function CreatePostForm() {
 *   const { mutate, loading, error, isSuccess } = useMutation(createPost);
 *
 *   const handleSubmit = async (data: NewPost) => {
 *     const { error } = await mutate(data);
 *     if (!error) router.push('/posts');
 *   };
 * }
 */
export function useMutation<TData, TError extends Error = Error, TVariables = void>(
  mutation: Mutation<TData, TError, TVariables>
): UseMutationResult<TData, TError, TVariables> {
  const [state, setState] = useState<MutationState<TData, TError>>(
    () => mutation.get()
  );

  useEffect(() => {
    // Sync on mount in case state changed between useState() and subscription
    setState(mutation.get());

    const unsubscribe = mutation.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [mutation]);

  const mutate = useCallback(
    (...args: TVariables extends void ? [] : [variables: TVariables]) =>
      (mutation.mutate as (...a: any[]) => Promise<MutationResult<TData, TError>>)(...args),
    [mutation]
  ) as UseMutationResult<TData, TError, TVariables>['mutate'];

  const reset = useCallback(() => mutation.reset(), [mutation]);

  return {
    loading: state.loading,
    data: state.data,
    error: state.error,
    isSuccess: state.isSuccess,
    mutate,
    reset,
  };
}
