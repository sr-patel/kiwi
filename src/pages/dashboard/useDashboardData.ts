import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/queryKeys';
import { toUserMessage } from '@/services/apiClient';
import { kiwiApi } from '@/services/kiwiApi';

export function useDashboardData() {
  const queryClient = useQueryClient();
  const processedCountRef = useRef<number | null>(null);
  const statsQuery = useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: ({ signal }) => kiwiApi.system.stats(signal),
    refetchInterval: 30_000,
  });
  const syncQuery = useQuery({
    queryKey: queryKeys.sync(),
    queryFn: ({ signal }) => kiwiApi.system.syncStatus(signal),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    const processedCount = syncQuery.data?.processedCount;
    if (processedCount === undefined) return;
    const previous = processedCountRef.current;
    processedCountRef.current = processedCount;
    if (previous !== null && processedCount > previous) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    }
  }, [queryClient, syncQuery.data?.processedCount]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sync() });
  };

  return {
    stats: statsQuery.data ?? null,
    syncStatus: syncQuery.data ?? null,
    loading: statsQuery.isLoading,
    refreshing: statsQuery.isFetching && !statsQuery.isLoading,
    error: statsQuery.error ? toUserMessage(statsQuery.error, 'Could not load dashboard statistics.') : null,
    lastUpdated: statsQuery.dataUpdatedAt ? new Date(statsQuery.dataUpdatedAt) : null,
    refresh,
  };
}
