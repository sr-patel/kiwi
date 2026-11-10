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
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border dark:bg-card">
      <h3 className="text-base font-semibold text-foreground">Indexed file types</h3>
      <p className="mb-4 mt-0.5 text-xs text-muted-foreground">Breakdown by media category in the database</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {fileTypes.map(([type, count]) => {
          const Icon = getFileTypeIcon(type);
          const pct = stats.totalPhotos > 0 ? ((count / stats.totalPhotos) * 100).toFixed(1) : '0';
          return (
            <div
              key={type}
              className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/50"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium capitalize text-foreground">{type}</p>
                <p className="text-xs text-muted-foreground">{count.toLocaleString()} files</p>
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
