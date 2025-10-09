import React from 'react';
import { Heart, Tag, Calendar, HardDrive, Play } from 'lucide-react';
import { PhotoMetadata } from '@/types';
import { libraryService } from '@/services/libraryService';
import { useAppStore } from '@/store';
import { getAccentColor, getAccentRing } from '@/utils/accentColors';
import { isVideoFile } from '@/utils/fileTypes';
import { sequentialImageLoader } from '@/services/sequentialImageLoader';

interface PhotoCardProps {
  photo: PhotoMetadata;
  size: 'small' | 'medium' | 'large';
  onDoubleClick: (photo: PhotoMetadata) => void;
  isMobile?: boolean;
  isAboveFold?: boolean; // For eager loading of first row
  index?: number; // Index in the grid for sequential loading
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  size,
  onDoubleClick,
  isMobile = false,
  isAboveFold = false,
  index = 0,
}) => {
  const { toggleSelectedItem, setDetailedPhoto, accentColor, currentFolder } = useAppStore();
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [imageError, setImageError] = React.useState(false);
  const [videoError, setVideoError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load image sequentially
  React.useEffect(() => {
    // If already loaded/resolved, don't re-queue on reorder/pagination
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
        // Keep isLoading true until media onload to retain placeholder
      },
      index,
      priority
    );

    // Fallback: if image doesn't load within 15 seconds, try direct loading of full image
    const fallbackTimeout = setTimeout(() => {
      if (isLoading && !imageSrc) {
        console.log(`PhotoCard: Fallback loading full image for ${photo.id}`);
        const fullImageUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
        setImageSrc(fullImageUrl);
        setIsLoading(false);
      }
    }, 15000);

    return () => clearTimeout(fallbackTimeout);
  }, [photo.id, photo.name, photo.ext, imageSrc]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // console.log('PhotoCard clicked:', { photoId: photo.id, photoName: photo.name, currentFolder });
    // Save current scroll position before opening detailed view
    const { saveScrollPosition } = useAppStore.getState();
    saveScrollPosition(window.scrollY);
    console.log('Setting detailed photo:', photo.id);
    setDetailedPhoto(photo.id);
  };


  const handleImageError = () => {
    console.log(`PhotoCard: Image failed to load for ${photo.name}, current src:`, imageSrc);
    if (!imageError) {
      const fallbackUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
      console.log(`PhotoCard: Thumbnail failed for ${photo.name}, falling back to full image:`, fallbackUrl);
      setImageError(true);
      setImageSrc(fallbackUrl);
    } else {
      console.log(`PhotoCard: Fallback also failed for ${photo.name}, no more attempts`);
    }
    setIsLoading(false);
  };

  const handleVideoError = () => {
    console.log(`Video thumbnail failed for ${photo.name}, falling back to image`);
    setVideoError(true);
  };

  // Generate responsive srcset for thumbnails
  // TODO: Implement when server supports size parameters
  const generateSrcSet = () => {
    // For now, just return undefined
    // When server supports it, uncomment below:
    // const baseUrl = libraryService.getPhotoThumbnailUrl(photo.id, photo.name);
    // const sizes = [300, 600, 900];
    // return sizes.map(size => `${baseUrl}&size=${size} ${size}w`).join(', ');
    return undefined; // No srcset for now
  };

  // Generate sizes attribute based on viewport and thumbnail size
  const generateSizes = () => {
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
  };

  const renderMediaContent = () => {
    // Show placeholder if no image source or still loading
    if (!imageSrc || isLoading) {
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
            onLoadedData={() => setIsLoading(false)}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </>
      );
    }

    const { autoplayGifsInGrid } = useAppStore.getState();
    const isGif = photo.ext?.toLowerCase() === 'gif' || photo.name.toLowerCase().endsWith('.gif');
    const effectiveSrc = imageSrc && isGif && !autoplayGifsInGrid
      ? libraryService.getPhotoThumbnailUrl(photo.id, photo.name)
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
          onLoad={() => setIsLoading(false)}
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </>
    );
  };

  const getSizeClasses = () => {
    // Calculate aspect ratio
    const aspectRatio = photo.width / photo.height;
    
    switch (size) {
      case 'small':
        return `w-32 h-auto`;
      case 'large':
        return `w-64 h-auto`;
      default:
        return `w-48 h-auto`;
    }
  };

  const getCardStyle = () => {
    const aspectRatio = photo.width / photo.height;
    
    return {
      width: '100%',
      aspectRatio: aspectRatio.toString(),
    };
  };

  const getCardClasses = () => {
    const baseClasses = `
      relative group cursor-pointer rounded-lg overflow-hidden transition-all duration-200
      hover:shadow-md
    `;
    
    if (isMobile) {
      return `${baseClasses} w-full aspect-square`;
    }
    
    return baseClasses;
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