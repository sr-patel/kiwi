import React, { useState, useEffect } from 'react';
import { configService, AppConfig } from '@/services/configService';
import { useAppStore } from '@/store';

export const ConfigEditor: React.FC = () => {
  const { setCurrentLibraryPath } = useAppStore();
  const [config, setConfig] = useState<AppConfig>(configService.getConfig());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setConfig(configService.getConfig());
  }, []);

  const handleConfigChange = (key: keyof AppConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    configService.updateConfig(config);
    setHasChanges(false);
    
    // Update library path in store if it changed
    if (config.libraryPath !== configService.libraryPath) {
      setCurrentLibraryPath(config.libraryPath);
    }
    
    alert('Configuration saved successfully!');
  };

  const handleReset = () => {
    configService.resetToDefaults();
    setConfig(configService.getConfig());
    setHasChanges(false);
    alert('Configuration reset to defaults!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configuration Editor</h2>
      </div>

          <div className="space-y-4">
            {/* Library Path */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Library Path
              </label>
              <input
                type="text"
                value={config.libraryPath}
                onChange={(e) => handleConfigChange('libraryPath', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                placeholder="Enter library path"
              />
            </div>

            {/* Request Page Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Request Page Size
              </label>
              <input
                type="number"
                value={config.requestPageSize}
                onChange={(e) => handleConfigChange('requestPageSize', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                min="10"
                max="200"
              />
            </div>

            {/* Default Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Theme
              </label>
              <select
                value={config.defaultTheme}
                onChange={(e) => handleConfigChange('defaultTheme', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            {/* Default Accent Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Accent Color
              </label>
              <select
                value={config.defaultAccentColor}
                onChange={(e) => handleConfigChange('defaultAccentColor', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              >
                <option value="kiwi">Kiwi</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="red">Red</option>
                <option value="purple">Purple</option>
                <option value="orange">Orange</option>
              </select>
            </div>

            {/* Cache Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enable Cache
                </label>
                <input
                  type="checkbox"
                  checked={config.enableCache}
                  onChange={(e) => handleConfigChange('enableCache', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cache Validity (hours)
                </label>
                <input
                  type="number"
                  value={config.cacheValidityHours}
                  onChange={(e) => handleConfigChange('cacheValidityHours', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  min="1"
                  max="168"
                />
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enable Podcast Mode
                </label>
                <input
                  type="checkbox"
                  checked={config.enablePodcastMode}
                  onChange={(e) => handleConfigChange('enablePodcastMode', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enable Color Integration
                </label>
                <input
                  type="checkbox"
                  checked={config.enableColorIntegration}
                  onChange={(e) => handleConfigChange('enableColorIntegration', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>

            {/* UI Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Use Folder Thumbnails
                </label>
                <input
                  type="checkbox"
                  checked={config.useFolderThumbnails}
                  onChange={(e) => handleConfigChange('useFolderThumbnails', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Autoplay GIFs in Grid
                </label>
                <input
                  type="checkbox"
                  checked={config.autoplayGifsInGrid}
                  onChange={(e) => handleConfigChange('autoplayGifsInGrid', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>

            {/* Sidebar Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sidebar Width
                </label>
                <input
                  type="number"
                  value={config.sidebarWidth}
                  onChange={(e) => handleConfigChange('sidebarWidth', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  min="200"
                  max="400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Sidebar Open
                </label>
                <input
                  type="checkbox"
                  checked={config.defaultSidebarOpen}
                  onChange={(e) => handleConfigChange('defaultSidebarOpen', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default ConfigEditor;
