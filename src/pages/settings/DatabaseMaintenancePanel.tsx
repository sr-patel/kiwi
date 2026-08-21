import { useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { toUserMessage } from '@/services/apiClient';
import { kiwiApi } from '@/services/kiwiApi';

interface DatabaseMaintenancePanelProps {
  onRebuildComplete?: () => void;
}

export function DatabaseMaintenancePanel({ onRebuildComplete }: DatabaseMaintenancePanelProps) {
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [rebuildSuccess, setRebuildSuccess] = useState(false);

  const handleFullRebuild = async () => {
    if (!window.confirm('Rebuild the entire database from library files? This may take a while.')) return;
    setIsRebuilding(true);
    setRebuildError(null);
    setRebuildSuccess(false);
    try {
      await kiwiApi.system.rebuild();
      setRebuildSuccess(true);
      onRebuildComplete?.();
    } catch (err: unknown) {
      setRebuildError(toUserMessage(err, 'Failed to rebuild database'));
    } finally {
      setIsRebuilding(false);
    }
  };

  return (
    <SettingsCard
      title="Database maintenance"
      description="The file watcher keeps the index in sync automatically. Use a full rebuild only if the index is corrupt or out of date."
    >
      {rebuildError && (
        <p className="mb-3 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {rebuildError}
        </p>
      )}
      {rebuildSuccess && (
        <p className="mb-3 text-sm text-green-600 dark:text-green-400">
          Database rebuild completed successfully.
        </p>
      )}
      <button
        type="button"
        onClick={handleFullRebuild}
        disabled={isRebuilding}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${isRebuilding ? 'animate-spin' : ''}`} />
        {isRebuilding ? 'Rebuilding…' : 'Run full rebuild'}
      </button>
    </SettingsCard>
  );
}
