import { useQuery } from '@tanstack/react-query';
import { libraryService } from '@/services/libraryService';
import { PhotoMetadata } from '@/types';

export function useAllPhotos(
  folderId: string | null, 
  sortOptions?: { field: string; direction: 'asc' | 'desc'; randomSeed?: number }
) {
  return useQuery<PhotoMetadata[], Error>({
    queryKey: ['all-photos', folderId, sortOptions],
    queryFn: async (): Promise<PhotoMetadata[]> => {
      // For random sort, we need to load all photos at once to maintain consistent order
      if (sortOptions?.field === 'random') {
        // Load all photos in one request with a large limit
        const result = await libraryService.loadPaginatedPhotos(
          folderId,
          10000, // Large limit to get all photos
          0,
          sortOptions.field,
          sortOptions.direction,
          sortOptions.randomSeed
        );
        return result.photos;
      }
      
      // For non-random sorts, return empty array (use regular pagination)
      return [];
    },
    enabled: sortOptions?.field === 'random', // Only enable for random sort
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}