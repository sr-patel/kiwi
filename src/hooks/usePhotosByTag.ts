import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store';
import { PhotoMetadata } from '@/types';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';

interface PhotosByTagResponse {
  photos: PhotoMetadata[];
  total: number;
  hasMore: boolean;
  totalSize: number;
}

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
  enabled = true
}: UsePhotosByTagOptions) {
  const { requestPageSize } = useAppStore();
  const [pages, setPages] = useState<PhotosByTagResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const lastFetchAtRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);

  const fetchPhotos = async (offset: number = 0, append: boolean = false) => {
    if (!tag || !enabled) {
      setPages([]);
      setLoading(false);
      return;
    }

    const now = Date.now();
    // Global cooldown after server throttling
    if (cooldownUntilRef.current && now < cooldownUntilRef.current) {
      return;
    }
    // Throttle rapid repeated requests (sentinel + autofill)
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
        limit: String(requestPageSize || limit),
        offset: offset.toString(),
        orderBy: sortField,
        orderDirection: sortDirection
      });
      if (randomSeed) {
        params.append('randomSeed', String(randomSeed));
      }

      const response = await fetchWithRetry(`/api/tags/${encodeURIComponent(tag)}/photos?${params}`);
      if (!response.ok) {
        // Apply short cooldown on 429 Too Many Requests
        if (response.status === 429) {
          cooldownUntilRef.current = Date.now() + 2000;
        }
        throw new Error(`Failed to fetch photos by tag: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('usePhotosByTag API response:', {
        tag,
        offset,
        photosCount: data.photos.length,
        total: data.total,
        hasMore: data.hasMore,
        totalSize: data.totalSize,
        limit
      });
      
      if (append) {
        setPages(prev => {
          const nextPages = [...prev, data];
          // If server total decreased (filters/tags changed), clamp duplicates logically
          const seen = new Set<string>();
          for (const page of nextPages) {
            page.photos = page.photos.filter(p => {
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
      setError(err instanceof Error ? err.message : 'Failed to fetch photos by tag');
    } finally {
      setLoading(false);
      setIsFetchingNextPage(false);
    }
  };

  useEffect(() => {
    fetchPhotos(0, false);
  }, [tag, sortField, sortDirection, randomSeed, enabled]);

  const fetchNextPage = () => {
    console.log('usePhotosByTag fetchNextPage called:', { 
      pagesLength: pages.length, 
      hasNextPage, 
      isFetchingNextPage,
      lastPageHasMore: pages.length > 0 ? pages[pages.length - 1].hasMore : false
    });
    
    if (pages.length > 0) {
      const lastPage = pages[pages.length - 1];
      // Calculate offset as the number of photos to skip (not total loaded)
      const currentOffset = pages.length * (requestPageSize || limit);
      
      if (lastPage.hasMore && !isFetchingNextPage) {
        console.log('usePhotosByTag: Fetching next page with offset:', currentOffset);
        fetchPhotos(currentOffset, true);
      } else {
        console.log('usePhotosByTag: Not fetching next page:', { 
          lastPageHasMore: lastPage.hasMore, 
          isFetchingNextPage 
        });
      }
    }
  };

  // Calculate total photos from all pages
  const totalPhotos = pages.reduce((total, page) => total + page.photos.length, 0);
  const hasNextPage = pages.length > 0 && pages[pages.length - 1].hasMore;

  // Return data in the same format as useInfinitePhotos
  return { 
    data: {
      pages: pages
    },
    loading, 
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage
  };
} 