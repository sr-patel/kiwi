import React, { Suspense, lazy } from 'react';
import { Database, RefreshCw, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import { useDashboardData } from './useDashboardData';
import { DashboardStatCards } from './DashboardStatCards';
import { DashboardFileTypes } from './DashboardFileTypes';
import { WelcomeBanner } from '@/components/WelcomeBanner/WelcomeBanner';

const DashboardCharts = lazy(() =>
  import('./DashboardCharts').then((module) => ({ default: module.DashboardCharts })),
);

export const DashboardPage: React.FC = () => {
  const { accentColor, theme } = useAppStore();
  const accentHex = getAccentHex(accentColor);
  const { stats, loading, refreshing, error, lastUpdated, refresh } = useDashboardData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: accentHex }} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-muted-foreground">
        <Database className="w-12 h-12 mb-4 opacity-50" />
        <p>Failed to load dashboard statistics.</p>
        <button
          onClick={() => refresh()}
          className="mt-4 px-4 py-2 rounded bg-muted hover:bg-muted dark:hover:bg-muted transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1800px] mx-auto space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Dashboard</h1>
          <p className="text-muted-foreground">
            Library statistics and analytics
            {lastUpdated && (
              <span className="ml-2 text-xs text-muted-foreground">
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted/60 dark:hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <button
            onClick={() => refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted/60 dark:hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <DashboardStatCards stats={stats} accentHex={accentHex} />

      <WelcomeBanner />

      <DashboardFileTypes stats={stats} />

      <Suspense
        fallback={
          <div className="h-72 animate-pulse rounded-xl bg-muted dark:bg-card" aria-label="Loading charts" />
        }
      >
        <DashboardCharts stats={stats} theme={theme} accentHex={accentHex} />
      </Suspense>
    </div>
  );
};

export default DashboardPage;
