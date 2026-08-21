import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import { kiwiApi } from '@/services/kiwiApi';
import type { FolderNode } from '@/types';
import type { WatcherActivityEntry } from '@/pages/dashboard/types';
import { queryKeys } from './queryKeys';

const TAG_ACTIVITY_TYPES = new Set(['photo_added', 'photo_updated', 'photo_removed', 'reconcile']);

function folderExistsInTree(folders: FolderNode[], folderId: string): boolean {
  return folders.some(
    (folder) =>
      folder.id === folderId ||
      Boolean(folder.children?.length && folderExistsInTree(folder.children, folderId)),
  );
}

function shouldInvalidateTags(activities: WatcherActivityEntry[]): boolean {
  return activities.some(
    (activity) =>
      TAG_ACTIVITY_TYPES.has(activity.type) ||
      (activity.type === 'library_updated' && activity.message.includes('Tags')),
  );
}

function shouldRefreshFolders(activities: WatcherActivityEntry[]): boolean {
  return activities.some(
    (activity) => activity.type === 'library_updated' && activity.message.includes('Library folders'),
  );
}

export function useLibrarySyncRefresh(enabled: boolean) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lastActivityIdRef = useRef<number | null>(null);
  const processedCountRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const { currentFolder, setFolderTree, setCurrentFolder } = useAppStore();
  const syncQuery = useQuery({
    queryKey: queryKeys.sync(),
    queryFn: ({ signal }) => kiwiApi.system.syncStatus(signal),
    enabled,
    refetchInterval: enabled ? 5_000 : false,
  });

  const refreshFolderTree = useCallback(async () => {
    const tree = await libraryService.refreshFolderTree();
    if (!tree) return;
    setFolderTree(tree);
    if (currentFolder && !folderExistsInTree(tree, currentFolder)) {
      setCurrentFolder(null);
      navigate('/all');
    }
  }, [currentFolder, navigate, setCurrentFolder, setFolderTree]);

  useEffect(() => {
    if (!enabled) {
      initializedRef.current = false;
      return;
    }
    const data = syncQuery.data;
    if (!data) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      processedCountRef.current = data.processedCount;
      lastActivityIdRef.current = data.activityLog[0]?.id ?? null;
      return;
    }

    const processedCountIncreased = data.processedCount > (processedCountRef.current ?? 0);
    processedCountRef.current = data.processedCount;
    const lastSeenId = lastActivityIdRef.current;
    const newActivities =
      lastSeenId === null ? data.activityLog : data.activityLog.filter((entry) => entry.id > lastSeenId);
    lastActivityIdRef.current = data.activityLog[0]?.id ?? lastSeenId;

    if (processedCountIncreased || shouldInvalidateTags(newActivities)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.photos() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    }
    if (shouldRefreshFolders(newActivities)) void refreshFolderTree();
  }, [enabled, queryClient, refreshFolderTree, syncQuery.data]);
}
