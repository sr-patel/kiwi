import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import {
  Moon,
  Sun,
  ArrowLeft,
  Eye,
  Database,
  HardDrive,
  Loader,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PWADebugger } from '@/components/PWA/PWADebugger';
import {
  getAccentColor,
  getAccentRing,
  getAccentHex,
} from '@/utils/accentColors';

type LibraryStatus = 'idle' | 'loading' | 'valid' | 'invalid' | 'saving' | 'error';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    theme,
    toggleTheme,
    accentColor,
    setAccentColor,
    useFolderThumbnails,
    setUseFolderThumbnails,
    enableColorIntegration,
    setEnableColorIntegration,
    enablePodcastMode,
    setEnablePodcastMode,
    requestPageSize,
    setRequestPageSize,
    infoBoxSize,
    setInfoBoxSize,
    hideControlsWithInfoBox,
    setHideControlsWithInfoBox,
    autoplayGifsInGrid,
    setAutoplayGifsInGrid,
    transitionEffect,
    setTransitionEffect,
  } = useAppStore();

  // Accent helpers
  const accentOptions: { name: string; value: typeof accentColor }[] = [
    { name: 'Kiwi', value: 'kiwi' },
    { name: 'Orange', value: 'orange' },
    { name: 'Blue', value: 'blue' },
    { name: 'Green', value: 'green' },
    { name: 'Purple', value: 'purple' },
    { name: 'Red', value: 'red' },
    { name: 'Pink', value: 'pink' },
    { name: 'Teal', value: 'teal' },
    { name: 'Indigo', value: 'indigo' },
    { name: 'Cyan', value: 'cyan' },
    { name: 'Lime', value: 'lime' },
    { name: 'Amber', value: 'amber' },
  ];

  const accentHex = getAccentHex(accentColor);

  // Library path settings (server-backed)
  const [libraryPath, setLibraryPath] = useState('');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus>('idle');
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setLibraryPath(data.libraryPath || '');
        setIsConfigured(!!data._configured);
        if (!data._configured && data._validation?.reason) {
          setLibraryMessage(data._validation.reason);
        }
      } catch {
        // If backend isn't up, keep UI neutral
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validateLibraryPath = useCallback(async () => {
    if (!libraryPath.trim()) {
      setLibraryStatus('invalid');
      setLibraryMessage('Please enter a library path.');
      return;
    }

    setLibraryStatus('loading');
    setLibraryMessage(null);

    try {
      const res = await fetch('/api/config/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryPath: libraryPath.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setLibraryStatus('valid');
        setLibraryMessage('Valid Eagle library detected.');
      } else {
        setLibraryStatus('invalid');
        setLibraryMessage(data.reason || 'Invalid library path.');
      }
    } catch {
      setLibraryStatus('error');
      setLibraryMessage('Could not reach the backend. Is the server running?');
    }
  }, [libraryPath]);

  const saveLibraryPath = useCallback(async () => {
    if (!libraryPath.trim()) return;
    setLibraryStatus('saving');
    setLibraryMessage(null);

    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryPath: libraryPath.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLibraryStatus('error');
        setLibraryMessage(data.error || 'Failed to save configuration.');
        return;
      }
      setLibraryStatus('valid');
      setIsConfigured(true);
      setLibraryMessage('Configuration saved. The database will rebuild if needed.');
    } catch {
      setLibraryStatus('error');
      setLibraryMessage('Failed to save configuration. Check server connection.');
    }
  }, [libraryPath]);

  const triggerFullRebuild = useCallback(async () => {
    setLibraryMessage('Starting full database rebuild...');
    try {
      await fetch('/api/database/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'library' }),
      });
      setLibraryMessage('Database rebuild requested. Check Admin page for progress.');
    } catch {
      setLibraryMessage('Failed to start database rebuild. Check server logs.');
    }
  }, []);

  const triggerIncrementalUpdate = useCallback(async () => {
    setLibraryMessage('Starting incremental update...');
    try {
      await fetch('/api/database/incremental-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      setLibraryMessage('Incremental update started. Check Admin page for progress.');
    } catch {
      setLibraryMessage('Failed to start incremental update. Check server logs.');
    }
  }, []);

  const renderLibraryStatusIcon = () => {
    if (libraryStatus === 'loading' || libraryStatus === 'saving') {
      return <Loader className="w-4 h-4 animate-spin text-gray-400" />;
    }
    if (libraryStatus === 'valid' && libraryPath) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (libraryStatus === 'invalid' || libraryStatus === 'error') {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Settings
            </h1>
          </div>
        </div>

        <div className="space-y-8">
          {/* Library section */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Library &amp; Database
            </h2>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-3">
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                  Library path
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={libraryPath}
                      onChange={(e) => {
                        setLibraryPath(e.target.value);
                        setLibraryStatus('idle');
                        setLibraryMessage(null);
                      }}
                      placeholder="C:\Photos\myLibrary.library"
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1"
                      style={{
                        boxShadow: 'none',
                      }}
                    />
                    <div className="absolute left-2 top-1/2 -translate-y-1/2">
                      {renderLibraryStatusIcon()}
                    </div>
                  </div>
                  <button
                    onClick={validateLibraryPath}
                    disabled={!libraryPath.trim() || libraryStatus === 'loading'}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                    style={{ backgroundColor: accentHex }}
                  >
                    Validate
                  </button>
                  <button
                    onClick={saveLibraryPath}
                    disabled={!libraryPath.trim() || libraryStatus === 'loading'}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                    style={{ backgroundColor: accentHex }}
                  >
                    Save
                  </button>
                </div>
                {isConfigured === false && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Library is not configured yet. Set the path to your Eagle
                    library to finish setup.
                  </p>
                )}
                {libraryMessage && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    {libraryStatus === 'valid' && (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    )}
                    {libraryStatus !== 'valid' && (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    )}
                    {libraryMessage}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <HardDrive className="w-4 h-4" />
                  <span className="font-medium">Database maintenance</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={triggerIncrementalUpdate}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: accentHex }}
                  >
                    Incremental update
                  </button>
                  <button
                    onClick={triggerFullRebuild}
                    className="px-3 py-2 rounded-lg text-xs font-medium border border-red-500/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1"
                  >
                    <Loader className="w-3 h-3" />
                    Full rebuild
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Requests */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Requests
            </h2>
            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <div>
                <div className="text-gray-800 dark:text-gray-200 font-medium">
                  Items per request
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Controls how many items load per page (10–500)
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={requestPageSize}
                  onChange={(e) =>
                    setRequestPageSize(parseInt(e.target.value || '50', 10))
                  }
                  className="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </section>

          {/* Theme */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Theme
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-900 dark:text-gray-100"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
                Toggle Theme
              </button>
            </div>
          </section>

          {/* Accent color */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Accent Color
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {accentOptions.map(({ name, value }) => {
                const isSelected = accentColor === value;
                const base = getAccentColor(value);
                const ring = isSelected ? getAccentRing(value) : '';
                return (
                  <button
                    key={value}
                    onClick={() => setAccentColor(value)}
                    className={`h-10 rounded-lg flex items-center justify-center text-white text-sm ${base} ${
                      isSelected ? `ring-2 ring-offset-2 ${ring}` : ''
                    }`}
                    title={name}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Appearance */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Appearance
            </h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <input
                  type="checkbox"
                  checked={!!enableColorIntegration}
                  onChange={(e) => setEnableColorIntegration(e.target.checked)}
                  className="w-4 h-4"
                  style={{ accentColor: accentHex }}
                />
                <div>
                  <div className="text-gray-800 dark:text-gray-200 font-medium">
                    Enhanced Color Integration
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Apply accent colors throughout the interface
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <input
                  type="checkbox"
                  checked={!!autoplayGifsInGrid}
                  onChange={(e) => setAutoplayGifsInGrid(e.target.checked)}
                  className="w-4 h-4"
                  style={{ accentColor: accentHex }}
                />
                <div>
                  <div className="text-gray-800 dark:text-gray-200 font-medium">
                    Autoplay GIFs in Grid
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Animate GIFs/WebPs in grid view instead of showing a static
                    first frame
                  </div>
                </div>
              </label>

              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      Info Box Size
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Size of the information box in detailed view (50% -
                      150%)
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="50"
                      max="150"
                      step="10"
                      value={infoBoxSize}
                      onChange={(e) =>
                        setInfoBoxSize(parseInt(e.target.value, 10))
                      }
                      className="w-24"
                      style={{ accentColor: accentHex }}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[40px] text-right">
                      {infoBoxSize}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Detailed view */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detailed View
            </h2>
            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <input
                  type="checkbox"
                  checked={!!hideControlsWithInfoBox}
                  onChange={(e) =>
                    setHideControlsWithInfoBox(e.target.checked)
                  }
                  className="w-4 h-4 mt-1"
                  style={{ accentColor: accentHex }}
                />
                <div>
                  <div className="text-gray-800 dark:text-gray-200 font-medium">
                    Hide Top Controls with Info Box
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    When hiding the info box (I key), also hide zoom and view
                    mode controls for a minimal, distraction-free UI
                  </div>
                </div>
              </label>

              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <div className="text-gray-800 dark:text-gray-200 font-medium mb-2">
                  Image Transition Effect
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['none', 'slide', 'fade', 'zoom'] as const).map((effect) => (
                    <button
                      key={effect}
                      onClick={() => setTransitionEffect(effect)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                        transitionEffect === effect
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={
                        transitionEffect === effect
                          ? { backgroundColor: accentHex }
                          : {}
                      }
                    >
                      {effect}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Folders */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Folders
            </h2>
            <label className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <input
                type="checkbox"
                checked={!!useFolderThumbnails}
                onChange={(e) => setUseFolderThumbnails(e.target.checked)}
                className="w-4 h-4"
                style={{ accentColor: accentHex }}
              />
              <span className="text-gray-800 dark:text-gray-200">
                Use first A–Z thumbnail as folder icon
              </span>
            </label>
          </section>

          {/* Audio */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Audio
            </h2>
            <label className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <input
                type="checkbox"
                checked={!!enablePodcastMode}
                onChange={(e) => setEnablePodcastMode(e.target.checked)}
                className="w-4 h-4"
                style={{ accentColor: accentHex }}
              />
              <div>
                <div className="text-gray-800 dark:text-gray-200 font-medium">
                  Podcast Mode
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Remember playback position for audio files
                </div>
              </div>
            </label>
          </section>

          {process.env.NODE_ENV === 'development' && <PWADebugger />}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

