export interface GlobalQueryConfig {
  /**
   * Default configuration applied to all asyncChunk instances.
   * Per-chunk options always override these defaults.
   */
  query?: {
    /** Time in ms before data is considered stale (default: 0) */
    staleTime?: number;
    /** Time in ms to cache data after last subscriber leaves (default: 300_000) */
    cacheTime?: number;
    /** Auto-refetch interval in ms */
    refetchInterval?: number;
    /** Refetch when window regains focus (default: false) */
    refetchOnWindowFocus?: boolean;
    /** Number of retries on failure (default: 0) */
    retryCount?: number;
    /** Delay in ms between retries (default: 1000) */
    retryDelay?: number;
    /** Global error handler — called when all retries are exhausted */
    onError?: (error: Error) => void;
    /** Global success handler — called after every successful fetch */
    onSuccess?: (data: unknown) => void;
  };

  /**
   * Default configuration applied to all mutation instances.
   * Reserved for when mutation() ships — per-mutation options always override.
   */
  mutation?: {
    /** Global error handler for mutations */
    onError?: (error: Error) => void;
    /** Global success handler for mutations */
    onSuccess?: (data: unknown) => void;
  };
}

let globalConfig: GlobalQueryConfig = {};

/**
 * Configures global defaults for all `asyncChunk` and `mutation` instances.
 *
 * Call this once at app entry — before any `asyncChunk` is created.
 * Per-chunk options always take precedence over these defaults.
 *
 * @param config.query  - Defaults for all async chunks (staleTime, retryCount, onError, etc.)
 * @param config.mutation - Defaults for all mutations (onError, onSuccess)
 *
 * @example
 * import { configureQuery } from "stunk/query";
 *
 * configureQuery({
 *   query: {
 *     staleTime: 30_000,
 *     retryCount: 3,
 *     refetchOnWindowFocus: true,
 *     onError: (err) => toast.error(err.message),
 *   },
 *   mutation: {
 *     onError: (err) => toast.error(err.message),
 *     onSuccess: () => toast.success("Done!"),
 *   },
 * });
 */
export function configureQuery(config: GlobalQueryConfig): void {
  globalConfig = {
    ...(config.query !== undefined && {
      query: { ...globalConfig.query, ...config.query },
    }),
    ...(config.mutation !== undefined && {
      mutation: { ...globalConfig.mutation, ...config.mutation },
    }),
  };
}

/**
 * Returns the current global query config.
 * Used internally by asyncChunk and mutation to read defaults.
 */
export function getGlobalQueryConfig(): GlobalQueryConfig {
  return globalConfig;
}

/**
 * Resets the global config back to defaults.
 * Primarily useful in tests to avoid config bleed between test cases.
 *
 * @example
 * afterEach(() => resetQueryConfig());
 */
export function resetQueryConfig(): void {
  globalConfig = {};
}
