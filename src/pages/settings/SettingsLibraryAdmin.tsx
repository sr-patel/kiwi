import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Database, HardDrive, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import { libraryService } from '@/services/libraryService';
import { formatBytes } from '@/utils/formatBytes';
import { WatcherActivityPanel } from '@/pages/dashboard/WatcherActivityPanel';
import { useDashboardData } from '@/pages/dashboard/useDashboardData';
import { SettingsCard } from './SettingsCard';
import { DatabaseMaintenancePanel } from './DatabaseMaintenancePanel';
import { kiwiApi } from '@/services/kiwiApi';
import { toUserMessage } from '@/services/apiClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/queryKeys';

type LibraryStatus = 'idle' | 'loading' | 'valid' | 'invalid' | 'saving' | 'error';

export function SettingsLibraryAdmin() {
  const queryClient = useQueryClient();
  const accentHex = getAccentHex(useAppStore((s) => s.accentColor));
  const { setCurrentLibraryPath, setFolderTree } = useAppStore();
  const { stats, syncStatus, refresh } = useDashboardData();

  const [libraryPath, setLibraryPath] = useState('');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus>('idle');
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const configQuery = useQuery({
    queryKey: queryKeys.config(),
    queryFn: ({ signal }) => kiwiApi.config.get(signal),
  });
  const validationMutation = useMutation({
    mutationFn: (path: string) => kiwiApi.config.validate(path),
  });
  const configMutation = useMutation({
    mutationFn: (path: string) => kiwiApi.config.update({ libraryPath: path }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.config() }),
  });

  useEffect(() => {
    const data = configQuery.data;
    if (!data) return;
    setLibraryPath(data.libraryPath || '');
    setIsConfigured(Boolean(data._configured));
    if (!data._configured && data._validation?.reason) setLibraryMessage(data._validation.reason);
  }, [configQuery.data]);

  useEffect(() => {
    if (configQuery.error)
      setLibraryMessage(toUserMessage(configQuery.error, 'Could not load library settings.'));
  }, [configQuery.error]);

  const validateLibraryPath = useCallback(async () => {
    if (!libraryPath.trim()) {
      setLibraryStatus('invalid');
      setLibraryMessage('Please enter a library path.');
      return;
    }

    setLibraryStatus('loading');
    setLibraryMessage(null);

    try {
      const data = await validationMutation.mutateAsync(libraryPath.trim());
      if (data.valid) {
        setLibraryStatus('valid');
        setLibraryMessage('Valid Eagle library detected.');
      } else {
        setLibraryStatus('invalid');
        setLibraryMessage(data.hint ? `${data.reason} ${data.hint}` : data.reason || 'Invalid library path.');
      }
    } catch (error) {
      setLibraryStatus('error');
      setLibraryMessage(toUserMessage(error, 'Could not validate that library.'));
    }
  }, [libraryPath]);

  const saveLibraryPath = useCallback(async () => {
    if (!libraryPath.trim()) return;
    setLibraryStatus('saving');
    setLibraryMessage(null);

    try {
      await configMutation.mutateAsync(libraryPath.trim());
      setLibraryStatus('valid');
      setIsConfigured(true);
      setLibraryMessage('Configuration saved. Reloading your library…');

      setCurrentLibraryPath(libraryPath.trim());
      try {
        const result = await libraryService.initializeLibrary();
        if (result) {
          setFolderTree(result.folderTree);
        }
        setLibraryMessage('Library path saved and reloaded.');
        refresh();
      } catch {
        setLibraryMessage('Path saved. Refresh the page if folders do not update.');
      }
    } catch (error) {
      setLibraryStatus('error');
      setLibraryMessage(toUserMessage(error, 'Failed to save configuration.'));
    }
  }, [libraryPath, setCurrentLibraryPath, setFolderTree, refresh]);

  const renderStatusIcon = () => {
    if (libraryStatus === 'loading' || libraryStatus === 'saving') {
      return <Loader className="h-4 w-4 animate-spin text-gray-400" />;
    }
    if (libraryStatus === 'valid' && libraryPath) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (libraryStatus === 'invalid' || libraryStatus === 'error') {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="space-y-5">
      <SettingsCard title="Library path" description="Path to your Eagle .library folder on the server.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <HardDrive className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              aria-label="Library path"
              value={libraryPath}
              onChange={(e) => {
                setLibraryPath(e.target.value);
                setLibraryStatus('idle');
                setLibraryMessage(null);
              }}
              placeholder="C:\Photos\myLibrary.library"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">{renderStatusIcon()}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={validateLibraryPath}
              disabled={!libraryPath.trim() || libraryStatus === 'loading'}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: accentHex }}
            >
              Validate
            </button>
            <button
              type="button"
              onClick={saveLibraryPath}
              disabled={!libraryPath.trim() || libraryStatus === 'loading'}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: accentHex }}
            >
              Save
            </button>
          </div>
        </div>
        {isConfigured === false && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Library is not configured yet. Set the path to finish setup.
          </p>
        )}
        {libraryMessage && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-400">
            {libraryStatus === 'valid' ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            )}
            {libraryMessage}
          </p>
        )}
      </SettingsCard>

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
              <Database className="h-4 w-4" />
              Database size
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">
              {formatBytes(stats.dbSize)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm text-gray-500 dark:text-zinc-400">Indexed items</div>
            <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">
              {stats.totalPhotos.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm text-gray-500 dark:text-zinc-400">Last refresh</div>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-zinc-100">
              {stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleString() : 'Never'}
            </p>
          </div>
        </div>
      )}

      <WatcherActivityPanel syncStatus={syncStatus} defaultExpanded />

      <DatabaseMaintenancePanel onRebuildComplete={refresh} />
    </div>
  );
}
