import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';

interface PWAStatus {
  manifestLoaded: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerActive: boolean;
  serviceWorkerControlled: boolean;
  isInstallable: boolean;
  isHTTPS: boolean;
  hasRequiredIcons: boolean;
  beforeInstallPromptFired: boolean;
  canInstall: boolean;
}

export const PWADebugger: React.FC = () => {
  const [status, setStatus] = useState<PWAStatus>({
    manifestLoaded: false,
    serviceWorkerRegistered: false,
    serviceWorkerActive: false,
    serviceWorkerControlled: false,
    isInstallable: false,
    isHTTPS: false,
    hasRequiredIcons: false,
    beforeInstallPromptFired: false,
    canInstall: false
  });
  const [showDebugger, setShowDebugger] = useState(false);

  useEffect(() => {
    const checkPWAStatus = async () => {
      const newStatus: PWAStatus = {
        manifestLoaded: false,
        serviceWorkerRegistered: false,
        serviceWorkerActive: false,
        serviceWorkerControlled: false,
        isInstallable: false,
        isHTTPS: (window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost'),
        hasRequiredIcons: false,
        beforeInstallPromptFired: false,
        canInstall: false
      };

      // Check manifest
      try {
        const response = await fetch('/manifest.json');
        if (response.ok) {
          const manifest = await response.json();
          newStatus.manifestLoaded = true;
          newStatus.hasRequiredIcons = manifest.icons && manifest.icons.length > 0;
        }
      } catch (error) {
        console.error('Manifest check failed:', error);
      }

      // Check service worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          newStatus.serviceWorkerRegistered = !!registration;
          newStatus.serviceWorkerControlled = !!navigator.serviceWorker.controller;
          newStatus.serviceWorkerActive = !!registration?.active;
        } catch (error) {
          console.error('Service worker check failed:', error);
        }
      }

      // Derive installable when secure, manifest ok, SW controlling
      const canInstall = newStatus.isHTTPS && newStatus.manifestLoaded && newStatus.serviceWorkerControlled;
      setStatus({ ...newStatus, canInstall });
    };

    checkPWAStatus();

    // Update when SW becomes ready/active
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          setStatus(prev => ({
            ...prev,
            serviceWorkerRegistered: !!registration,
            serviceWorkerActive: !!registration.active,
            canInstall: prev.isHTTPS && prev.manifestLoaded && !!navigator.serviceWorker.controller
          }));
        })
        .catch(() => {});

      const handleControllerChange = () => {
        setStatus(prev => ({ ...prev, serviceWorkerControlled: !!navigator.serviceWorker.controller, canInstall: prev.isHTTPS && prev.manifestLoaded && !!navigator.serviceWorker.controller }));
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      // Listen for updatefound to catch activating -> active
      let stopListening = () => {};
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        const onUpdateFound = () => {
          const sw = reg.installing || reg.waiting || reg.active;
          if (sw) {
            sw.addEventListener('statechange', () => {
              setStatus(prev => ({
                ...prev,
                serviceWorkerActive: !!reg.active,
              }));
            });
          }
        };
        reg.addEventListener('updatefound', onUpdateFound as any);
        stopListening = () => reg.removeEventListener('updatefound', onUpdateFound as any);
      });

      return () => {
        try { navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange); } catch {}
        try { stopListening(); } catch {}
      };
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA Debug: beforeinstallprompt fired!', e);
      setStatus(prev => ({ ...prev, beforeInstallPromptFired: true, isInstallable: true, canInstall: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const StatusIcon = ({ condition }: { condition: boolean }) => {
    return condition ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setShowDebugger(!showDebugger)}
        className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg z-50"
        title="PWA Debugger"
      >
        <Info className="w-5 h-5" />
      </button>

      {/* Debug Panel */}
      {showDebugger && (
        <div className="fixed bottom-16 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 z-50 w-80">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">PWA Debug Status</h3>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">HTTPS/Localhost:</span>
              <StatusIcon condition={status.isHTTPS} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Manifest Loaded:</span>
              <StatusIcon condition={status.manifestLoaded} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Required Icons:</span>
              <StatusIcon condition={status.hasRequiredIcons} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Service Worker:</span>
              <StatusIcon condition={status.serviceWorkerRegistered} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">SW Active:</span>
              <StatusIcon condition={status.serviceWorkerActive} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Page Controlled by SW:</span>
              <StatusIcon condition={status.serviceWorkerControlled} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Install Prompt:</span>
              <StatusIcon condition={status.beforeInstallPromptFired} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Installable:</span>
              <StatusIcon condition={status.canInstall || status.isInstallable} />
            </div>
          </div>

            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded text-xs">
            <div className="font-medium mb-1 text-gray-900 dark:text-gray-100">Debug Info:</div>
            <div className="text-gray-600 dark:text-gray-400">
              <div>Location: {location.protocol}//{location.host}</div>
              <div>User Agent: {navigator.userAgent.slice(0, 40)}...</div>
              <div>Service Worker Support: {'serviceWorker' in navigator ? 'Yes' : 'No'}</div>
              <div>SW Error: {(window as any).__pwaLastError || 'none'}</div>
              <div>
                <button
                  className="mt-2 text-xs bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                  onClick={async () => {
                    if ('serviceWorker' in navigator) {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      console.table(regs.map(r => ({ scope: r.scope, active: !!r.active, installing: !!r.installing, waiting: !!r.waiting })));
                    }
                  }}
                >Log SW registrations</button>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button
              onClick={async () => {
                const evt = (window as any).__deferredInstallPrompt as any;
                if (!evt) { console.info('[PWA] No deferred prompt available'); return; }
                try {
                  await evt.prompt?.();
                  const choice = await evt.userChoice?.();
                  console.info('[PWA] install choice', choice);
                } catch (e) {
                  console.warn('[PWA] install prompt failed', e);
                }
              }}
              className="w-full text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded"
            >Install App</button>
            <button
              onClick={() => window.location.reload()}
              className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded"
            >
              Reload Page
            </button>
            <button
              onClick={() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => registration.unregister());
                    window.location.reload();
                  });
                }
              }}
              className="w-full text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded"
            >
              Clear SW & Reload
            </button>
          </div>
        </div>
      )}
    </>
  );
};