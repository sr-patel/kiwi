import { useQuery } from '@tanstack/react-query';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';
import { PhotoMetadata } from '@/types';

interface UseAllPhotosByTagOptions {
  tag: string | null;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  randomSeed?: number;
  enabled?: boolean;
}

export function useAllPhotosByTag({
  tag,
  sortField = 'mtime',
  sortDirection = 'desc',
  randomSeed,
  enabled = true
}: UseAllPhotosByTagOptions) {
  return useQuery<PhotoMetadata[], Error>({
    queryKey: ['all-photos-by-tag', tag, sortField, sortDirection, randomSeed],
    queryFn: async (): Promise<PhotoMetadata[]> => {
      if (!tag || !enabled) return [];

      // For random sort, we need to load all photos at once to maintain consistent order
      if (sortField === 'random') {
        const params = new URLSearchParams({
          limit: '10000', // Large limit to get all photos
          offset: '0',
          sortField,
          sortDirection,
          tag
        });
        
        if (randomSeed) {
          params.append('randomSeed', randomSeed.toString());
        }

        const response = await fetchWithRetry(`/api/tags/${encodeURIComponent(tag)}/photos?${params}`);
        if (!response.ok) throw new Error('Failed to load photos by tag');
        const data = await response.json();
        return data.photos || [];
      }
      
      // For non-random sorts, return empty array (use regular pagination)
      return [];
    },
    enabled: enabled && !!tag && sortField === 'random', // Only enable for random sort
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}