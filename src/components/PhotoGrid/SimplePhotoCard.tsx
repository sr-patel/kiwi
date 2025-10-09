import React, { useState, useCallback } from 'react';
import { PhotoMetadata } from '@/types';
import { libraryService } from '@/services/libraryService';
import { useAppStore } from '@/store';
import { getAccentColor, getAccentRing } from '@/utils/accentColors';
import { isVideoFile } from '@/utils/fileTypes';
import { Play } from 'lucide-react';
import { sequentialImageLoader } from '@/services/sequentialImageLoader';

interface SimplePhotoCardProps {
  photo: PhotoMetadata;
  size: 'small' | 'medium' | 'large';
  onDoubleClick: (photo: PhotoMetadata) => void;
  isMobile?: boolean;
  isAboveFold?: boolean; // For eager loading of first row
  index?: number; // Index in the grid for sequential loading
}

export const SimplePhotoCard: React.FC<SimplePhotoCardProps> = ({
  photo,
  size,
  onDoubleClick,
  isMobile = false,
  isAboveFold = false,
  index = 0,
}) => {
  const { setDetailedPhoto, accentColor, currentFolder, detailedPhoto } = useAppStore();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load image sequentially
  React.useEffect(() => {
    // If already have a resolved source, don't re-queue on reorder/pagination
    if (imageSrc) {
      return;
    }
    if (isVideoFile(photo.ext)) {
      // For videos, load immediately
      const videoUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
      setImageSrc(videoUrl);
      setIsLoading(false);
      return;
    }

    // For images, use sequential loading
    const priority = isAboveFold ? 'high' : 'normal';
    
    sequentialImageLoader.addToQueue(
      photo.id,
      photo.name,
      (url: string) => {
        setImageSrc(url);
        // Keep isLoading true until <img> onLoad fires to show placeholder
      },
      index,
      priority
    );

    // Fallback: if image doesn't load within 15 seconds, try direct loading of full image
    const fallbackTimeout = setTimeout(() => {
      if (isLoading && !imageSrc) {
        console.log(`SimplePhotoCard: Fallback loading full image for ${photo.id}`);
        const fullImageUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
        setImageSrc(fullImageUrl);
        setIsLoading(false);
      }
    }, 15000);

    return () => clearTimeout(fallbackTimeout);
  }, [photo.id, photo.name, photo.ext, imageSrc]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const { saveScrollPosition } = useAppStore.getState();
    saveScrollPosition(window.scrollY);
    // Route opening through parent so it can capture navigationList order
    onDoubleClick(photo);
  }, [photo, onDoubleClick]);


  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    console.log('SimplePhotoCard: Image failed to load:', imageSrc, 'Error:', e);
    if (!imageError) {
      const fallbackUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
      console.log('SimplePhotoCard: Trying fallback URL:', fallbackUrl);
      setImageError(true);
      setImageSrc(fallbackUrl);
    } else {
      console.log('SimplePhotoCard: Fallback also failed, no more attempts');
    }
    setIsLoading(false);
  }, [imageError, photo.id, photo.ext, photo.name, imageSrc]);

  const handleImageLoad = useCallback(() => {
    console.log('Image loaded successfully:', imageSrc);
    setIsLoading(false);
  }, [imageSrc]);

  // Generate responsive srcset for thumbnails
  // TODO: Implement when server supports size parameters
  const generateSrcSet = useCallback(() => {
    // For now, just return the single thumbnail URL
    // When server supports it, uncomment below:
    // const baseUrl = libraryService.getPhotoThumbnailUrl(photo.id, photo.name);
    // const sizes = [300, 600, 900];
    // return sizes.map(size => `${baseUrl}&size=${size} ${size}w`).join(', ');
    return undefined; // No srcset for now
  }, [photo.id, photo.name]);

  // Generate sizes attribute based on viewport and thumbnail size
  const generateSizes = useCallback(() => {
    if (isMobile) {
      return '(max-width: 600px) 50vw, 25vw';
    }
    
    switch (size) {
      case 'small':
        return '(max-width: 1200px) 20vw, (max-width: 1600px) 15vw, 12vw';
      case 'large':
        return '(max-width: 1200px) 40vw, (max-width: 1600px) 30vw, 25vw';
      default: // medium
        return '(max-width: 1200px) 30vw, (max-width: 1600px) 25vw, 20vw';
    }
  }, [isMobile, size]);

  const handleVideoError = useCallback(() => {
    setVideoError(true);
    setIsLoading(false);
  }, []);

  const getCardStyle = () => {
    const aspectRatio = photo.width / photo.height;
    
    return {
      width: '100%',
      aspectRatio: aspectRatio.toString(),
    };
  };

  const getCardClasses = () => {
    const isActive = detailedPhoto === photo.id;
    const baseClasses = `
      relative group cursor-pointer rounded-lg overflow-hidden transition-all duration-200
      hover:shadow-md
    `;
    
    if (isMobile) {
      return `${baseClasses} w-full aspect-square ${isActive ? `${getAccentRing(accentColor)} ring-8 ring-offset-2 ring-offset-white dark:ring-offset-gray-900` : ''}`;
    }
    
    return `${baseClasses} ${isActive ? `${getAccentRing(accentColor)} ring-8 ring-offset-2 ring-offset-white dark:ring-offset-gray-900` : ''}`;
  };

  const renderMediaContent = () => {
    const { autoplayGifsInGrid } = useAppStore.getState();
    // If we don't yet have a src, show placeholder
    if (!imageSrc) {
      return (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-gray-400 dark:border-gray-600 border-t-transparent rounded-full" />
        </div>
      );
    }

    if (isVideoFile(photo.ext) && !videoError) {
      return (
        <>
          {isLoading && (
            <div className="absolute inset-0 w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-gray-400 dark:border-gray-600 border-t-transparent rounded-full" />
            </div>
          )}
          <video
            src={libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name)}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
            onError={handleVideoError}
            onLoadedData={handleImageLoad}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </>
      );
    }

    const isGif = photo.ext?.toLowerCase() === 'gif' || photo.name.toLowerCase().endsWith('.gif');
    const effectiveSrc = imageSrc && isGif && !autoplayGifsInGrid
      ? libraryService.getPhotoThumbnailUrl(photo.id, photo.name) // static preview when autoplay off
      : imageSrc;

    return (
      <>
        {isLoading && (
          <div className="absolute inset-0 w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-gray-400 dark:border-gray-600 border-t-transparent rounded-full" />
          </div>
        )}
        <img
          src={effectiveSrc || ''}
          alt={photo.name}
          className="w-full h-full object-cover"
          width={photo.width}
          height={photo.height}
          decoding="async"
          loading={isAboveFold ? "eager" : "lazy"}
          fetchPriority={isAboveFold ? "high" : "auto"}
          onError={handleImageError}
          onLoad={handleImageLoad}
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </>
    );
  };

  return (
    <div 
      className={getCardClasses()} 
      style={!isMobile ? getCardStyle() : undefined}
      onClick={handleClick} 
      onDoubleClick={() => onDoubleClick(photo)}
    >
      {/* Image */}
      <div className="relative w-full h-full">
        {renderMediaContent()}
        
        
        {/* Video play overlay */}
        {isVideoFile(photo.ext) && !videoError && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="bg-white/90 rounded-full p-2">
              <Play className="w-4 h-4 text-gray-800" />
            </div>
          </div>
        )}
        
        {/* Info overlay */}
        <div className={`
          absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
          ${isMobile ? 'opacity-100' : ''}
        `}>
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{photo.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
                  <span>{libraryService.formatFileSize(photo.size)}</span>
                  <span>•</span>
                  <span>{libraryService.getFileType(photo.ext)}</span>
                </div>
              </div>
              
            </div>
            
            {/* Tags */}
            {photo.tags && photo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {photo.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className={`px-2 py-1 text-xs ${getAccentColor(accentColor)} bg-opacity-80 rounded-full`}
                  >
                    {tag}
                  </span>
                ))}
                {photo.tags.length > 3 && (
                  <span className="px-2 py-1 text-xs bg-gray-500/80 text-white rounded-full">
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