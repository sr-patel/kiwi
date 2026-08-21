import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/queryKeys';
import { photoApi } from '@/services/photoApi';
import type { PhotoMetadata } from '@/types';

interface UseFastSearchOptions {
  query: string;
  type?: string | null;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  enabled?: boolean;
  folderId?: string | null;
  tag?: string | null;
  randomSeed?: number;
}

interface SearchResult {
  photos: PhotoMetadata[];
  totalCount: number;
  hasNextPage: boolean;
  isLoading: boolean;
  error: Error | null;
}

export const useFastSearch = ({
  query,
  type = null,
  limit = 50,
  offset = 0,
  orderBy = 'mtime',
  orderDirection = 'DESC',
  enabled = true,
  folderId = null,
  tag = null,
  randomSeed,
}: UseFastSearchOptions): SearchResult => {
  const trimmedQuery = query.trim();
  const result = useQuery({
    queryKey: [
      ...queryKeys.search(trimmedQuery, type, folderId, tag, orderBy, orderDirection, randomSeed),
      limit,
      offset,
    ],
    enabled: enabled && trimmedQuery.length > 0,
    queryFn: ({ signal }) =>
      photoApi.search(
        trimmedQuery,
        { type, folderId, tag },
        {
          limit,
          offset,
          orderBy,
          orderDirection,
          randomSeed,
          signal,
        },
      ),
    staleTime: 2 * 60_000,
  });

  return {
    photos: result.data?.photos ?? [],
    totalCount: result.data?.total ?? 0,
    hasNextPage: result.data?.hasMore ?? false,
    isLoading: result.isLoading,
    error: result.error,
  };
};
