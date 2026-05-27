import React from 'react';
import { RefreshCw, ServerCrash } from 'lucide-react';

interface ServerConnectionScreenProps {
  onRetry: () => void;
  retrying?: boolean;
}

export function ServerConnectionScreen({ onRetry, retrying = false }: ServerConnectionScreenProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-gray-50 dark:bg-black">
      <div className="w-full max-w-md text-center space-y-6">
        <img src="/kiwi.png" alt="Kiwi" className="w-16 h-16 mx-auto" />
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-gray-800 dark:text-gray-200">
            <ServerCrash className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-semibold">Kiwi is not running yet</h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            The app could not connect to Kiwi&apos;s server. If you use Docker, make sure it is
            running and you have started Kiwi (<strong>docker-start.bat</strong> or{' '}
            <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800">docker compose up -d</code>).
          </p>
        </div>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Connecting…' : 'Try again'}
        </button>
        <details className="text-left text-xs text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
            Advanced: running without Docker
          </summary>
          <p className="mt-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
            From the Kiwi folder, run <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800">npm start</code>
            {' '}then open http://localhost:3000
          </p>
        </details>
      </div>
    </div>
  );
}
