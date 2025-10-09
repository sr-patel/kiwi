import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PhotoMetadata } from '@/types';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';

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
}

interface SearchResult {
  photos: PhotoMetadata[];
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
}

export const useFastSearch = (options: UseFastSearchOptions): SearchResult => {
  const { query, type, limit = 50, offset = 0, orderBy = 'mtime', orderDirection = 'DESC', enabled = true, folderId = null, tag = null } = options;

  // Search photos query
  const searchQuery = useQuery({
    queryKey: ['search', query, type, limit, offset, orderBy, orderDirection, folderId, tag],
    queryFn: async (): Promise<PhotoMetadata[]> => {
      if (!query.trim()) {
        return [];
      }

      const params = new URLSearchParams({
        q: query.trim(),
        limit: limit.toString(),
        offset: offset.toString(),
        orderBy,
        orderDirection
      });

      if (type) {
        params.append('type', type);
      }
      if (folderId) {
        params.append('folderId', folderId);
      }
      if (tag) {
        params.append('tag', tag);
      }

      const response = await fetchWithRetry(`/api/search/photos?${params}`);
      if (!response.ok) {
        throw new Error('Failed to search photos');
      }

      const results = await response.json();
      return results;
    },
    enabled: enabled && query.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get total count query
  const countQuery = useQuery({
    queryKey: ['searchCount', query, type, folderId, tag],
    queryFn: async (): Promise<number> => {
      if (!query.trim()) {
        return 0;
      }

      const params = new URLSearchParams({
        q: query.trim()
      });

      if (type) {
        params.append('type', type);
      }
      if (folderId) {
        params.append('folderId', folderId);
      }
      if (tag) {
        params.append('tag', tag);
      }

      const response = await fetchWithRetry(`/api/search/count?${params}`);
      if (!response.ok) {
        throw new Error('Failed to get search count');
      }

      const data = await response.json();
      return data.count;
    },
    enabled: enabled && query.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    photos: searchQuery.data || [],
    totalCount: countQuery.data || 0,
    isLoading: searchQuery.isLoading || countQuery.isLoading,
    error: searchQuery.error || countQuery.error
  };
}; 