import React, { useState, useEffect } from 'react';
import { X, Palette, Moon, Sun, Monitor, Database, Trash2, Eye } from 'lucide-react';
import { useAppStore } from '@/store';

export const Settings: React.FC = () => {
  const { 
    settingsOpen, 
    setSettingsOpen, 
    theme, 
    toggleTheme, 
    accentColor, 
    setAccentColor,
    getCacheSize,
    clearCache,
    hideControlsWithInfoBox,
    setHideControlsWithInfoBox
  } = useAppStore();

  const [cacheSize, setCacheSize] = useState<string>('Loading...');
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const loadCacheSize = async () => {
      try {
        const size = await getCacheSize();
        const sizeMB = (size / 1024 / 1024).toFixed(2);
        setCacheSize(`${sizeMB} MB`);
      } catch (error) {
        setCacheSize('Error loading');
      }
    };

    if (settingsOpen) {
      loadCacheSize();
    }
  }, [settingsOpen, getCacheSize]);

  if (!settingsOpen) return null;

  const accentColors = [
    { name: 'Kiwi', value: 'kiwi', light: 'bg-[#8E466D]', dark: 'bg-[#A55A7F]' },
    { name: 'Orange', value: 'orange', light: 'bg-orange-500', dark: 'bg-orange-400' },
    { name: 'Blue', value: 'blue', light: 'bg-blue-500', dark: 'bg-blue-400' },
    { name: 'Green', value: 'green', light: 'bg-green-500', dark: 'bg-green-400' },
    { name: 'Purple', value: 'purple', light: 'bg-purple-500', dark: 'bg-purple-400' },
    { name: 'Red', value: 'red', light: 'bg-red-500', dark: 'bg-red-400' },
    { name: 'Pink', value: 'pink', light: 'bg-pink-500', dark: 'bg-pink-400' },
  ];

  const getAccentClasses = (color: string) => {
    const colorMap: { [key: string]: string } = {
      kiwi: 'bg-[#8E466D] dark:bg-[#A55A7F] text-white',
      orange: 'bg-orange-500 dark:bg-orange-400 text-white',
      blue: 'bg-blue-500 dark:bg-blue-400 text-white',
      green: 'bg-green-500 dark:bg-green-400 text-white',
      purple: 'bg-purple-500 dark:bg-purple-400 text-white',
      red: 'bg-red-500 dark:bg-red-400 text-white',
      pink: 'bg-pink-500 dark:bg-pink-400 text-white',
    };
    return colorMap[color] || colorMap.kiwi;
  };

  const handleClearCache = async () => {
    if (isClearing) return;
    
    setIsClearing(true);
    try {
      await clearCache();
      setCacheSize('0.00 MB');
      alert('Cache cleared successfully. The app will reload to apply changes.');
      window.location.reload();
    } catch (error) {
      alert('Failed to clear cache: ' + error);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Theme Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              Theme
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => toggleTheme()}
                className={`
                  p-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2
                  ${theme === 'light' 
                    ? 'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                onClick={() => toggleTheme()}
                className={`
                  p-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2
                  ${theme === 'dark' 
                    ? 'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
              <button
                className="p-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                disabled
              >
                <Monitor className="w-4 h-4" />
                Auto
              </button>
            </div>
          </div>

          {/* Accent Color Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Accent Color
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setAccentColor(color.value as any)}
                  className={`
                    p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-2
                    ${accentColor === color.value 
                      ? 'border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-800' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }
                  `}
                >
                  <div className={`w-6 h-6 rounded-full ${color.light} ${color.dark}`}></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {color.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Detailed View Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detailed View
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Hide Top Controls with Info Box
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    When hiding info box (I key), also hide zoom and view mode controls for minimal UI
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hideControlsWithInfoBox || false}
                  onChange={(e) => setHideControlsWithInfoBox(e.target.checked)}
                  className="ml-3 w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-2"
                />
              </label>
            </div>
          </div>

          {/* Cache Management */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Library Cache
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">IndexedDB Cache Size:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{cacheSize}</span>
              </div>
              <button
                onClick={handleClearCache}
                disabled={isClearing}
                className="w-full p-3 rounded-lg border-2 border-red-300 dark:border-red-600 hover:border-red-400 dark:hover:border-red-500 text-red-700 dark:text-red-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                {isClearing ? 'Clearing...' : 'Clear Cache'}
              </button>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This clears all cached library data (files, folders, metadata). The app will reload after clearing.
              </p>
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Preview</h3>
            <div className="space-y-3">
              <button className={`w-full p-3 rounded-lg ${getAccentClasses(accentColor)} font-medium`}>
                Primary Button
              </button>
              <div className={`p-3 rounded-lg border-2 ${getAccentClasses(accentColor).replace('text-white', 'text-transparent').replace('bg-', 'border-')} bg-transparent`}>
                Secondary Button
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full ${getAccentClasses(accentColor)}`}></div>
                <span className="text-gray-700 dark:text-gray-300">Selected item</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 