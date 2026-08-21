import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { kiwiApi } from '@/services/kiwiApi';

export const useTags = () => {
  return useQuery({
    queryKey: queryKeys.tags(),
    queryFn: ({ signal }) => kiwiApi.tags.list(signal),
    staleTime: 30_000,
  });
};
