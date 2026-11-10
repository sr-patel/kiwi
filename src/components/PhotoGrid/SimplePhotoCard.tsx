import React, { useEffect, useRef, useState } from 'react';
import { PhotoMetadata } from '@/types';
import { libraryService } from '@/services/libraryService';
import { useAppStore } from '@/store';
import { getAccentRing } from '@/utils/accentColors';
import { isVideoFile } from '@/utils/fileTypes';
import { Play } from 'lucide-react';

interface SimplePhotoCardProps {
  photo: PhotoMetadata;
  size: 'small' | 'medium' | 'large';
  onOpen: (photo: PhotoMetadata) => void;
  isMobile?: boolean;
  isAboveFold?: boolean;
  index?: number;
  /** Roving tabindex: only the grid's active card is in the tab order. */
  tabIndex?: number;
}

const MIN_ASPECT = 0.5;
const MAX_ASPECT = 2.4;

/** Server-rendered thumbnail widths per card size (matching the masonry columns). */
const THUMBNAIL_WIDTHS_BY_SIZE = {
  small: [200, 400],
  medium: [300, 600],
  large: [400, 800],
} as const;

const THUMBNAIL_SIZES_BY_SIZE = {
  small: '(max-width: 600px) 50vw, (max-width: 1200px) 16vw, 12vw',
  medium: '(max-width: 600px) 50vw, (max-width: 1200px) 25vw, 18vw',
  large: '(max-width: 600px) 50vw, (max-width: 1200px) 34vw, 26vw',
} as const;

/**
 * Cards are the most-rendered component in the app. This component used to
 * subscribe to the *entire* Zustand store, so any store write (a scroll
 * position, the audio clock four times a second) re-rendered every card on
 * screen. Selectors plus `memo` keep it to its own props.
 */
const SimplePhotoCardImpl: React.FC<SimplePhotoCardProps> = ({
  photo,
  size,
  onOpen,
  isMobile = false,
  isAboveFold = false,
  index = 0,
  tabIndex = 0,
}) => {
  const accentColor = useAppStore((state) => state.accentColor);
  const detailedPhoto = useAppStore((state) => state.detailedPhoto);
  const autoplayGifsInGrid = useAppStore((state) => state.autoplayGifsInGrid ?? false);

  const cardRef = useRef<HTMLDivElement>(null);
  const isVideo = isVideoFile(photo.ext);

  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(isAboveFold || !isVideo);

  const thumbnailUrl = libraryService.getPhotoThumbnailUrl(photo.id, photo.name);
  const thumbnailSrcSet = libraryService.getPhotoThumbnailSrcSet(
    photo.id,
    photo.name,
    THUMBNAIL_WIDTHS_BY_SIZE[size],
  );
  const thumbnailSizes = THUMBNAIL_SIZES_BY_SIZE[size];
  const fileUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
  const [imageSrc, setImageSrc] = useState(thumbnailUrl);

  // Reset per-photo state without re-running on every render.
  useEffect(() => {
    setImageError(false);
    setVideoError(false);
    setImageSrc(thumbnailUrl);
    setIsLoading(!isVideo);
  }, [photo.id, isVideo, thumbnailUrl]);

  // Attach the video source only when the card is near the viewport. Setting
  // `src` on every video card made large folders fetch every video at once.
  useEffect(() => {
    if (!isVideo || shouldLoadVideo) return;
    const element = cardRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldLoadVideo(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadVideo(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isVideo, shouldLoadVideo]);

  const handleOpen = () => onOpen(photo);

  // Thumbnail missing or corrupt: fall back to the trusted original once.
  const handleImageError = () => {
    if (!imageError) {
      setImageError(true);
      setImageSrc(fileUrl);
    }
    setIsLoading(false);
  };

  const handleImageLoad = () => setIsLoading(false);

  const handleVideoError = () => {
    setVideoError(true);
    setIsLoading(false);
  };

  const isActive = detailedPhoto === photo.id;
  const rawAspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1;
  const safeAspect = Number.isFinite(rawAspect) ? Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, rawAspect)) : 1;

  const renderMediaContent = () => {
    if (isVideo) {
      if (videoError) {
        return (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            <Play className="h-6 w-6" />
          </div>
        );
      }
      return (
        <>
          {isLoading && <div className="shimmer absolute inset-0" />}
          <video
            src={shouldLoadVideo ? fileUrl : undefined}
            className="media-reveal h-full w-full object-cover"
            data-loaded={!isLoading}
            preload="metadata"
            muted
            playsInline
            onError={handleVideoError}
            onLoadedData={handleImageLoad}
          />
        </>
      );
    }

    const isGif = photo.ext?.toLowerCase() === 'gif' || photo.name.toLowerCase().endsWith('.gif');
    // GIFs stay on the static thumbnail unless grid autoplay is enabled.
    const effectiveSrc = isGif && !autoplayGifsInGrid ? thumbnailUrl : imageSrc;

    return (
      <>
        {isLoading && <div className="shimmer absolute inset-0" />}
        <img
          src={effectiveSrc}
          srcSet={imageError ? undefined : thumbnailSrcSet}
          sizes={imageError ? undefined : thumbnailSizes}
          alt={photo.name}
          className="media-reveal h-full w-full object-cover"
          data-loaded={!isLoading}
          width={photo.width || undefined}
          height={photo.height || undefined}
          decoding="async"
          loading={isAboveFold ? 'eager' : 'lazy'}
          fetchPriority={isAboveFold ? 'high' : 'auto'}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      </>
    );
  };

  return (
    <div
      ref={cardRef}
      className={`group relative cursor-pointer overflow-hidden rounded-lg transition-shadow duration-200 hover:shadow-md ${
        isActive
          ? `${getAccentRing(accentColor)} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900`
          : ''
      }`}
      style={{ width: '100%', aspectRatio: `${safeAspect}` }}
      role="button"
      tabIndex={tabIndex}
      data-grid-index={index}
      aria-label={`Open ${photo.name}`}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpen();
        }
      }}
    >
      <div className="relative h-full w-full">
        {renderMediaContent()}

        {isVideo && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="rounded-full bg-white/90 p-2">
              <Play className="h-4 w-4 text-gray-800" />
            </div>
          </div>
        )}

        {/* Info overlay: hover on pointer devices, always visible on touch. */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-200 ${
            isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          <div className="absolute inset-x-0 bottom-0 p-3 text-white">
            <h3 className="truncate text-sm font-medium">{photo.name}</h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-300">
              <span>{libraryService.formatFileSize(photo.size)}</span>
              <span aria-hidden>•</span>
              <span>{libraryService.getFileType(photo.ext)}</span>
            </div>

            {photo.tags && photo.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {photo.tags.slice(0, 3).map((tag, tagIndex) => (
                  <span
                    key={`${tag}-${tagIndex}`}
                    className="rounded-full bg-black/50 px-2 py-1 text-xs text-white"
                  >
                    {tag}
                  </span>
                ))}
                {photo.tags.length > 3 && (
                  <span className="rounded-full bg-black/50 px-2 py-1 text-xs text-white">
                    +{photo.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SimplePhotoCard = React.memo(SimplePhotoCardImpl);
SimplePhotoCard.displayName = 'SimplePhotoCard';
