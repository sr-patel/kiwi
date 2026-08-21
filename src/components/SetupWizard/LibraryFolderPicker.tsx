import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Folder, Home, Loader, CheckCircle } from 'lucide-react';
import { queryKeys } from '@/hooks/queryKeys';
import { kiwiApi } from '@/services/kiwiApi';
import { toUserMessage } from '@/services/apiClient';

interface LibraryFolderPickerProps {
  selectedPath: string;
  onSelect: (path: string) => void;
  accentColor: string;
}

export function LibraryFolderPicker({ selectedPath, onSelect, accentColor }: LibraryFolderPickerProps) {
  const [requestedPath, setRequestedPath] = useState<string | null>(selectedPath || null);
  const browseQuery = useQuery({
    queryKey: queryKeys.configBrowse(requestedPath),
    queryFn: ({ signal }) => kiwiApi.config.browse(requestedPath ?? undefined, signal),
    staleTime: 15_000,
  });
  const currentPath = browseQuery.data?.path ?? null;
  const entries = browseQuery.data?.entries ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/80">
        <button
          type="button"
          onClick={() => setRequestedPath(null)}
          className="rounded p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="Browse library roots"
        >
          <Home className="h-4 w-4" />
        </button>
        {currentPath && (
          <button
            type="button"
            onClick={() => setRequestedPath(browseQuery.data?.parent ?? null)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Up
          </button>
        )}
        <span className="flex-1 truncate font-mono text-xs text-gray-500 dark:text-gray-400">
          {currentPath || 'Libraries'}
        </span>
      </div>

      <div className="max-h-48 overflow-y-auto" aria-busy={browseQuery.isFetching}>
        {browseQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400" role="status">
            <Loader className="h-5 w-5 animate-spin" />
            <span className="sr-only">Loading folders</span>
          </div>
        ) : browseQuery.isError ? (
          <div className="space-y-2 px-3 py-4 text-sm text-red-500" role="alert">
            <p>{toUserMessage(browseQuery.error, 'Could not load folders.')}</p>
            <button type="button" className="underline" onClick={() => void browseQuery.refetch()}>
              Try again
            </button>
          </div>
        ) : entries.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">No folders here.</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => (entry.libraryValid ? onSelect(entry.path) : setRequestedPath(entry.path))}
                  className={`flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:border-gray-800/80 dark:hover:bg-gray-800/60 ${
                    selectedPath === entry.path ? 'bg-green-50 dark:bg-green-950/20' : ''
                  }`}
                >
                  <Folder
                    className={`h-4 w-4 shrink-0 ${entry.libraryValid ? 'text-green-500' : 'text-gray-400'}`}
                  />
                  <span className="flex-1 truncate text-gray-800 dark:text-gray-200">{entry.name}</span>
                  {entry.libraryValid ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-green-700 dark:text-green-300">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Select
                    </span>
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedPath && (
        <div
          className="border-t border-gray-200 px-3 py-2 text-xs dark:border-gray-700"
          style={{ color: accentColor }}
        >
          Selected: <span className="break-all font-mono">{selectedPath}</span>
        </div>
      )}
    </div>
  );
}
