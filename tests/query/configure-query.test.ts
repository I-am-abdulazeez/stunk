import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureQuery, getGlobalQueryConfig, resetQueryConfig } from '../../src/query/configure-query';

describe('configureQuery', () => {
  afterEach(() => {
    resetQueryConfig();
  });

  it('should start with an empty config', () => {
    const config = getGlobalQueryConfig();
    expect(config).toEqual({});
  });

  it('should set query config', () => {
    configureQuery({
      query: {
        staleTime: 30_000,
        retryCount: 3,
      },
    });

    const config = getGlobalQueryConfig();
    expect(config.query?.staleTime).toBe(30_000);
    expect(config.query?.retryCount).toBe(3);
  });

  it('should set mutation config', () => {
    const onError = vi.fn();
    const onSuccess = vi.fn();

    configureQuery({
      mutation: { onError, onSuccess },
    });

    const config = getGlobalQueryConfig();
    expect(config.mutation?.onError).toBe(onError);
    expect(config.mutation?.onSuccess).toBe(onSuccess);
  });

  it('should set both query and mutation config independently', () => {
    const onError = vi.fn();

    configureQuery({
      query: { staleTime: 5_000 },
      mutation: { onError },
    });

    const config = getGlobalQueryConfig();
    expect(config.query?.staleTime).toBe(5_000);
    expect(config.mutation?.onError).toBe(onError);
  });

  it('should allow configuring only query without mutation', () => {
    configureQuery({ query: { retryCount: 2 } });

    const config = getGlobalQueryConfig();
    expect(config.query?.retryCount).toBe(2);
    expect(config.mutation).toBeUndefined();
  });

  it('should allow configuring only mutation without query', () => {
    const onError = vi.fn();
    configureQuery({ mutation: { onError } });

    const config = getGlobalQueryConfig();
    expect(config.mutation?.onError).toBe(onError);
    expect(config.query).toBeUndefined();
  });

  it('should merge subsequent configureQuery calls', () => {
    configureQuery({ query: { staleTime: 10_000 } });
    configureQuery({ query: { retryCount: 2 } });

    const config = getGlobalQueryConfig();
    expect(config.query?.staleTime).toBe(10_000);
    expect(config.query?.retryCount).toBe(2);
  });

  it('should override existing values on subsequent calls', () => {
    configureQuery({ query: { staleTime: 10_000 } });
    configureQuery({ query: { staleTime: 60_000 } });

    const config = getGlobalQueryConfig();
    expect(config.query?.staleTime).toBe(60_000);
  });

  it('should reset config to empty', () => {
    configureQuery({ query: { staleTime: 30_000 } });
    resetQueryConfig();

    const config = getGlobalQueryConfig();
    expect(config).toEqual({});
  });
});


describe('configureQuery — asyncChunk integration', () => {
  afterEach(() => {
    resetQueryConfig();
  });

  it('should apply global retryCount to asyncChunk', async () => {
    // Dynamic import to ensure config is read at chunk creation time
    const { asyncChunk } = await import('../../src/query/async-chunk');

    configureQuery({ query: { retryCount: 2, retryDelay: 0 } });

    let attempts = 0;
    const fetcher = vi.fn(async () => {
      attempts++;
      throw new Error('fetch failed');
    });

    const chunk = asyncChunk(fetcher);
    await chunk.reload();

    // 1 initial + 2 retries = 3 total attempts
    expect(attempts).toBe(3);
  });

  it('should allow per-chunk retryCount to override global', async () => {
    const { asyncChunk } = await import('../../src/query/async-chunk');

    configureQuery({ query: { retryCount: 5, retryDelay: 0 } });

    let attempts = 0;
    const fetcher = vi.fn(async () => {
      attempts++;
      throw new Error('fetch failed');
    });

    // per-chunk override — should use 1 retry not 5
    const chunk = asyncChunk(fetcher, { retryCount: 1, retryDelay: 0 });
    await chunk.reload();

    expect(attempts).toBe(2); // 1 initial + 1 retry
  });

  it('should call global onError when fetch fails', async () => {
    const { asyncChunk } = await import('../../src/query/async-chunk');

    const globalOnError = vi.fn();
    configureQuery({ query: { onError: globalOnError, retryCount: 0 } });

    const chunk = asyncChunk(async () => { throw new Error('boom') });
    await chunk.reload();

    expect(globalOnError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should prefer per-chunk onError over global onError', async () => {
    const { asyncChunk } = await import('../../src/query/async-chunk');

    const globalOnError = vi.fn();
    const chunkOnError = vi.fn();

    configureQuery({ query: { onError: globalOnError, retryCount: 0 } });

    const chunk = asyncChunk(
      async () => { throw new Error('boom') },
      { onError: chunkOnError, retryCount: 0 }
    );
    await chunk.reload();

    expect(chunkOnError).toHaveBeenCalled();
    expect(globalOnError).not.toHaveBeenCalled();
  });

  it('should call global onSuccess after successful fetch', async () => {
    const { asyncChunk } = await import('../../src/query/async-chunk');

    const globalOnSuccess = vi.fn();
    configureQuery({ query: { onSuccess: globalOnSuccess } });

    const chunk = asyncChunk(async () => ({ value: 42 }));
    await chunk.reload();

    expect(globalOnSuccess).toHaveBeenCalledWith({ value: 42 });
  });

  it('should prefer per-chunk onSuccess over global onSuccess', async () => {
    const { asyncChunk } = await import('../../src/query/async-chunk');

    const globalOnSuccess = vi.fn();
    const chunkOnSuccess = vi.fn();

    configureQuery({ query: { onSuccess: globalOnSuccess } });

    const chunk = asyncChunk(
      async () => ({ value: 42 }),
      { onSuccess: chunkOnSuccess }
    );
    await chunk.reload();

    expect(chunkOnSuccess).toHaveBeenCalled();
    expect(globalOnSuccess).not.toHaveBeenCalled();
  });

  it("should not refresh because data is still fresh", async () => {
    const { asyncChunk } = await import('../../src/query/async-chunk');

    configureQuery({ query: { staleTime: 60_000 } });

    const fetcher = vi.fn(async () => ({ value: 1 }));
    const chunk = asyncChunk(fetcher);

    await chunk.reload();
    const callCount = fetcher.mock.calls.length;

    // refresh() should not refetch because data is fresh (staleTime not passed)
    await chunk.refresh();
    expect(fetcher).toHaveBeenCalledTimes(callCount); // no extra call
  })
});
