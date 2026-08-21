import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Tag, Link2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import { usePhotosByTag } from '@/hooks/usePhotosByTag';
import { usePhotosByTags } from '@/hooks/usePhotosByTags';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import { generateTagUrl } from '@/utils/tagUrls';
import { isVideoFile } from '@/utils/fileTypes';
import type { PhotoMetadata } from '@/types';
import type { NetworkSelection } from '@/pages/network/types';

interface TagPhotoPanelProps {
  selection: NetworkSelection;
  tagCount: number;
  accentHex: string;
  onClose: () => void;
}

function PanelThumbnail({
  photo,
  accentHex,
  onOpen,
}: {
  photo: PhotoMetadata;
  accentHex: string;
  onOpen: (photo: PhotoMetadata) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const aspectRatio = photo.width && photo.height && photo.height > 0 ? photo.width / photo.height : 1;

  useEffect(() => {
    const url = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
    setSrc(url);
  }, [photo.id, photo.ext, photo.name]);

  return (
    <button
      type="button"
      onClick={() => onOpen(photo)}
      className="group relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      style={{
        aspectRatio: aspectRatio.toString(),
        ['--tw-ring-color' as string]: accentHex,
      }}
    >
      {src ? (
        isVideoFile(photo.ext) ? (
          <video src={src} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        ) : (
          <img src={src} alt={photo.name} className="h-full w-full object-cover" loading="lazy" />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">…</div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-left text-[10px] text-zinc-200">{photo.name}</p>
      </div>
    </button>
  );
}

export function TagPhotoPanel({ selection, tagCount, accentHex, onClose }: TagPhotoPanelProps) {
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { setCurrentTag, setCurrentFolder, setDetailedPhoto, setNavigationList, saveScrollPosition } =
    useAppStore();

  const singleTag = selection?.kind === 'tag' ? selection.tag : null;
  const linkTags = selection?.kind === 'link' ? [selection.source, selection.target] : [];

  const tagQuery = usePhotosByTag({
    tag: singleTag,
    enabled: selection?.kind === 'tag',
  });

  const tagsQuery = usePhotosByTags({
    tags: linkTags,
    enabled: selection?.kind === 'link',
  });

  const activeQuery = selection?.kind === 'tag' ? tagQuery : tagsQuery;
  const photos = useMemo(
    () => activeQuery.data?.pages.flatMap((page) => page.photos) ?? [],
    [activeQuery.data?.pages],
  );
  const totalCount = selection?.kind === 'link' ? tagsQuery.total : tagCount;

  const fetchNextPageRef = useRef(activeQuery.fetchNextPage);
  const hasNextPageRef = useRef(activeQuery.hasNextPage);
  const isFetchingRef = useRef(activeQuery.isFetchingNextPage);
  fetchNextPageRef.current = activeQuery.fetchNextPage;
  hasNextPageRef.current = activeQuery.hasNextPage;
  isFetchingRef.current = activeQuery.isFetchingNextPage;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !selection) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPageRef.current && !isFetchingRef.current) {
          fetchNextPageRef.current();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [selection, activeQuery.hasNextPage, activeQuery.isFetchingNextPage]);

  const handleOpenPhoto = useCallback(
    (photo: PhotoMetadata) => {
      saveScrollPosition(0);
      setCurrentFolder(null);
      if (selection?.kind === 'tag') {
        setCurrentTag(selection.tag);
      } else if (selection?.kind === 'link') {
        setCurrentTag(null);
      }
      setNavigationList(photos.map((p) => p.id));
      setDetailedPhoto(photo.id);
    },
    [
      selection,
      photos,
      saveScrollPosition,
      setCurrentFolder,
      setCurrentTag,
      setNavigationList,
      setDetailedPhoto,
    ],
  );

  const handleBrowseTag = () => {
    if (selection?.kind !== 'tag') return;
    navigate(generateTagUrl(selection.tag));
  };

  return (
    <AnimatePresence>
      {selection && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="absolute right-0 top-0 z-20 flex h-full w-[min(420px,40vw)] flex-col border-l border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-sm"
        >
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4">
            <div className="min-w-0">
              {selection.kind === 'tag' ? (
                <>
                  <div className="mb-1 flex items-center gap-2 text-zinc-400">
                    <Tag className="h-4 w-4 shrink-0" style={{ color: accentHex }} />
                    <span className="text-xs uppercase tracking-wide">Selected tag</span>
                  </div>
                  <h2 className="truncate text-lg font-semibold text-zinc-100">#{selection.tag}</h2>
                </>
              ) : (
                <>
                  <div className="mb-1 flex items-center gap-2 text-zinc-400">
                    <Link2 className="h-4 w-4 shrink-0" style={{ color: accentHex }} />
                    <span className="text-xs uppercase tracking-wide">Co-tagged</span>
                  </div>
                  <h2 className="truncate text-lg font-semibold text-zinc-100">
                    #{selection.source} <span className="font-normal text-zinc-500">+</span> #
                    {selection.target}
                  </h2>
                </>
              )}
              <p className="mt-1 text-sm text-zinc-500">{totalCount.toLocaleString()} items in library</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {selection.kind === 'tag' && (
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
              <span className="text-sm text-zinc-400">Recent items</span>
              <button
                type="button"
                onClick={handleBrowseTag}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900"
              >
                Browse all
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            {activeQuery.loading && photos.length === 0 && (
              <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
                Loading photos…
              </div>
            )}

            {activeQuery.error && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
                {activeQuery.error}
              </div>
            )}

            {!activeQuery.loading && !activeQuery.error && photos.length === 0 && (
              <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
                {selection.kind === 'tag' ? 'No photos found for this tag' : 'No photos found with both tags'}
              </div>
            )}

            {photos.length > 0 && (
              <>
                <Masonry
                  breakpointCols={{ default: 2 }}
                  className="my-masonry-grid"
                  columnClassName="my-masonry-grid_column"
                >
                  {photos.map((photo) => (
                    <div key={photo.id}>
                      <PanelThumbnail photo={photo} accentHex={accentHex} onOpen={handleOpenPhoto} />
                    </div>
                  ))}
                </Masonry>
                <div ref={loadMoreRef} className="h-4" />
                {activeQuery.isFetchingNextPage && (
                  <div className="flex items-center justify-center py-4 text-sm text-zinc-500">
                    Loading more…
                  </div>
                )}
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
