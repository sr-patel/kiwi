import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardStats, SyncStatus } from './types';

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const processedCountRef = useRef<number | null>(null);

  const fetchStats = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/database/stats');
      if (!res.ok) throw new Error('Failed to fetch statistics');
      const data: DashboardStats = await res.json();
      setStats(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (isManual) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/status');
      if (!res.ok) return;
      const data: SyncStatus = await res.json();
      setSyncStatus(data);

      const prev = processedCountRef.current;
      if (prev !== null && data.processedCount > prev) {
        await fetchStats();
      }
      processedCountRef.current = data.processedCount;
    } catch {
      // non-critical
    }
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
    fetchSyncStatus();
  }, [fetchStats, fetchSyncStatus]);

  useEffect(() => {
    const syncInterval = setInterval(fetchSyncStatus, 5000);
    const statsInterval = setInterval(() => fetchStats(), 30000);
    return () => {
      clearInterval(syncInterval);
      clearInterval(statsInterval);
    };
  }, [fetchStats, fetchSyncStatus]);

  const refresh = useCallback(() => {
    fetchStats(true);
    fetchSyncStatus();
  }, [fetchStats, fetchSyncStatus]);

  return {
    stats,
    syncStatus,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  };
}
