import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaginatedPhotosResponse } from '@/types';
import { useAppStore } from '@/store';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  search: vi.fn(),
  byTag: vi.fn(),
  byTags: vi.fn(),
}));

vi.mock('@/services/photoApi', () => ({ photoApi: api }));

import { useInfinitePhotos } from './useInfinitePhotos';
import { useSearchPhotos } from './useSearchPhotos';

const page = (ids: string[], total: number, hasMore: boolean): PaginatedPhotosResponse => ({
  photos: ids.map((id) => ({ id, name: id, ext: 'jpg' }) as PaginatedPhotosResponse['photos'][number]),
  total,
  totalSize: total,
  hasMore,
});

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ requestPageSize: 2 });
});

describe('photo query hooks', () => {
  it('uses additive pagination metadata without mutating cached pages', async () => {
    api.list
      .mockResolvedValueOnce(page(['one', 'two'], 3, true))
      .mockResolvedValueOnce(page(['three'], 3, false));
    const { result } = renderHook(
      () => useInfinitePhotos(null, { field: 'random', direction: 'asc', randomSeed: 9 }),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.list.mock.calls[0][1]).toMatchObject({ limit: 2, offset: 0, randomSeed: 9 });
    expect(api.list.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);

    let nextPageResult: Awaited<ReturnType<typeof result.current.fetchNextPage>> | undefined;
    await act(async () => {
      nextPageResult = await result.current.fetchNextPage();
    });
    expect(api.list.mock.calls[1][1]).toMatchObject({ offset: 2 });
    expect(nextPageResult?.data?.pages.flatMap((current) => current.photos.map(({ id }) => id))).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(nextPageResult?.hasNextPage).toBe(false);
  });

  it('keys searches by normalized input and cancels stale requests', async () => {
    let firstSignal: AbortSignal | undefined;
    api.search.mockImplementationOnce(
      (_query: string, _filters: unknown, request: { signal: AbortSignal }) => {
        firstSignal = request.signal;
        return new Promise<PaginatedPhotosResponse>(() => undefined);
      },
    );
    api.search.mockResolvedValueOnce(page(['hawk'], 1, false));
    const { result, rerender } = renderHook(
      ({ query }) => useSearchPhotos({ query, sortField: 'random', randomSeed: 5 }),
      { initialProps: { query: ' owl ' }, wrapper: createWrapper() },
    );
    await waitFor(() => expect(api.search).toHaveBeenCalledTimes(1));
    rerender({ query: 'hawk' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(firstSignal?.aborted).toBe(true);
    expect(api.search.mock.calls[1][0]).toBe('hawk');
    expect(api.search.mock.calls[1][2]).toMatchObject({ randomSeed: 5 });
  });
});
