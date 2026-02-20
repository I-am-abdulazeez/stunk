import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { asyncChunk, AsyncChunk, PaginatedAsyncChunk } from '../../src/core/async-chunk';
import { useAsyncChunk } from '../../src/use-react/hooks/use-async-chunk';

afterEach(() => {
  cleanup();
});

function HookHarness({
  source,
}: {
  source: AsyncChunk<any, Error> | PaginatedAsyncChunk<any, Error>;
}) {
  const state = useAsyncChunk(source as any);

  return (
    <div data-testid="state">
      {String(state.loading)}:{String('nextPage' in state)}
    </div>
  );
}

describe('useAsyncChunk hook order stability', () => {
  it('does not throw when rerendering from non-paginated to paginated chunk', () => {
    const nonPaginated = asyncChunk(async () => 'ok');
    const paginated = asyncChunk(
      async ({ page = 1, pageSize = 2 }: { page?: number; pageSize?: number }) => ({
        data: Array.from({ length: pageSize }, (_, i) => `${page}-${i}`),
        hasMore: false,
        total: 2,
      }),
      { pagination: { pageSize: 2 } }
    ) as PaginatedAsyncChunk<string[], Error>;

    const { rerender, getByTestId } = render(<HookHarness source={nonPaginated} />);

    expect(() => {
      rerender(<HookHarness source={paginated} />);
    }).not.toThrow();

    expect(getByTestId('state').textContent).toContain(':true');
  });

  it('does not throw when rerendering from paginated to non-paginated chunk', () => {
    const paginated = asyncChunk(
      async ({ page = 1, pageSize = 2 }: { page?: number; pageSize?: number }) => ({
        data: Array.from({ length: pageSize }, (_, i) => `${page}-${i}`),
        hasMore: false,
        total: 2,
      }),
      { pagination: { pageSize: 2 } }
    ) as PaginatedAsyncChunk<string[], Error>;

    const nonPaginated = asyncChunk(async () => 'ok');

    const { rerender, getByTestId } = render(<HookHarness source={paginated} />);

    expect(() => {
      rerender(<HookHarness source={nonPaginated} />);
    }).not.toThrow();

    expect(getByTestId('state').textContent).toContain(':false');
  });
});
