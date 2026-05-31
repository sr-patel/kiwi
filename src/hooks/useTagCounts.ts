import { useQuery } from '@tanstack/react-query';

async function fetchTagCounts(): Promise<Record<string, number>> {
  const res = await fetch('/api/tags/counts');
  if (!res.ok) {
    throw new Error(`Failed to fetch tag counts: ${res.statusText}`);
  }
  return res.json();
}

export const useTagCounts = () => {
  return useQuery({
    queryKey: ['tagCounts'],
    queryFn: fetchTagCounts,
    staleTime: 30_000,
  });
};
