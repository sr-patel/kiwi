import React from 'react';
import type { SyncStatus } from './types';

const TYPE_LABELS: Record<string, string> = {
  photo_added: 'Added',
  photo_updated: 'Updated',
  photo_removed: 'Removed',
  folder_detected: 'Folder',
  library_updated: 'Library',
  reconcile: 'Sync',
  watcher_started: 'Start',
  watcher_stopped: 'Stop',
  error: 'Error',
};

function formatActivityTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTypeBadgeStyle(type: string) {
  switch (type) {
    case 'photo_added':
      return 'bg-green-500/15 text-green-700 dark:text-green-400';
    case 'photo_removed':
    case 'error':
      return 'bg-red-500/15 text-red-700 dark:text-red-400';
    case 'library_updated':
    case 'folder_detected':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
    default:
      return 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400';
  }
}

function getRowAccent(type: string) {
  switch (type) {
    case 'photo_added':
      return 'border-l-green-500';
    case 'photo_removed':
    case 'error':
      return 'border-l-red-500';
    case 'library_updated':
    case 'folder_detected':
      return 'border-l-blue-500';
    default:
      return 'border-l-zinc-400 dark:border-l-zinc-600';
  }
}

interface WatcherActivityPanelProps {
  syncStatus: SyncStatus | null;
  className?: string;
}

export function WatcherActivityPanel({ syncStatus, className = '' }: WatcherActivityPanelProps) {
  const entries = syncStatus?.activityLog?.length
    ? [...syncStatus.activityLog].reverse()
    : [];

  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col h-full ${className}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800 shrink-0">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">File Watcher</h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">Live sync activity</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs shrink-0 ml-3">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              syncStatus?.running ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'
            }`}
          />
          <span className="text-gray-600 dark:text-zinc-300 font-medium">
            {syncStatus?.running ? 'Active' : 'Stopped'}
          </span>
        </div>
      </div>

      {syncStatus && (
        <div className="flex border-b border-gray-200 dark:border-zinc-800 shrink-0 divide-x divide-gray-200 dark:divide-zinc-800">
          <div className="flex-1 px-4 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">Processed</p>
            <p className="text-base font-semibold text-gray-900 dark:text-zinc-100 tabular-nums leading-tight">
              {syncStatus.processedCount.toLocaleString()}
            </p>
          </div>
          <div className="flex-1 px-4 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">Pending</p>
            <p className="text-base font-semibold text-gray-900 dark:text-zinc-100 tabular-nums leading-tight">
              {syncStatus.pendingCount.toLocaleString()}
            </p>
          </div>
          {syncStatus.lastEventTime && (
            <div className="flex-1 px-4 py-2 min-w-0 hidden sm:block">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">Last event</p>
              <p className="text-xs font-medium text-gray-700 dark:text-zinc-300 tabular-nums truncate leading-tight mt-0.5">
                {formatActivityTime(syncStatus.lastEventTime)}
              </p>
            </div>
          )}
          {syncStatus.lastReconcileTime && (
            <div className="flex-1 px-4 py-2 min-w-0 hidden md:block">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">Last reconcile</p>
              <p className="text-xs font-medium text-gray-700 dark:text-zinc-300 tabular-nums truncate leading-tight mt-0.5">
                {formatActivityTime(syncStatus.lastReconcileTime)}
              </p>
            </div>
          )}
        </div>
      )}

      {syncStatus?.lastEvent && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-zinc-800 shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500 mb-0.5">Latest</p>
          <p className="text-xs text-gray-600 dark:text-zinc-400 truncate" title={syncStatus.lastEvent}>
            {syncStatus.lastEvent}
          </p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-gray-400 dark:text-zinc-500 px-4">
            <p className="text-sm">No watcher activity yet.</p>
            <p className="text-xs mt-1 text-center">Import or edit files in Eagle to see events here.</p>
          </div>
        ) : (
          <ul>
            {entries.map((entry) => {
              const label = TYPE_LABELS[entry.type] || entry.type;
              const displayText = entry.photoName && entry.photoName !== entry.message
                ? entry.photoName
                : entry.message;

              return (
                <li
                  key={entry.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-zinc-800/80 border-l-2 ${getRowAccent(entry.type)} hover:bg-gray-50 dark:hover:bg-zinc-800/40`}
                >
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${getTypeBadgeStyle(entry.type)}`}
                  >
                    {label}
                  </span>
                  <span className="flex-1 min-w-0 text-xs text-gray-700 dark:text-zinc-300 truncate" title={displayText}>
                    {displayText}
                  </span>
                  <time className="shrink-0 text-[10px] text-gray-400 dark:text-zinc-500 tabular-nums">
                    {formatActivityTime(entry.timestamp)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {syncStatus?.lastError && (
        <div className="px-4 py-2 border-t border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 shrink-0">
          {syncStatus.lastError}
        </div>
      )}
    </div>
  );
}
