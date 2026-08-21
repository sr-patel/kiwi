import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Moon, Palette, Settings2, Sun, Zap } from 'lucide-react';
import { useAppStore } from '@/store';
import { getAccentColor, getAccentHex, getAccentRing } from '@/utils/accentColors';
import { SettingsCard, SettingsSlider, SettingsToggle } from '@/pages/settings/SettingsCard';
import { SettingsLibraryAdmin } from '@/pages/settings/SettingsLibraryAdmin';

type SettingsTab = 'general' | 'appearance' | 'view' | 'library';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'general', label: 'General', icon: Settings2, description: 'Navigation and loading' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and colors' },
  { id: 'view', label: 'View', icon: Eye, description: 'Grid and detail view' },
  { id: 'library', label: 'Library & Sync', icon: Zap, description: 'Path, watcher, and database' },
];

const ACCENT_OPTIONS = [
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
] as const;

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

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
    autoplayGifsInGrid,
    setAutoplayGifsInGrid,
    transitionEffect,
    setTransitionEffect,
    defaultLandingPage,
    setDefaultLandingPage,
  } = useAppStore();

  const accentHex = getAccentHex(accentColor);
  const activeMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Customize Kiwi and manage your library</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Sidebar nav */}
          <nav className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-56 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {TABS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                      : 'text-gray-600 hover:bg-white/60 dark:text-zinc-400 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" style={isActive ? { color: accentHex } : undefined} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{activeMeta.label}</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400">{activeMeta.description}</p>
            </div>

            {activeTab === 'general' && (
              <div className="space-y-4">
                <SettingsCard title="Default page">
                  <SettingsToggle
                    label="Start on Dashboard"
                    description="Open the statistics dashboard instead of the photo grid when launching Kiwi"
                    checked={defaultLandingPage !== 'all'}
                    onChange={(checked) => setDefaultLandingPage(checked ? 'dashboard' : 'all')}
                    accentHex={accentHex}
                  />
                </SettingsCard>

                <SettingsCard
                  title="Items per request"
                  description="How many items load per page when browsing folders and tags"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      aria-label="Items per request"
                      min={10}
                      max={500}
                      step={10}
                      value={requestPageSize}
                      onChange={(e) => setRequestPageSize(parseInt(e.target.value || '50', 10))}
                      className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                    <span className="text-sm text-gray-500 dark:text-zinc-400">items (10–500)</span>
                  </div>
                </SettingsCard>

                <SettingsCard title="Folders">
                  <SettingsToggle
                    label="Folder thumbnails"
                    description="Use the first A–Z thumbnail as each folder's icon"
                    checked={!!useFolderThumbnails}
                    onChange={setUseFolderThumbnails}
                    accentHex={accentHex}
                  />
                </SettingsCard>

                <SettingsCard title="Audio">
                  <SettingsToggle
                    label="Podcast mode"
                    description="Remember playback position for audio files"
                    checked={!!enablePodcastMode}
                    onChange={setEnablePodcastMode}
                    accentHex={accentHex}
                  />
                </SettingsCard>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <SettingsCard title="Theme">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                  </button>
                </SettingsCard>

                <SettingsCard
                  title="Accent color"
                  description="Used for highlights, buttons, and chart accents"
                >
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {ACCENT_OPTIONS.map(({ name, value }) => {
                      const isSelected = accentColor === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setAccentColor(value)}
                          className={`flex h-10 items-center justify-center rounded-lg text-xs font-medium text-white ${getAccentColor(value)} ${
                            isSelected ? `ring-2 ring-offset-2 ${getAccentRing(value)}` : ''
                          }`}
                          title={name}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </SettingsCard>

                <SettingsCard title="Color integration">
                  <SettingsToggle
                    label="Enhanced color integration"
                    description="Apply accent colors throughout the interface"
                    checked={!!enableColorIntegration}
                    onChange={setEnableColorIntegration}
                    accentHex={accentHex}
                  />
                </SettingsCard>
              </div>
            )}

            {activeTab === 'view' && (
              <div className="space-y-4">
                <SettingsCard title="Photo grid">
                  <SettingsToggle
                    label="Autoplay GIFs in grid"
                    description="Animate GIFs and WebPs in the grid instead of showing a static first frame"
                    checked={!!autoplayGifsInGrid}
                    onChange={setAutoplayGifsInGrid}
                    accentHex={accentHex}
                  />
                </SettingsCard>

                <SettingsCard title="Detail view">
                  <SettingsSlider
                    label="Info box size"
                    description="Width of the information panel in detailed view"
                    value={infoBoxSize}
                    min={50}
                    max={150}
                    step={10}
                    onChange={setInfoBoxSize}
                    formatValue={(v) => `${v}%`}
                    accentHex={accentHex}
                  />

                  <div className="mt-4 border-t border-gray-100 pt-4 dark:border-zinc-800">
                    <div className="mb-3 font-medium text-gray-900 dark:text-zinc-100">Image transition</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(['none', 'slide', 'fade', 'zoom'] as const).map((effect) => (
                        <button
                          key={effect}
                          type="button"
                          onClick={() => setTransitionEffect(effect)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                            transitionEffect === effect
                              ? 'text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                          }`}
                          style={transitionEffect === effect ? { backgroundColor: accentHex } : undefined}
                        >
                          {effect}
                        </button>
                      ))}
                    </div>
                  </div>
                </SettingsCard>
              </div>
            )}

            {activeTab === 'library' && <SettingsLibraryAdmin />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
