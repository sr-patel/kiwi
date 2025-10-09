import { useState, useEffect } from 'react';

export const useTagCounts = () => {
  const [data, setData] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTagCounts = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/tags/counts');
        if (!res.ok) {
          throw new Error(`Failed to fetch tag counts: ${res.statusText}`);
        }
        const tagCounts = await res.json();
        setData(tagCounts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tag counts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTagCounts();
  }, []);

  return { data, isLoading, error };
}; 