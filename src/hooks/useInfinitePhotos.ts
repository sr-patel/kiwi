import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { libraryService } from '@/services/libraryService';
import { PhotoMetadata, PaginatedPhotosResponse } from '@/types';
import { useAppStore } from '@/store';

type InfinitePhotosOptions = { field: string; direction: 'asc' | 'desc'; randomSeed?: number; enabled?: boolean };

export function useInfinitePhotos(folderId: string | null, sortOptions?: InfinitePhotosOptions) {
  const { requestPageSize } = useAppStore();
  return useInfiniteQuery<PaginatedPhotosResponse, Error>({
    queryKey: [
      'photos',
      folderId,
      sortOptions?.field || 'mtime',
      sortOptions?.direction || 'desc',
      sortOptions?.randomSeed || null,
      sortOptions?.enabled ?? true,
    ],
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }): Promise<PaginatedPhotosResponse> => {
      const limit = requestPageSize || 50;
      const offset = pageParam * limit;
      console.log('useInfinitePhotos: Loading photos', {
        folderId,
        limit,
        offset,
        field: sortOptions?.field || 'mtime',
        direction: sortOptions?.direction || 'desc',
        randomSeed: sortOptions?.randomSeed
      });
      const result = await libraryService.loadPaginatedPhotos(
        folderId, 
        limit, 
        offset, 
        sortOptions?.field || 'mtime',
        sortOptions?.direction || 'desc',
        sortOptions?.randomSeed
      );
      console.log('useInfinitePhotos: Received photos', {
        photosCount: result.photos.length,
        total: result.total,
        hasMore: result.hasMore
      });
      return result;
    },
    getNextPageParam: (lastPage: PaginatedPhotosResponse, allPages: PaginatedPhotosResponse[]) => {
      const totalLoaded = allPages.reduce((sum: number, page: PaginatedPhotosResponse) => sum + page.photos.length, 0);
      return totalLoaded < lastPage.total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: sortOptions?.enabled !== undefined ? sortOptions.enabled : true,
  });
}

export function useFolderCounts() {
  return useQuery({
    queryKey: ['folderCounts'],
    queryFn: async (): Promise<{ [folderId: string]: number }> => {
      return await libraryService.loadFolderCounts();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useRecursiveFolderCounts() {
  return useQuery({
    queryKey: ['recursiveFolderCounts'],
    queryFn: async (): Promise<{ [folderId: string]: number }> => {
      return await libraryService.loadRecursiveFolderCounts();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes,
  });
}

export function useTotalPhotoCount() {
  return useQuery({
    queryKey: ['totalPhotoCount'],
    queryFn: async (): Promise<number> => {
      return await libraryService.getTotalPhotoCount();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
} 