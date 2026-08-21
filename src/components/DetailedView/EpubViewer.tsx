import React from 'react';
import type { Book, Rendition } from 'epubjs';
import { apiRequest } from '@/services/apiClient';

interface EpubViewerProps {
  fileUrl: string;
}

export const EpubViewer: React.FC<EpubViewerProps> = ({ fileUrl }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const bookRef = React.useRef<Book | null>(null);
  const renditionRef = React.useRef<Rendition | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const setup = async () => {
      try {
        setLoading(true);
        setError(null);
        const [{ default: ePub }, ab] = await Promise.all([
          import('epubjs'),
          apiRequest<ArrayBuffer>(fileUrl, {
            signal: controller.signal,
            headers: { Accept: 'application/epub+zip' },
            parseResponse: (response) => response.arrayBuffer(),
          }),
        ]);
        if (controller.signal.aborted) return;

        const book = ePub(ab);
        const container = containerRef.current!;
        const rendition = book.renderTo(container, {
          width: '100%',
          height: '100%',
        });
        await rendition.display();
        if (controller.signal.aborted) return;
        bookRef.current = book;
        renditionRef.current = rendition;
        setLoading(false);
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Failed to load EPUB');
          setLoading(false);
        }
      }
    };
    setup();
    return () => {
      controller.abort();
      try {
        renditionRef.current?.destroy?.();
        bookRef.current?.destroy?.();
      } catch {}
    };
  }, [fileUrl]);

  const goPrev = React.useCallback(() => {
    renditionRef.current?.prev?.();
  }, []);
  const goNext = React.useCallback(() => {
    renditionRef.current?.next?.();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={goPrev} className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded">
          Prev
        </button>
        <button onClick={goNext} className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded">
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
