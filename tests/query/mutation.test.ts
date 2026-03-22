import { describe, it, expect, vi, afterEach } from 'vitest';
import { mutation } from '../../src/query/mutation';
import { asyncChunk } from '../../src/query/async-chunk';
import { configureQuery, resetQueryConfig } from '../../src/query/configure-query';

afterEach(() => {
  resetQueryConfig();
});

describe('mutation — core behavior', () => {
  it('should start with correct initial state', () => {
    const m = mutation(async () => 'ok');

    expect(m.get()).toEqual({
      loading: false,
      data: null,
      error: null,
      isSuccess: false,
    });
  });

  it('should set loading true while mutating', async () => {
    let resolveFn!: () => void;
    const m = mutation(
      () => new Promise<string>((resolve) => { resolveFn = () => resolve('done'); })
    );

    const promise = m.mutate();
    expect(m.get().loading).toBe(true);

    resolveFn();
    await promise;
    expect(m.get().loading).toBe(false);
  });

  it('should set data and isSuccess on success', async () => {
    const m = mutation(async () => ({ id: 1, title: 'Hello' }));

    const result = await m.mutate();

    expect(result).toEqual({ data: { id: 1, title: 'Hello' }, error: null });
    expect(m.get()).toEqual({
      loading: false,
      data: { id: 1, title: 'Hello' },
      error: null,
      isSuccess: true,
    });
  });

  it('should set error and not set isSuccess on failure', async () => {
    const m = mutation(async () => { throw new Error('boom') });

    const result = await m.mutate();

    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('boom');
    expect(m.get().isSuccess).toBe(false);
    expect(m.get().loading).toBe(false);
  });

  it('should never throw — always resolves', async () => {
    const m = mutation(async () => { throw new Error('fail') });

    await expect(m.mutate()).resolves.toEqual({
      data: null,
      error: expect.any(Error),
    });
  });

  it('should reset state to initial', async () => {
    const m = mutation(async () => 42);

    await m.mutate();
    expect(m.get().isSuccess).toBe(true);

    m.reset();
    expect(m.get()).toEqual({
      loading: false,
      data: null,
      error: null,
      isSuccess: false,
    });
  });

  it('should notify subscribers on state change', async () => {
    const m = mutation(async () => 'result');
    const subscriber = vi.fn();

    const unsub = m.subscribe(subscriber);

    await m.mutate();

    expect(subscriber).toHaveBeenCalledTimes(2); // loading: true, then loading: false
    unsub();
  });

  it('should stop notifying after unsubscribe', async () => {
    const m = mutation(async () => 'result');
    const subscriber = vi.fn();

    const unsub = m.subscribe(subscriber);
    unsub();

    await m.mutate();
    expect(subscriber).not.toHaveBeenCalled();
  });
});


describe('mutation — variables', () => {
  it('should pass variables to the mutation function', async () => {
    const mutationFn = vi.fn(async (data: { title: string }) => ({ id: 1, ...data }));
    const m = mutation(mutationFn);

    await m.mutate({ title: 'Hello' });

    expect(mutationFn).toHaveBeenCalledWith({ title: 'Hello' });
  });

  it('should pass variables to onSuccess', async () => {
    const onSuccess = vi.fn();
    const m = mutation(
      async (vars: { title: string }) => ({ id: 1, ...vars }),
      { onSuccess }
    );

    await m.mutate({ title: 'Hello' });

    expect(onSuccess).toHaveBeenCalledWith({ id: 1, title: 'Hello' }, { title: 'Hello' });
  });

  it('should pass variables to onError', async () => {
    const onError = vi.fn();
    const m = mutation(
      async (vars: { id: number }) => { throw new Error('not found') },
      { onError }
    );

    await m.mutate({ id: 99 });

    expect(onError).toHaveBeenCalledWith(expect.any(Error), { id: 99 });
  });

  it('should pass variables to onSettled on success', async () => {
    const onSettled = vi.fn();
    const m = mutation(
      async (vars: { title: string }) => 'ok',
      { onSettled }
    );

    await m.mutate({ title: 'Hello' });

    expect(onSettled).toHaveBeenCalledWith('ok', null, { title: 'Hello' });
  });

  it('should pass variables to onSettled on failure', async () => {
    const onSettled = vi.fn();
    const m = mutation(
      async (vars: { id: number }) => { throw new Error('fail') },
      { onSettled }
    );

    await m.mutate({ id: 1 });

    expect(onSettled).toHaveBeenCalledWith(null, expect.any(Error), { id: 1 });
  });
});


