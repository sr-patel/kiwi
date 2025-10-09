import { useState, useEffect } from 'react';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';

export const useTags = () => {
  const [data, setData] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setIsLoading(true);
        const res = await fetchWithRetry('/api/tags');
        if (!res.ok) {
          throw new Error(`Failed to fetch tags: ${res.statusText}`);
        }
        const tags = await res.json();
        setData(tags);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tags');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, []);

  return { data, isLoading, error };
}; 