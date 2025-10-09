import React from 'react';
import { useAppStore } from '@/store';
import { Moon, Sun, ArrowLeft, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
 
import { PWADebugger } from '@/components/PWA/PWADebugger';
import { ConfigEditor } from '@/components/ConfigEditor/ConfigEditor';

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
  } = useAppStore();


  const accentColors = [
    { name: 'Kiwi', value: 'kiwi', light: 'bg-[#8E466D]', dark: 'bg-[#A55A7F]' },
    { name: 'Orange', value: 'orange', light: 'bg-orange-500', dark: 'bg-orange-400' },
    { name: 'Blue', value: 'blue', light: 'bg-blue-500', dark: 'bg-blue-400' },
    { name: 'Green', value: 'green', light: 'bg-green-500', dark: 'bg-green-400' },
    { name: 'Purple', value: 'purple', light: 'bg-purple-500', dark: 'bg-purple-400' },
    { name: 'Red', value: 'red', light: 'bg-red-500', dark: 'bg-red-400' },
    { name: 'Pink', value: 'pink', light: 'bg-pink-500', dark: 'bg-pink-400' },
    { name: 'Teal', value: 'teal', light: 'bg-teal-500', dark: 'bg-teal-400' },
    { name: 'Indigo', value: 'indigo', light: 'bg-indigo-500', dark: 'bg-indigo-400' },
    { name: 'Cyan', value: 'cyan', light: 'bg-cyan-500', dark: 'bg-cyan-400' },
    { name: 'Lime', value: 'lime', light: 'bg-lime-500', dark: 'bg-lime-400' },
    { name: 'Amber', value: 'amber', light: 'bg-amber-500', dark: 'bg-amber-400' },
  ];

  const getAccentClasses = (color: string) => {
    const c = accentColors.find(a => a.value === color) || accentColors[0];
    return theme === 'dark' ? c.dark : c.light;
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Requests</h2>
            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <div>
                <div className="text-gray-800 dark:text-gray-200 font-medium">Items per request</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Controls how many items load per page (10–500)</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={requestPageSize}
                  onChange={(e) => setRequestPageSize(parseInt(e.target.value || '50', 10))}
                  className="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Theme</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-900 dark:text-gray-100"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                Toggle Theme
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Accent Color</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {accentColors.map(({ name, value }) => (
                <button
                  key={value}
                  onClick={() => setAccentColor(value as any)}
                  className={`h-10 rounded-lg flex items-center justify-center text-white ${getAccentClasses(value)} ${accentColor === value ? 'ring-2 ring-offset-2 ring-blue-400' : ''}`}
                  title={name}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Appearance</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <input
                  type="checkbox"
                  checked={!!enableColorIntegration}
                  onChange={(e) => setEnableColorIntegration(e.target.checked)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="text-gray-800 dark:text-gray-200 font-medium">Enhanced Color Integration</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Apply accent colors throughout the interface</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <input
                  type="checkbox"
                  checked={!!autoplayGifsInGrid}
                  onChange={(e) => setAutoplayGifsInGrid(e.target.checked)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="text-gray-800 dark:text-gray-200 font-medium">Autoplay GIFs in Grid</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Animate GIFs/WebPs in grid view instead of showing a static first frame</div>
                </div>
              </label>
              
              <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-gray-800 dark:text-gray-200 font-medium">Info Box Size</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Size of the information box in detailed view (50% - 150%)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="50"
                      max="150"
                      step="10"
                      value={infoBoxSize}
                      onChange={(e) => setInfoBoxSize(parseInt(e.target.value, 10))}
                      className={`w-24 accent-${accentColor}-500`}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[40px] text-right">
                      {infoBoxSize}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

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
                  onChange={(e) => setHideControlsWithInfoBox(e.target.checked)}
                  className="w-4 h-4 mt-1"
                />
                <div>
                  <div className="text-gray-800 dark:text-gray-200 font-medium">Hide Top Controls with Info Box</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">When hiding the info box (I key), also hide zoom and view mode controls for a minimal, distraction-free UI</div>
                </div>
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Folders</h2>
            <label className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <input
                type="checkbox"
                checked={!!useFolderThumbnails}
                onChange={(e) => setUseFolderThumbnails(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-gray-800 dark:text-gray-200">Use first A–Z thumbnail as folder icon</span>
            </label>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Audio</h2>
            <label className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <input
                type="checkbox"
                checked={!!enablePodcastMode}
                onChange={(e) => setEnablePodcastMode(e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <div className="text-gray-800 dark:text-gray-200 font-medium">Podcast Mode</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Remember playback position for audio files</div>
              </div>
            </label>
          </section>

          <section>
            <ConfigEditor />
          </section>

          {process.env.NODE_ENV === 'development' && (
            <PWADebugger />
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

