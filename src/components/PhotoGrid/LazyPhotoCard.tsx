import React, { useState, useCallback } from 'react';
import { PhotoMetadata } from '@/types';
import { libraryService } from '@/services/libraryService';
import { useAppStore } from '@/store';
import { getAccentColor, getAccentRing } from '@/utils/accentColors';
import { isVideoFile } from '@/utils/fileTypes';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { Play, Heart, Tag, Calendar, HardDrive } from 'lucide-react';

interface LazyPhotoCardProps {
  photo: PhotoMetadata;
  size: 'small' | 'medium' | 'large';
  isSelected: boolean;
  onSelect: (photoId: string) => void;
  onDoubleClick: (photo: PhotoMetadata) => void;
  isMobile?: boolean;
}

export const LazyPhotoCard: React.FC<LazyPhotoCardProps> = ({
  photo,
  size,
  isSelected,
  onSelect,
  onDoubleClick,
  isMobile = false,
}) => {
  const { toggleSelectedItem, setDetailedPhoto, accentColor, currentFolder } = useAppStore();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use intersection observer to determine when to load the image
  const [ref, shouldLoad] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px', // Start loading 100px before it comes into view
    freezeOnceVisible: true,
  });

  // Load image when it should be visible
  React.useEffect(() => {
    if (shouldLoad && !imageSrc && !imageError) {
      setIsLoading(true);
      setImageSrc(libraryService.getPhotoThumbnailUrl(photo.id, photo.name));
    }
  }, [shouldLoad, imageSrc, imageError, photo.id, photo.name]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // console.log('PhotoCard clicked:', { photoId: photo.id, photoName: photo.name, currentFolder });
    // Save current scroll position before opening detailed view
    const { saveScrollPosition } = useAppStore.getState();
    saveScrollPosition(window.scrollY);
    console.log('Setting detailed photo:', photo.id);
    setDetailedPhoto(photo.id);
  }, [photo.id, photo.name, currentFolder, setDetailedPhoto]);

  const handleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(photo.id);
  }, [onSelect, photo.id]);

  const handleImageError = useCallback(() => {
    if (!imageError) {
      console.log(`Thumbnail failed for ${photo.name}, falling back to full image`);
      setImageError(true);
      setImageSrc(libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name));
    }
    setIsLoading(false);
  }, [imageError, photo.name, photo.id, photo.ext]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleVideoError = useCallback(() => {
    console.log(`Video thumbnail failed for ${photo.name}, falling back to image`);
    setVideoError(true);
    setIsLoading(false);
  }, [photo.name]);

  const getSizeClasses = () => {
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
      ${isSelected 
        ? `${getAccentRing(accentColor)} shadow-lg` 
        : 'hover:shadow-md'
      }
    `;
    
    if (isMobile) {
      return `${baseClasses} w-full aspect-square`;
    }
    
    return baseClasses;
  };

  const renderMediaContent = () => {
    // Show loading skeleton
    if (isLoading) {
      return (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      );
    }

    // Show placeholder if not loaded yet
    if (!shouldLoad || !imageSrc) {
      return (
        <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-gray-400 text-sm">📷</div>
        </div>
      );
    }

    if (isVideoFile(photo.ext) && !videoError) {
      return (
        <video
          src={libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name)}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
          onError={handleVideoError}
          onLoadedData={handleImageLoad}
        />
      );
    } else {
      return (
        <img
          src={imageSrc}
          alt={photo.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      );
    }
  };

  return (
    <div 
      ref={ref}
      className={getCardClasses()} 
      style={!isMobile ? getCardStyle() : undefined}
      onClick={handleClick} 
      onDoubleClick={() => onDoubleClick(photo)}
    >
      {/* Image */}
      <div className="relative w-full h-full">
        {renderMediaContent()}
        
        {/* Selection overlay */}
        {isSelected && (
          <div className={`absolute inset-0 ${getAccentColor(accentColor).replace('text-white', '')} bg-opacity-20 flex items-center justify-center`}>
            <div className={`${getAccentColor(accentColor)} rounded-full p-1`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
        
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
              
              {/* Selection checkbox */}
              <button
                onClick={handleSelect}
                className={`
                  p-1 rounded-full transition-colors
                  ${isSelected 
                    ? `${getAccentColor(accentColor)}` 
                    : 'bg-white/20 text-white hover:bg-white/30'
                  }
                `}
              >
                {isSelected ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
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