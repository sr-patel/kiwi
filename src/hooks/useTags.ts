import { useQuery } from '@tanstack/react-query';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';

async function fetchTags(): Promise<string[]> {
  const res = await fetchWithRetry('/api/tags');
  if (!res.ok) {
    throw new Error(`Failed to fetch tags: ${res.statusText}`);
  }
  return res.json();
}

export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: fetchTags,
    staleTime: 30_000,
  });
};
