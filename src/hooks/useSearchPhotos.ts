import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type { PaginatedPhotosResponse } from '@/types';
import { useAppStore } from '@/store';
import { queryKeys } from '@/hooks/queryKeys';
import { photoApi } from '@/services/photoApi';

interface UseSearchPhotosOptions {
  query: string;
  type?: string | null;
  limit?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  folderId?: string | null;
  tag?: string | null;
  enabled?: boolean;
  randomSeed?: number;
}

export function useSearchPhotos({
  query,
  type = null,
  limit = 50,
  sortField = 'mtime',
  sortDirection = 'desc',
  folderId = null,
  tag = null,
  enabled = true,
  randomSeed,
}: UseSearchPhotosOptions) {
  const requestPageSize = useAppStore((state) => state.requestPageSize);
  const pageSize = requestPageSize || limit;
  const trimmedQuery = query.trim();
  const result = useInfiniteQuery<
    PaginatedPhotosResponse,
    Error,
    InfiniteData<PaginatedPhotosResponse, number>,
    ReturnType<typeof queryKeys.search>,
    number
  >({
    queryKey: queryKeys.search(trimmedQuery, type, folderId, tag, sortField, sortDirection, randomSeed),
    initialPageParam: 0,
    enabled: enabled && trimmedQuery.length > 0,
    queryFn: ({ pageParam, signal }) =>
      photoApi.search(
        trimmedQuery,
        { type, folderId, tag },
        {
          limit: pageSize,
          offset: pageParam,
          orderBy: sortField,
          orderDirection: sortDirection,
          randomSeed,
          signal,
        },
      ),
    getNextPageParam: (page, pages) =>
      page.hasMore ? pages.reduce((count, current) => count + current.photos.length, 0) : undefined,
    staleTime: 2 * 60_000,
  });

  return { ...result, loading: result.isLoading, error: result.error?.message ?? null };
}
