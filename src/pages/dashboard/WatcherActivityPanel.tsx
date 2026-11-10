import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
      return 'bg-muted text-muted-foreground';
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
      return 'border-l-border dark:border-l-border';
  }
}

interface WatcherActivityPanelProps {
  syncStatus: SyncStatus | null;
  className?: string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  defaultExpanded?: boolean;
}

export function WatcherActivityPanel({
  syncStatus,
  className = '',
  expanded: expandedProp,
  onExpandedChange,
  defaultExpanded = false,
}: WatcherActivityPanelProps) {
  const [expandedInternal, setExpandedInternal] = useState(defaultExpanded);
  const expanded = expandedProp ?? expandedInternal;
  const setExpanded = onExpandedChange ?? setExpandedInternal;

  const entries = syncStatus?.activityLog?.length ? [...syncStatus.activityLog].reverse() : [];

  return (
    <div
      className={`bg-card rounded-xl border border-border shadow-sm flex flex-col self-start w-full ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">File Watcher</h3>
          <p className="text-xs text-muted-foreground truncate">Live sync activity</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                syncStatus?.running ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'
              }`}
            />
            <span className="text-muted-foreground dark:text-foreground font-medium">
              {syncStatus?.running ? 'Active' : 'Stopped'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse activity log' : 'Expand activity log'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="flex border-b border-border shrink-0 divide-x divide-border">
          <div className="flex-1 px-4 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Processed</p>
            <p className="text-base font-semibold text-foreground tabular-nums leading-tight">
              {syncStatus.processedCount.toLocaleString()}
            </p>
          </div>
          <div className="flex-1 px-4 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</p>
            <p className="text-base font-semibold text-foreground tabular-nums leading-tight">
              {syncStatus.pendingCount.toLocaleString()}
            </p>
          </div>
          {syncStatus.lastEventTime && (
            <div className="flex-1 px-4 py-2 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last event</p>
              <p className="text-xs font-medium text-foreground tabular-nums truncate leading-tight mt-0.5">
                {formatActivityTime(syncStatus.lastEventTime)}
              </p>
            </div>
          )}
        </div>
      )}

      {syncStatus?.lastEvent && (
        <div className="px-4 py-2 shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Latest</p>
          <p className="text-xs text-muted-foreground truncate" title={syncStatus.lastEvent}>
            {syncStatus.lastEvent}
          </p>
        </div>
      )}

      {expanded && (
        <div className="border-t border-border max-h-[50vh] overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[160px] text-muted-foreground px-4 py-6">
              <p className="text-sm">No watcher activity yet.</p>
              <p className="text-xs mt-1 text-center">Import or edit files in Eagle to see events here.</p>
            </div>
          ) : (
            <ul>
              {entries.map((entry) => {
                const label = TYPE_LABELS[entry.type] || entry.type;
                const displayText =
                  entry.photoName && entry.photoName !== entry.message ? entry.photoName : entry.message;

                return (
                  <li
                    key={entry.id}
                    className={`group flex items-center gap-2 px-3 py-1.5 border-b border-border/60 dark:border-border/80 border-l-2 ${getRowAccent(entry.type)} hover:bg-muted/60 dark:hover:bg-muted/40`}
                  >
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${getTypeBadgeStyle(entry.type)}`}
                    >
                      {label}
                    </span>
                    <span className="flex-1 min-w-0 text-xs text-foreground truncate" title={displayText}>
                      {displayText}
                    </span>
                    <time className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {formatActivityTime(entry.timestamp)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {syncStatus?.lastError && (
        <div className="px-4 py-2 border-t border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 shrink-0">
          {syncStatus.lastError}
        </div>
      )}
    </div>
  );
}
