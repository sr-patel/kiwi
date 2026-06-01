import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store';
import { PhotoMetadata } from '@/types';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';

interface PhotosByTagsResponse {
  photos: PhotoMetadata[];
  total: number;
  hasMore: boolean;
  totalSize: number;
}

interface UsePhotosByTagsOptions {
  tags: string[];
  limit?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  enabled?: boolean;
}

export function usePhotosByTags({
  tags,
  limit = 50,
  sortField = 'mtime',
  sortDirection = 'desc',
  enabled = true,
}: UsePhotosByTagsOptions) {
  const { requestPageSize } = useAppStore();
  const [pages, setPages] = useState<PhotosByTagsResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const lastFetchAtRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);

  const tagsKey = tags.slice().sort().join(',');

  const fetchPhotos = async (offset: number = 0, append: boolean = false) => {
    if (tags.length < 2 || !enabled) {
      setPages([]);
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (cooldownUntilRef.current && now < cooldownUntilRef.current) {
      return;
    }
    if (now - lastFetchAtRef.current < 500) {
      return;
    }
    lastFetchAtRef.current = now;

    try {
      if (offset === 0) {
        setLoading(true);
      } else {
        setIsFetchingNextPage(true);
      }

      const params = new URLSearchParams({
        tags: tags.join(','),
        limit: String(requestPageSize || limit),
        offset: offset.toString(),
        orderBy: sortField,
        orderDirection: sortDirection,
      });

      const response = await fetchWithRetry(`/api/tags/photos?${params}`);
      if (!response.ok) {
        if (response.status === 429) {
          cooldownUntilRef.current = Date.now() + 2000;
        }
        throw new Error(`Failed to fetch photos by tags: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (append) {
        setPages((prev) => {
          const nextPages = [...prev, data];
          const seen = new Set<string>();
          for (const page of nextPages) {
            page.photos = page.photos.filter((p) => {
              if (seen.has(p.id)) return false;
              seen.add(p.id);
              return true;
            });
          }
          return nextPages;
        });
      } else {
        setPages([data]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch photos by tags');
    } finally {
      setLoading(false);
      setIsFetchingNextPage(false);
    }
  };

  useEffect(() => {
    setError(null);
    fetchPhotos(0, false);
  }, [tagsKey, sortField, sortDirection, enabled]);

  const fetchNextPage = () => {
    if (pages.length > 0) {
      const lastPage = pages[pages.length - 1];
      const currentOffset = pages.length * (requestPageSize || limit);

      if (lastPage.hasMore && !isFetchingNextPage) {
        fetchPhotos(currentOffset, true);
      }
    }
  };

  const hasNextPage = pages.length > 0 && pages[pages.length - 1].hasMore;
  const total = pages.length > 0 ? pages[0].total : 0;

  return {
    data: { pages },
    total,
    loading,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  };
}
