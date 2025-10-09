import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setShowOfflineMessage(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.reload();
    }
  };

  if (!showOfflineMessage) {
    return null;
  }

  return (
    <div className="fixed top-16 left-4 right-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 z-50 md:max-w-sm md:right-auto">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            You're offline. Some features may be limited.
          </p>
          {isOnline && (
            <button
              onClick={handleRetry}
              className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 flex items-center gap-1 mt-1"
            >
              <RefreshCw className="w-3 h-3" />
              Reconnected - Refresh
            </button>
          )}
        </div>
        {isOnline && (
          <Wifi className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        )}
      </div>
    </div>
  );
};