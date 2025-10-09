import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store';
import { PhotoMetadata } from '@/types';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';

interface SearchPhotosResponse {
  photos: PhotoMetadata[];
  total: number;
  hasMore: boolean;
  totalSize: number;
}

interface UseSearchPhotosOptions {
  query: string;
  type?: string | null;
  limit?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  folderId?: string | null;
  tag?: string | null;
  enabled?: boolean;
}

export function useSearchPhotos({
  query,
  type = null,
  limit = 50,
  sortField = 'mtime',
  sortDirection = 'desc',
  folderId = null,
  tag = null,
  enabled = true
}: UseSearchPhotosOptions) {
  const { requestPageSize } = useAppStore();
  const [pages, setPages] = useState<SearchPhotosResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const lastFetchAtRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);

  const fetchPhotos = async (offset: number = 0, append: boolean = false) => {
    if (!query.trim() || !enabled) {
      setPages([]);
      setLoading(false);
      return;
    }

    const now = Date.now();
    // Global cooldown after server throttling
    if (cooldownUntilRef.current && now < cooldownUntilRef.current) {
      return;
    }
    // Throttle rapid repeated requests
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
        q: query.trim(),
        limit: String(requestPageSize || limit),
        offset: offset.toString(),
        orderBy: sortField,
        orderDirection: sortDirection
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
        // Apply short cooldown on 429 Too Many Requests
        if (response.status === 429) {
          cooldownUntilRef.current = Date.now() + 2000;
        }
        throw new Error(`Failed to search photos: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Get the actual total count from the search count API (only on first page)
      let totalCount = data.length; // Default fallback
      if (offset === 0) {
        try {
          const countParams = new URLSearchParams({
            q: query.trim()
          });
          if (type) countParams.append('type', type);
          if (folderId) countParams.append('folderId', folderId);
          if (tag) countParams.append('tag', tag);
          
          const countResponse = await fetchWithRetry(`/api/search/count?${countParams}`);
          if (countResponse.ok) {
            const countData = await countResponse.json();
            totalCount = countData.count || data.length;
          }
        } catch (countError) {
          console.warn('Failed to get search count, using fallback:', countError);
        }
      } else {
        // For subsequent pages, use the total from the first page
        totalCount = pages.length > 0 ? pages[0].total : data.length;
      }
      
      // Get total size for search results (only on first page)
      let totalSize = 0;
      if (offset === 0) {
        try {
          const sizeParams = new URLSearchParams({
            q: query.trim()
          });
          if (type) sizeParams.append('type', type);
          if (folderId) sizeParams.append('folderId', folderId);
          if (tag) sizeParams.append('tag', tag);
          
          const sizeResponse = await fetchWithRetry(`/api/search/size?${sizeParams}`);
          if (sizeResponse.ok) {
            const sizeData = await sizeResponse.json();
            totalSize = sizeData.totalSize || 0;
          }
        } catch (sizeError) {
          console.warn('Failed to get search total size, using fallback:', sizeError);
        }
      } else {
        // For subsequent pages, use the total size from the first page
        totalSize = pages.length > 0 ? pages[0].totalSize : 0;
      }
      
      console.log('useSearchPhotos API response:', {
        query,
        offset,
        photosCount: data.length,
        totalCount,
        totalSize,
        limit
      });
      
      // Create a response object similar to other pagination hooks
      const responseObj = {
        photos: data,
        total: totalCount, // Use the actual total count
        hasMore: data.length > 0 && data.length === (requestPageSize || limit) && offset + data.length < totalCount, // Check against actual total
        totalSize: totalSize // Use the actual total size
      };
      
      if (append) {
        setPages(prev => {
          const nextPages = [...prev, responseObj];
          // Remove duplicates
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
        setPages([responseObj]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search photos');
    } finally {
      setLoading(false);
      setIsFetchingNextPage(false);
    }
  };

  useEffect(() => {
    fetchPhotos(0, false);
  }, [query, type, sortField, sortDirection, folderId, tag, enabled]);

  const fetchNextPage = () => {
    console.log('useSearchPhotos fetchNextPage called:', { 
      pagesLength: pages.length, 
      hasNextPage, 
      isFetchingNextPage,
      lastPageHasMore: pages.length > 0 ? pages[pages.length - 1].hasMore : false
    });
    
    if (pages.length > 0) {
      const lastPage = pages[pages.length - 1];
      // Calculate offset as the number of photos to skip
      const currentOffset = pages.length * (requestPageSize || limit);
      
      if (lastPage.hasMore && !isFetchingNextPage) {
        console.log('useSearchPhotos: Fetching next page with offset:', currentOffset);
        fetchPhotos(currentOffset, true);
      } else {
        console.log('useSearchPhotos: Not fetching next page:', { 
          lastPageHasMore: lastPage.hasMore, 
          isFetchingNextPage 
        });
      }
    }
  };

  // Calculate total photos from all pages
  const totalPhotos = pages.reduce((total, page) => total + page.photos.length, 0);
  const hasNextPage = pages.length > 0 && pages[pages.length - 1].hasMore;

  // Return data in the same format as other pagination hooks
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