describe('mutation — callbacks', () => {
  it('should call onSuccess after successful mutation', async () => {
    const onSuccess = vi.fn();
    const m = mutation(async () => 42, { onSuccess });

    await m.mutate();

    expect(onSuccess).toHaveBeenCalledWith(42, undefined);
  });

  it('should call onError after failed mutation', async () => {
    const onError = vi.fn();
    const m = mutation(async () => { throw new Error('fail') }, { onError });

    await m.mutate();

    expect(onError).toHaveBeenCalledWith(expect.any(Error), undefined);
  });

  it('should call onSettled on success', async () => {
    const onSettled = vi.fn();
    const m = mutation(async () => 'done', { onSettled });

    await m.mutate();

    expect(onSettled).toHaveBeenCalledWith('done', null, undefined);
  });

  it('should call onSettled on failure', async () => {
    const onSettled = vi.fn();
    const m = mutation(async () => { throw new Error('fail') }, { onSettled });

    await m.mutate();

    expect(onSettled).toHaveBeenCalledWith(null, expect.any(Error), undefined);
  });

  it('should call onSettled even when onSuccess throws', async () => {
    const onSettled = vi.fn();
    const m = mutation(async () => 'ok', {
      onSuccess: () => { throw new Error('oops') },
      onSettled,
    });

    // onSuccess throws — onSettled should still fire
    try { await m.mutate(); } catch { }

    expect(onSettled).toHaveBeenCalled();
  });
});


describe('mutation — invalidates', () => {
  it('should reload invalidated chunks after success', async () => {
    const fetcher = vi.fn(async () => [1, 2, 3]);
    const listChunk = asyncChunk(fetcher);
    await listChunk.reload();

    fetcher.mockClear();

    const m = mutation(
      async (item: number) => item,
      { invalidates: [listChunk] }
    );

    await m.mutate(4);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should reload multiple invalidated chunks', async () => {
    const fetcherA = vi.fn(async () => 'a');
    const fetcherB = vi.fn(async () => 'b');
    const chunkA = asyncChunk(fetcherA);
    const chunkB = asyncChunk(fetcherB);

    await chunkA.reload();
    await chunkB.reload();
    fetcherA.mockClear();
    fetcherB.mockClear();

    const m = mutation(
      async () => 'done',
      { invalidates: [chunkA, chunkB] }
    );

    await m.mutate();

    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });

  it('should NOT reload invalidated chunks on failure', async () => {
    const fetcher = vi.fn(async () => [1, 2, 3]);
    const listChunk = asyncChunk(fetcher);
    await listChunk.reload();
    fetcher.mockClear();

    const m = mutation(
      async () => { throw new Error('fail') },
      { invalidates: [listChunk] }
    );

    await m.mutate();

    expect(fetcher).not.toHaveBeenCalled();
  });
});


describe('mutation — global config', () => {
  it('should use global onError when per-mutation onError is not set', async () => {
    const globalOnError = vi.fn();
    configureQuery({ mutation: { onError: globalOnError } });

    const m = mutation(async () => { throw new Error('boom') });
    await m.mutate();

    expect(globalOnError).toHaveBeenCalledWith(expect.any(Error), undefined);
  });

  it('should use global onSuccess when per-mutation onSuccess is not set', async () => {
    const globalOnSuccess = vi.fn();
    configureQuery({ mutation: { onSuccess: globalOnSuccess } });

    const m = mutation(async () => 'result');
    await m.mutate();

    expect(globalOnSuccess).toHaveBeenCalledWith('result', undefined);
  });

  it('should prefer per-mutation onError over global', async () => {
    const globalOnError = vi.fn();
    const localOnError = vi.fn();
    configureQuery({ mutation: { onError: globalOnError } });

    const m = mutation(
      async () => { throw new Error('fail') },
      { onError: localOnError }
    );
    await m.mutate();

    expect(localOnError).toHaveBeenCalled();
    expect(globalOnError).not.toHaveBeenCalled();
  });

  it('should prefer per-mutation onSuccess over global', async () => {
    const globalOnSuccess = vi.fn();
    const localOnSuccess = vi.fn();
    configureQuery({ mutation: { onSuccess: globalOnSuccess } });

    const m = mutation(async () => 'ok', { onSuccess: localOnSuccess });
    await m.mutate();

    expect(localOnSuccess).toHaveBeenCalled();
    expect(globalOnSuccess).not.toHaveBeenCalled();
  });
});
