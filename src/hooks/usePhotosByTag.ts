import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type { PaginatedPhotosResponse } from '@/types';
import { useAppStore } from '@/store';
import { queryKeys } from '@/hooks/queryKeys';
import { photoApi } from '@/services/photoApi';

interface UsePhotosByTagOptions {
  tag: string | null;
  limit?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  randomSeed?: number;
  enabled?: boolean;
}

export function usePhotosByTag({
  tag,
  limit = 50,
  sortField = 'mtime',
  sortDirection = 'desc',
  randomSeed,
  enabled = true,
}: UsePhotosByTagOptions) {
  const requestPageSize = useAppStore((state) => state.requestPageSize);
  const pageSize = requestPageSize || limit;
  const query = useInfiniteQuery<
    PaginatedPhotosResponse,
    Error,
    InfiniteData<PaginatedPhotosResponse, number>,
    ReturnType<typeof queryKeys.tagPhotos>,
    number
  >({
    queryKey: queryKeys.tagPhotos(tag, sortField, sortDirection, randomSeed),
    initialPageParam: 0,
    enabled: enabled && Boolean(tag),
    queryFn: ({ pageParam, signal }) =>
      photoApi.byTag(tag!, {
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

  return { ...query, loading: query.isLoading, error: query.error?.message ?? null };
}
