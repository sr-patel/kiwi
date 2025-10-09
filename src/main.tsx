import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      networkMode: 'online',
    },
  },
})

// Service worker registration is handled by VitePWA's injected registerSW script in production builds.
// In dev, explicitly register the SW to enable PWA testing on localhost.
if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV) {
  // dynamic import keeps types happy in non-Vite contexts
  // @ts-ignore
  // Directly register the static dev SW; we disabled VitePWA dev SW to avoid redundancy
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw-dev.js', { scope: '/' })
      .then(reg => {
        console.info('[PWA] Dev SW registered:', reg.scope);
        if (!navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true } as any);
        }
      })
      .catch(e => console.warn('[PWA] Dev SW registration failed:', e));
  }
}

// Capture the install prompt globally so any screen can trigger it
(() => {
  let installed = false;
  try {
    window.addEventListener('appinstalled', () => {
      (window as any).__deferredInstallPrompt = undefined;
      installed = true;
    });
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Only capture if not already installed
      if (installed) return;
      e.preventDefault();
      (window as any).__deferredInstallPrompt = e;
      console.info('[PWA] beforeinstallprompt captured');
    });
  } catch {}
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
) 