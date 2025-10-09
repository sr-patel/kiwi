import React from 'react';

interface EpubViewerProps {
  fileUrl: string;
}

declare global {
  interface Window {
    ePub?: any;
  }
}

export const EpubViewer: React.FC<EpubViewerProps> = ({ fileUrl }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const bookRef = React.useRef<any>(null);
  const renditionRef = React.useRef<any>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const ensureScript = React.useCallback(async (url: string, attr: string) => {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[${attr}="true"]`) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${url}`)));
        // If it's already loaded
        if ((existing as any).readyState === 'complete' || (existing as any).readyState === 'loaded') resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.defer = true;
      script.setAttribute(attr, 'true');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.body.appendChild(script);
    });
  }, []);

  const ensureEpubJsLoaded = React.useCallback(async () => {
    // Load JSZip first (epub.js depends on it when reading zipped resources)
    if (!(window as any).JSZip) {
      await ensureScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', 'data-jszip');
    }
    // Then load epub.js
    if (typeof window === 'undefined' || window.ePub) return;
    await ensureScript('https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js', 'data-epubjs');
  }, [ensureScript]);

  React.useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        setLoading(true);
        setError(null);
        await ensureEpubJsLoaded();
        if (cancelled) return;

        // Fetch the EPUB as binary to ensure epub.js reads from zip, not directory
        const resp = await fetch(fileUrl, { credentials: 'same-origin' });
        if (!resp.ok) throw new Error(`Failed to fetch EPUB: ${resp.status} ${resp.statusText}`);
        const ab = await resp.arrayBuffer();

        const book = window.ePub!(ab);
        const container = containerRef.current!;
        const rendition = book.renderTo(container, {
          width: '100%',
          height: '100%'
        });
        await rendition.display();
        if (cancelled) return;
        bookRef.current = book;
        renditionRef.current = rendition;
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load EPUB');
          setLoading(false);
        }
      }
    };
    setup();
    return () => {
      cancelled = true;
      try {
        renditionRef.current?.destroy?.();
        bookRef.current?.destroy?.();
      } catch {}
    };
  }, [fileUrl, ensureEpubJsLoaded]);

  const goPrev = React.useCallback(() => {
    renditionRef.current?.prev?.();
  }, []);
  const goNext = React.useCallback(() => {
    renditionRef.current?.next?.();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={goPrev}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded"
        >
          Prev
        </button>
        <button
          onClick={goNext}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded"
        >
          Next
        </button>
        <button
          onClick={() => window.open(fileUrl, '_blank')}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Open in new tab
        </button>
      </div>
      <div
        ref={containerRef}
        className="bg-white text-black"
        style={{ width: '90vw', height: '80vh', borderRadius: 8, overflow: 'hidden' }}
      >
        {loading && !error && (
          <div className="w-full h-full flex items-center justify-center text-gray-600">Loading EPUB…</div>
        )}
        {error && (
          <div className="w-full h-full flex flex-col items-center justify-center text-red-400">
            <div className="mb-2">{error}</div>
            <button
              onClick={() => window.open(fileUrl, '_blank')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Open in new tab
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

