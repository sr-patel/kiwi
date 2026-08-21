import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { kiwiApi } from '@/services/kiwiApi';

export const useTagCounts = () => {
  return useQuery({
    queryKey: queryKeys.tagCounts(),
    queryFn: ({ signal }) => kiwiApi.tags.counts(signal),
    staleTime: 30_000,
  });
};
