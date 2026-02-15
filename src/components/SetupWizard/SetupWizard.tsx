import React, { useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import { FolderOpen, CheckCircle, AlertCircle, Loader, ArrowRight } from 'lucide-react';

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const { accentColor, theme } = useAppStore();
  const accent = getAccentHex(accentColor);

  const [libraryPath, setLibraryPath] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'saving' | 'building'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [buildProgress, setBuildProgress] = useState<string | null>(null);

  const validate = useCallback(async () => {
    if (!libraryPath.trim()) {
      setError('Please enter a library path.');
      setStatus('invalid');
      return;
    }

    setStatus('validating');
    setError(null);

    try {
      const res = await fetch('/api/config/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryPath: libraryPath.trim() }),
      });
      const data: ValidationResult = await res.json();

      if (data.valid) {
        setStatus('valid');
        setError(null);
      } else {
        setStatus('invalid');
        setError(data.reason || 'Invalid library path');
      }
    } catch (err) {
      setStatus('invalid');
      setError('Could not connect to the server. Make sure the backend is running.');
    }
  }, [libraryPath]);

  const handleSave = useCallback(async () => {
    setStatus('saving');
    setError(null);

    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryPath: libraryPath.trim() }),
      });
      const data = await res.json();

      if (!data.success) {
        setStatus('invalid');
        setError('Failed to save configuration.');
        return;
      }

      // Server will auto-build the database if needed.
      // We show a building state briefly, then complete.
      setStatus('building');
      setBuildProgress('Initializing database...');

      // Poll until database is ready (max 120s)
      const start = Date.now();
      const maxWait = 120_000;

      const poll = async (): Promise<void> => {
        if (Date.now() - start > maxWait) {
          setBuildProgress(null);
          onComplete();
          return;
        }

        try {
          const statusRes = await fetch('/api/database/status');
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.totalPhotos > 0) {
              setBuildProgress(`Found ${statusData.totalPhotos.toLocaleString()} photos`);
              setTimeout(onComplete, 800);
              return;
            }
          }
        } catch {
          // Server may still be initializing
        }

        setBuildProgress('Building database... this may take a moment');
        await new Promise(r => setTimeout(r, 2000));
        return poll();
      };

      await poll();
    } catch (err) {
      setStatus('invalid');
      setError('Failed to save configuration. Check server connection.');
    }
  }, [libraryPath, onComplete]);

  const statusIcon = () => {
    switch (status) {
      case 'validating':
      case 'saving':
        return <Loader className="w-5 h-5 animate-spin text-gray-400" />;
      case 'valid':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'invalid':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FolderOpen className="w-5 h-5 text-gray-400" />;
    }
  };

  if (status === 'building') {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6"
        style={{
          backgroundColor: theme === 'dark' ? '#000' : '#f9fafb',
        }}
      >
        <img src="/kiwi.png" alt="Kiwi" className="w-16 h-16" />
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Loader className="w-5 h-5 animate-spin" style={{ color: accent }} />
            <span className="text-lg font-medium text-gray-800 dark:text-gray-200">
              Setting up your library
            </span>
          </div>
          {buildProgress && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{buildProgress}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        backgroundColor: theme === 'dark' ? '#000' : '#f9fafb',
      }}
    >
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src="/kiwi.png" alt="Kiwi" className="w-16 h-16 mx-auto" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Welcome to Kiwi
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Point Kiwi to your Eagle photo library to get started.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 space-y-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Library Path
          </label>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={libraryPath}
                onChange={(e) => {
                  setLibraryPath(e.target.value);
                  if (status !== 'idle') setStatus('idle');
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && validate()}
                placeholder="C:\Photos\myLibrary.library"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 transition-shadow"
                style={{ focusRingColor: accent } as React.CSSProperties}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                {statusIcon()}
              </div>
            </div>

            <button
              onClick={validate}
              disabled={status === 'validating' || status === 'saving' || !libraryPath.trim()}
              className="px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: accent }}
            >
              Verify
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </p>
          )}

          {status === 'valid' && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Valid Eagle library detected
            </p>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            This should be the full path to your <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">.library</code> folder containing <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">metadata.json</code> and an <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">images/</code> directory.
          </p>
        </div>

        {/* Continue button */}
        <button
          onClick={handleSave}
          disabled={status !== 'valid'}
          className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-30"
          style={{ backgroundColor: accent }}
        >
          Get Started
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SetupWizard;
