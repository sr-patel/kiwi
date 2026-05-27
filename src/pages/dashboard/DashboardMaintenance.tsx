import React, { useState } from 'react';
import axios from 'axios';
import { RefreshCw, FileText, Image, Video, Music, AlertTriangle } from 'lucide-react';
import type { DashboardStats } from './types';

function getFileTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'image': return Image;
    case 'video': return Video;
    case 'audio': return Music;
    default: return FileText;
  }
}

interface DashboardMaintenanceProps {
  stats: DashboardStats;
  onRebuildComplete: () => void;
}

export function DashboardMaintenance({ stats, onRebuildComplete }: DashboardMaintenanceProps) {
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);

  const handleFullRebuild = async () => {
    if (!window.confirm('Rebuild the entire database from library files? This may take a while.')) return;
    setIsRebuilding(true);
    setRebuildError(null);
    try {
      await axios.post('/api/database/refresh', { source: 'library' });
      onRebuildComplete();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to rebuild database';
      setRebuildError(message);
    } finally {
      setIsRebuilding(false);
    }
  };

  const fileTypes = stats.fileTypes ? Object.entries(stats.fileTypes).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {fileTypes.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-1">File Types</h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">Breakdown by media type</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fileTypes.map(([type, count]) => {
              const Icon = getFileTypeIcon(type);
              const pct = stats.totalPhotos > 0 ? ((count / stats.totalPhotos) * 100).toFixed(1) : '0';
              return (
                <div
                  key={type}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800/50"
                >
                  <Icon className="w-4 h-4 text-gray-500 dark:text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 capitalize truncate">{type}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">{count.toLocaleString()} files</p>
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-1">Database Maintenance</h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
          The file watcher keeps the index in sync automatically. Use a full rebuild only if the index is corrupt or out of date.
        </p>
        {rebuildError && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-3 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {rebuildError}
          </p>
        )}
        <button
          onClick={handleFullRebuild}
          disabled={isRebuilding}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${isRebuilding ? 'animate-spin' : ''}`} />
          {isRebuilding ? 'Rebuilding…' : 'Run Full Rebuild'}
        </button>
      </div>
    </div>
  );
}
