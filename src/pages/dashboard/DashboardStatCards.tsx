import React from 'react';
import { HardDrive, Image, Folder, Tag, Database, Clock } from 'lucide-react';
import { formatBytes } from '@/utils/formatBytes';
import type { DashboardStats } from './types';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  accentHex: string;
}

function StatCard({ icon: Icon, label, value, subtext, accentHex }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-zinc-400 mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{value}</h3>
        {subtext && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{subtext}</p>}
      </div>
      <div className="p-3 rounded-lg" style={{ backgroundColor: `${accentHex}20` }}>
        <Icon className="w-5 h-5" style={{ color: accentHex }} />
      </div>
    </div>
  );
}

interface DashboardStatCardsProps {
  stats: DashboardStats;
  accentHex: string;
}

export function DashboardStatCards({ stats, accentHex }: DashboardStatCardsProps) {
  const summary = stats.analytics?.summary;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        icon={Image}
        label="Total Items"
        value={stats.totalPhotos.toLocaleString()}
        subtext={summary ? `${summary.imageCount.toLocaleString()} images` : undefined}
        accentHex={accentHex}
      />
      <StatCard
        icon={HardDrive}
        label="Library Storage"
        value={formatBytes(stats.totalSize)}
        subtext={summary ? `Avg ${formatBytes(summary.avgFileSize)} per file` : undefined}
        accentHex={accentHex}
      />
      <StatCard
        icon={Folder}
        label="Folders"
        value={stats.totalFolders.toLocaleString()}
        accentHex={accentHex}
      />
      <StatCard
        icon={Tag}
        label="Tags"
        value={stats.totalTags.toLocaleString()}
        subtext={summary ? `${summary.taggedPhotos.toLocaleString()} tagged items` : undefined}
        accentHex={accentHex}
      />
      <StatCard
        icon={Database}
        label="Database Size"
        value={formatBytes(stats.dbSize)}
        accentHex={accentHex}
      />
      <StatCard
        icon={Clock}
        label="Last Refresh"
        value={stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleDateString() : 'Never'}
        subtext={stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleTimeString() : undefined}
        accentHex={accentHex}
      />
    </div>
  );
}
