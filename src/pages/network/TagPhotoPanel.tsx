import { useEffect, useState } from 'react';
import { X, Tag, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePhotosByTag } from '@/hooks/usePhotosByTag';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import { generateTagUrl } from '@/utils/tagUrls';
import { isVideoFile } from '@/utils/fileTypes';
import type { PhotoMetadata } from '@/types';

interface TagPhotoPanelProps {
  tag: string | null;
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

  useEffect(() => {
    const url = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
    setSrc(url);
  }, [photo.id, photo.ext, photo.name]);

  return (
    <button
      type="button"
      onClick={() => onOpen(photo)}
      className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      style={{ ['--tw-ring-color' as string]: accentHex }}
    >
      {src ? (
        isVideoFile(photo.ext) ? (
          <video
            src={src}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img src={src} alt={photo.name} className="h-full w-full object-cover" loading="lazy" />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
          …
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-left text-[10px] text-zinc-200">{photo.name}</p>
      </div>
    </button>
  );
}

export function TagPhotoPanel({ tag, tagCount, accentHex, onClose }: TagPhotoPanelProps) {
  const navigate = useNavigate();
  const { setCurrentTag, setCurrentFolder, setDetailedPhoto, saveScrollPosition } = useAppStore();

  const { data, loading, error } = usePhotosByTag({
    tag,
    limit: 20,
    enabled: !!tag,
  });

  const photos = data?.pages.flatMap((page) => page.photos) ?? [];

  const handleOpenPhoto = (photo: PhotoMetadata) => {
    if (!tag) return;
    saveScrollPosition(0);
    setCurrentFolder(null);
    setCurrentTag(tag);
    setDetailedPhoto(photo.id);
  };

  const handleBrowseTag = () => {
    if (!tag) return;
    navigate(generateTagUrl(tag));
  };

  return (
    <AnimatePresence>
      {tag && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-sm"
        >
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-zinc-400">
                <Tag className="h-4 w-4 shrink-0" style={{ color: accentHex }} />
                <span className="text-xs uppercase tracking-wide">Selected tag</span>
              </div>
              <h2 className="truncate text-lg font-semibold text-zinc-100">#{tag}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {tagCount.toLocaleString()} items in library
              </p>
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

          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
                Loading photos…
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {!loading && !error && photos.length === 0 && (
              <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
                No photos found for this tag
              </div>
            )}

            {!loading && photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {photos.slice(0, 20).map((photo) => (
                  <PanelThumbnail
                    key={photo.id}
                    photo={photo}
                    accentHex={accentHex}
                    onOpen={handleOpenPhoto}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
