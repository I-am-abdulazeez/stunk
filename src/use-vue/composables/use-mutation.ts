import { shallowReactive, toRefs, getCurrentScope, onScopeDispose, type Ref } from "vue";
import type { Mutation, MutationResult } from "../../query/mutation";

export interface UseMutationResult<TData, TError extends Error = Error, TVariables = void> {
  /** Current mutation state */
  loading: Readonly<Ref<boolean>>;
  data: Readonly<Ref<TData | null>>;
  error: Readonly<Ref<TError | null>>;
  isSuccess: Readonly<Ref<boolean>>;
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
 * // In a component setup
 * const { mutate, loading, error, isSuccess } = useMutation(createPost);
 *
 * const handleSubmit = async (data: NewPost) => {
 *   const { error } = await mutate(data);
 *   if (!error) router.push('/posts');
 * };
 */
export function useMutation<TData, TError extends Error = Error, TVariables = void>(
  mutation: Mutation<TData, TError, TVariables>
): UseMutationResult<TData, TError, TVariables> {
  // MutationState always carries every key, so a spread + Object.assign stays in sync
  const state = shallowReactive({ ...mutation.get() });

  const unsubscribe = mutation.subscribe((newState) => {
    Object.assign(state, newState);
  });

  if (getCurrentScope()) {
    onScopeDispose(() => unsubscribe());
  }

  const mutate = ((...args: TVariables extends void ? [] : [variables: TVariables]) =>
    (mutation.mutate as (...a: any[]) => Promise<MutationResult<TData, TError>>)(...args)
  ) as UseMutationResult<TData, TError, TVariables>['mutate'];

  const { loading, data, error, isSuccess } = toRefs(state);

  return {
    loading,
    data,
    error,
    isSuccess,
    mutate,
    reset: () => mutation.reset(),
  };
}
