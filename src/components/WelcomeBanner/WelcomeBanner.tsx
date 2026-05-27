import React from 'react';
import { X, FolderTree, Image, LayoutDashboard } from 'lucide-react';

const STORAGE_KEY = 'kiwi_welcome_dismissed';

export function WelcomeBanner() {
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return true;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div className="relative rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 p-4 mb-6">
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-green-100 dark:hover:bg-green-900/40"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">You&apos;re all set!</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600 dark:text-gray-400">
        <li className="flex items-start gap-2">
          <FolderTree className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <span>Browse folders using the sidebar on the left</span>
        </li>
        <li className="flex items-start gap-2">
          <Image className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <span>Click any photo to view it full screen</span>
        </li>
        <li className="flex items-start gap-2">
          <LayoutDashboard className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <span>See library stats and sync activity on the Dashboard</span>
        </li>
      </ul>
    </div>
  );
}
