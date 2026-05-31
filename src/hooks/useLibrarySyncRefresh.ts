import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import type { FolderNode } from '@/types';
import type { SyncStatus, WatcherActivityEntry } from '@/pages/dashboard/types';

const TAG_ACTIVITY_TYPES = new Set(['photo_added', 'photo_updated', 'photo_removed', 'reconcile']);

function folderExistsInTree(folders: FolderNode[], folderId: string): boolean {
  for (const folder of folders) {
    if (folder.id === folderId) return true;
    if (folder.children?.length && folderExistsInTree(folder.children, folderId)) return true;
  }
  return false;
}

function shouldInvalidateTags(activities: WatcherActivityEntry[]): boolean {
  return activities.some((activity) => {
    if (TAG_ACTIVITY_TYPES.has(activity.type)) return true;
    return activity.type === 'library_updated' && activity.message.includes('Tags');
  });
}

function shouldRefreshFolders(activities: WatcherActivityEntry[]): boolean {
  return activities.some(
    (activity) =>
      activity.type === 'library_updated' && activity.message.includes('Library folders'),
  );
}

export function useLibrarySyncRefresh(enabled: boolean) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lastActivityIdRef = useRef<number | null>(null);
  const processedCountRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const { allPhotos, currentFolder, setFolderTree, setCurrentFolder } = useAppStore();

  const refreshFolderTree = useCallback(async () => {
    const photos = allPhotos ?? [];
    const tree = await libraryService.refreshFolderTree(photos);
    if (!tree) return;

    await setFolderTree(tree);

    if (currentFolder && !folderExistsInTree(tree, currentFolder)) {
      setCurrentFolder(null);
      navigate('/all');
    }
  }, [allPhotos, currentFolder, setFolderTree, setCurrentFolder, navigate]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/sync/status');
        if (!res.ok || cancelled) return;

        const data: SyncStatus = await res.json();

        if (!initializedRef.current) {
          initializedRef.current = true;
          processedCountRef.current = data.processedCount;
          if (data.activityLog.length > 0) {
            lastActivityIdRef.current = data.activityLog[0].id;
          }
          return;
        }

        const prevProcessed = processedCountRef.current ?? 0;
        const processedCountIncreased = data.processedCount > prevProcessed;
        processedCountRef.current = data.processedCount;

        const lastSeenId = lastActivityIdRef.current;
        const newActivities =
          lastSeenId !== null
            ? data.activityLog.filter((entry) => entry.id > lastSeenId)
            : data.activityLog;

        if (data.activityLog.length > 0) {
          lastActivityIdRef.current = data.activityLog[0].id;
        }

        const invalidateTags = processedCountIncreased || shouldInvalidateTags(newActivities);
        const refreshFolders = shouldRefreshFolders(newActivities);

        if (invalidateTags) {
          queryClient.invalidateQueries({ queryKey: ['tags'] });
          queryClient.invalidateQueries({ queryKey: ['tagCounts'] });
          queryClient.invalidateQueries({ queryKey: ['tagCoOccurrences'] });
          queryClient.invalidateQueries({ queryKey: ['tagNetwork'] });
        }

        if (refreshFolders) {
          await refreshFolderTree();
        }
      } catch {
        // non-critical
      }
    };

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, queryClient, refreshFolderTree]);
}
