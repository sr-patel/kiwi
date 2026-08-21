import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type { PaginatedPhotosResponse } from '@/types';
import { useAppStore } from '@/store';
import { queryKeys } from '@/hooks/queryKeys';
import { photoApi } from '@/services/photoApi';

interface UsePhotosByTagsOptions {
  tags: string[];
  limit?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  randomSeed?: number;
  enabled?: boolean;
}

export function usePhotosByTags({
  tags,
  limit = 50,
  sortField = 'mtime',
  sortDirection = 'desc',
  randomSeed,
  enabled = true,
}: UsePhotosByTagsOptions) {
  const requestPageSize = useAppStore((state) => state.requestPageSize);
  const pageSize = requestPageSize || limit;
  const stableTags = [...tags].sort();
  const query = useInfiniteQuery<
    PaginatedPhotosResponse,
    Error,
    InfiniteData<PaginatedPhotosResponse, number>,
    ReturnType<typeof queryKeys.multiTagPhotos>,
    number
  >({
    queryKey: queryKeys.multiTagPhotos(stableTags, sortField, sortDirection, randomSeed),
    initialPageParam: 0,
    enabled: enabled && stableTags.length >= 2,
    queryFn: ({ pageParam, signal }) =>
      photoApi.byTags(stableTags, {
        limit: pageSize,
        offset: pageParam,
        orderBy: sortField,
        orderDirection: sortDirection,
        randomSeed,
        signal,
      }),
    getNextPageParam: (page, pages) =>
      page.hasMore ? pages.reduce((count, current) => count + current.photos.length, 0) : undefined,
    staleTime: 5 * 60_000,
  });

  return {
    ...query,
    total: query.data?.pages[0]?.total ?? 0,
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
