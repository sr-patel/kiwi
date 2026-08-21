import React from 'react';
import { FileText, Image, Music, Video } from 'lucide-react';
import type { DashboardStats } from './types';

function getFileTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'image':
      return Image;
    case 'video':
      return Video;
    case 'audio':
      return Music;
    default:
      return FileText;
  }
}

interface DashboardFileTypesProps {
  stats: DashboardStats;
}

export function DashboardFileTypes({ stats }: DashboardFileTypesProps) {
  const fileTypes = stats.fileTypes ? Object.entries(stats.fileTypes).sort((a, b) => b[1] - a[1]) : [];

  if (fileTypes.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Indexed file types</h3>
      <p className="mb-4 mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
        Breakdown by media category in the database
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {fileTypes.map(([type, count]) => {
          const Icon = getFileTypeIcon(type);
          const pct = stats.totalPhotos > 0 ? ((count / stats.totalPhotos) * 100).toFixed(1) : '0';
          return (
            <div
              key={type}
              className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-zinc-800/50"
            >
              <Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium capitalize text-gray-900 dark:text-zinc-100">
                  {type}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">{count.toLocaleString()} files</p>
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-gray-500 dark:text-zinc-400">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
