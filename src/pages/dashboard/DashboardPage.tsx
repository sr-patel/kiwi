import React from 'react';
import { Database, RefreshCw, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import { useDashboardData } from './useDashboardData';
import { DashboardStatCards } from './DashboardStatCards';
import { DashboardCharts } from './DashboardCharts';
import { DashboardFileTypes } from './DashboardFileTypes';
import { WelcomeBanner } from '@/components/WelcomeBanner/WelcomeBanner';

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
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-gray-500 dark:text-zinc-400">
        <Database className="w-12 h-12 mb-4 opacity-50" />
        <p>Failed to load dashboard statistics.</p>
        <button
          onClick={() => refresh()}
          className="mt-4 px-4 py-2 rounded bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100 mb-1">Dashboard</h1>
          <p className="text-gray-500 dark:text-zinc-400">
            Library statistics and analytics
            {lastUpdated && (
              <span className="ml-2 text-xs text-gray-400 dark:text-zinc-500">
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <button
            onClick={() => refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <DashboardStatCards stats={stats} accentHex={accentHex} />

      <WelcomeBanner />

      <DashboardFileTypes stats={stats} />

      <DashboardCharts stats={stats} theme={theme} accentHex={accentHex} />
    </div>
  );
};

export default DashboardPage;
