import { useState, useEffect } from 'react';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';

interface FolderThumbnailData {
  id: string;
  name: string;
  ext: string;
}

export function useFolderThumbnail(folderId: string, enabled: boolean) {
  const [thumbnail, setThumbnail] = useState<FolderThumbnailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !folderId) {
      setThumbnail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchThumbnail = async () => {
      try {
        const response = await fetchWithRetry(`/api/folders/${folderId}/thumbnail`);
        
        if (!response.ok) {
          if (response.status === 404) {
            // No images in folder - this is normal, not an error
            if (!cancelled) {
              setThumbnail(null);
              setError(null);
            }
            return;
          }
          throw new Error(`Failed to fetch folder thumbnail: ${response.statusText}`);
        }

        const data = await response.json();
        if (!cancelled) {
          setThumbnail(data);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn('Failed to fetch folder thumbnail:', err.message);
          setThumbnail(null);
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchThumbnail();

    return () => {
      cancelled = true;
    };
  }, [folderId, enabled]);

  return { thumbnail, loading, error };
}