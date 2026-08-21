import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import type { PaginatedPhotosResponse } from '@/types';
import { useAppStore } from '@/store';
import { queryKeys } from '@/hooks/queryKeys';
import { photoApi } from '@/services/photoApi';
import { libraryService } from '@/services/libraryService';

type InfinitePhotosOptions = {
  field: string;
  direction: 'asc' | 'desc';
  randomSeed?: number;
  enabled?: boolean;
};

export function useInfinitePhotos(folderId: string | null, sortOptions?: InfinitePhotosOptions) {
  const requestPageSize = useAppStore((state) => state.requestPageSize);
  const sortField = sortOptions?.field ?? 'mtime';
  const direction = sortOptions?.direction ?? 'desc';
  return useInfiniteQuery<
    PaginatedPhotosResponse,
    Error,
    InfiniteData<PaginatedPhotosResponse, number>,
    ReturnType<typeof queryKeys.photoPage>,
    number
  >({
    queryKey: queryKeys.photoPage(folderId, sortField, direction, sortOptions?.randomSeed),
    initialPageParam: 0,
    enabled: sortOptions?.enabled ?? true,
    queryFn: ({ pageParam, signal }) =>
      photoApi.list(folderId, {
        limit: requestPageSize || 50,
        offset: pageParam,
        orderBy: sortField,
        orderDirection: direction,
        randomSeed: sortOptions?.randomSeed,
        signal,
      }),
    getNextPageParam: (page, pages) =>
      page.hasMore ? pages.reduce((count, current) => count + current.photos.length, 0) : undefined,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useFolderCounts() {
  return useQuery({
    queryKey: queryKeys.folderCounts(),
    queryFn: () => libraryService.loadFolderCounts(),
    staleTime: 10 * 60_000,
  });
}

export function useRecursiveFolderCounts() {
  return useQuery({
    queryKey: queryKeys.folderCounts(true),
    queryFn: () => libraryService.loadRecursiveFolderCounts(),
    staleTime: 10 * 60_000,
  });
}

export function useTotalPhotoCount() {
  return useQuery({
    queryKey: [...queryKeys.photos(), 'count'],
    queryFn: () => libraryService.getTotalPhotoCount(),
    staleTime: 10 * 60_000,
  });
}
