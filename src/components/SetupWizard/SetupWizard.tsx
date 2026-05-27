import React, { useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import {
  FolderOpen, CheckCircle, AlertCircle, Loader, ArrowRight, ArrowLeft, Info,
} from 'lucide-react';
import { LibraryFolderPicker } from './LibraryFolderPicker';

interface ValidationResult {
  valid: boolean;
  reason?: string;
  hint?: string;
}

interface SetupWizardProps {
  onComplete: () => void;
}

type WizardStep = 0 | 1 | 2;

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const { accentColor, theme } = useAppStore();
  const accent = getAccentHex(accentColor);

  const [step, setStep] = useState<WizardStep>(0);
  const [libraryPath, setLibraryPath] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<'idle' | 'working' | 'invalid'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [buildMessage, setBuildMessage] = useState('Initializing…');

  const handleContinueFromStep1 = useCallback(async () => {
    if (!libraryPath.trim()) {
      setError('Please select your Eagle library folder.');
      setStatus('invalid');
      return;
    }

    setStatus('working');
    setError(null);
    setHint(null);

    try {
      const validateRes = await fetch('/api/config/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryPath: libraryPath.trim() }),
      });
      const validation: ValidationResult = await validateRes.json();

      if (!validation.valid) {
        setStatus('invalid');
        setError(validation.reason || 'Invalid library folder');
        setHint(validation.hint || null);
        return;
      }

      const saveRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryPath: libraryPath.trim() }),
      });
      const saveData = await saveRes.json();

      if (!saveData.success) {
        setStatus('invalid');
        setError('Could not save your library path. Try again.');
        return;
      }

      setStep(2);
      setStatus('idle');

      const start = Date.now();
      const maxWait = 120_000;

      const poll = async (): Promise<void> => {
        if (Date.now() - start > maxWait) {
          onComplete();
          return;
        }

        try {
          const statusRes = await fetch('/api/database/status');
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const count = statusData.totalPhotos || 0;
            setPhotoCount(count);
            if (count > 0) {
              setBuildMessage(`Found ${count.toLocaleString()} photos`);
              setTimeout(onComplete, 800);
              return;
            }
            if (statusData.exists) {
              setBuildMessage('Library is ready (no photos yet)');
              setTimeout(onComplete, 800);
              return;
            }
          }
        } catch {
          // still initializing
        }

        setBuildMessage('Indexing your photos… large libraries can take a few minutes');
        await new Promise((r) => setTimeout(r, 2000));
        return poll();
      };

      await poll();
    } catch {
      setStatus('invalid');
      setError('Could not connect to Kiwi. Make sure Docker or the server is running.');
    }
  }, [libraryPath, onComplete]);

  if (step === 2) {
    const progress = photoCount > 0 ? Math.min(95, 20 + Math.log10(photoCount + 1) * 25) : 15;
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 px-4"
        style={{ backgroundColor: theme === 'dark' ? '#000' : '#f9fafb' }}
      >
        <img src="/kiwi.png" alt="Kiwi" className="w-16 h-16" />
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Loader className="w-5 h-5 animate-spin" style={{ color: accent }} />
            <span className="text-lg font-medium text-gray-800 dark:text-gray-200">
              Getting your library ready
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{buildMessage}</p>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{ width: `${progress}%`, backgroundColor: accent }}
            />
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Continue in background
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: theme === 'dark' ? '#000' : '#f9fafb' }}
    >
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <img src="/kiwi.png" alt="Kiwi" className="w-14 h-14 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to Kiwi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Step {step + 1} of 2 — {step === 0 ? 'Before you start' : 'Choose your library'}
          </p>
        </div>

        {step === 0 && (
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 space-y-4 shadow-sm">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  Kiwi browses photo libraries created in <strong className="text-gray-800 dark:text-gray-200">Eagle</strong>.
                  You need an existing Eagle library (a folder ending in <code className="px-1 rounded bg-gray-100 dark:bg-gray-800">.library</code>).
                </p>
                <p>
                  Eagle can stay open on your computer. Kiwi reads the same files and keeps them in sync automatically.
                </p>
                <p className="text-xs text-gray-500">
                  To find your library in Eagle: <strong>Library → Manage library</strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2"
              style={{ backgroundColor: accent }}
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <>
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 space-y-4 shadow-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Eagle library
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Browse to your <code className="px-1 rounded bg-gray-100 dark:bg-gray-800">.library</code> folder.
                  If you use Docker, it appears under the libraries folder you mounted.
                </p>
                <LibraryFolderPicker
                  selectedPath={libraryPath}
                  onSelect={(path) => {
                    setLibraryPath(path);
                    setStatus('idle');
                    setError(null);
                    setHint(null);
                  }}
                  accentColor={accent}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showAdvanced ? 'Hide' : 'Show'} advanced path entry
              </button>

              {showAdvanced && (
                <div className="relative">
                  <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={libraryPath}
                    onChange={(e) => {
                      setLibraryPath(e.target.value);
                      setStatus('idle');
                      setError(null);
                      setHint(null);
                    }}
                    placeholder="/app/data/libraries/MyPhotos.library"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              {error && (
                <div className="text-sm text-red-500 dark:text-red-400 space-y-1">
                  <p className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </p>
                  {hint && <p className="text-xs text-gray-500 pl-5">{hint}</p>}
                </div>
              )}

              {libraryPath && status !== 'invalid' && (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Library folder selected
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleContinueFromStep1}
                disabled={!libraryPath.trim() || status === 'working'}
                className="flex-1 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                {status === 'working' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
