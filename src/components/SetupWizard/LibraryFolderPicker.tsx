import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Folder, Home, Loader, CheckCircle } from 'lucide-react';

interface BrowseEntry {
  name: string;
  path: string;
  isLibrary: boolean;
  libraryValid: boolean;
}

interface BrowseResponse {
  path: string | null;
  parent: string | null;
  entries: BrowseEntry[];
  error?: string;
}

interface LibraryFolderPickerProps {
  selectedPath: string;
  onSelect: (path: string) => void;
  accentColor: string;
}

export function LibraryFolderPicker({ selectedPath, onSelect, accentColor }: LibraryFolderPickerProps) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (path: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const url = path
        ? `/api/config/browse?path=${encodeURIComponent(path)}`
        : '/api/config/browse';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load folders');
      const data: BrowseResponse = await res.json();
      if (data.error) {
        setError(data.error);
        setEntries([]);
      } else {
        setCurrentPath(data.path);
        setEntries(data.entries || []);
      }
    } catch {
      setError('Could not load folders. Check that Kiwi is running.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedPath || null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateTo = (path: string) => {
    load(path);
  };

  const goUp = async () => {
    const url = currentPath
      ? `/api/config/browse?path=${encodeURIComponent(currentPath)}`
      : '/api/config/browse';
    const res = await fetch(url);
    const data: BrowseResponse = await res.json();
    if (data.parent) {
      load(data.parent);
    } else {
      load(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => load(null)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
          title="Browse roots"
        >
          <Home className="w-4 h-4" />
        </button>
        {currentPath && (
          <button
            type="button"
            onClick={goUp}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Up
          </button>
        )}
        <span className="flex-1 text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
          {currentPath || 'Libraries'}
        </span>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader className="w-5 h-5 animate-spin" />
          </div>
        ) : error ? (
          <p className="px-3 py-4 text-sm text-red-500">{error}</p>
        ) : entries.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">No folders here.</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => {
                    if (entry.libraryValid) {
                      onSelect(entry.path);
                    } else {
                      navigateTo(entry.path);
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800/80 ${
                    selectedPath === entry.path ? 'bg-green-50 dark:bg-green-950/20' : ''
                  }`}
                >
                  <Folder
                    className={`w-4 h-4 shrink-0 ${
                      entry.libraryValid ? 'text-green-500' : 'text-gray-400'
                    }`}
                  />
                  <span className="flex-1 truncate text-gray-800 dark:text-gray-200">{entry.name}</span>
                  {entry.libraryValid ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Select
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedPath && (
        <div
          className="px-3 py-2 text-xs border-t border-gray-200 dark:border-gray-700"
          style={{ color: accentColor }}
        >
          Selected: <span className="font-mono break-all">{selectedPath}</span>
        </div>
      )}
    </div>
  );
}
