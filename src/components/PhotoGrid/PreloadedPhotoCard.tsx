import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PhotoMetadata } from '@/types';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import { imagePreloadingService } from '@/services/imagePreloadingService';
import { getAccentColor, getAccentRing } from '@/utils/accentColors';
import { isVideoFile } from '@/utils/fileTypes';

interface PreloadedPhotoCardProps {
  photo: PhotoMetadata;
  size: 'small' | 'medium' | 'large';
  isSelected: boolean;
  onSelect: (photoId: string) => void;
  onDoubleClick: (photo: PhotoMetadata) => void;
  isMobile?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

export const PreloadedPhotoCard: React.FC<PreloadedPhotoCardProps> = ({
  photo,
  size,
  isSelected,
  onSelect,
  onDoubleClick,
  isMobile = false,
  priority = 'normal',
}) => {
  const { setDetailedPhoto, accentColor, currentFolder } = useAppStore();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [loadStartTime, setLoadStartTime] = useState<number>(0);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check if image is preloaded and listen for preloading completion
  useEffect(() => {
    const checkPreloadedImage = () => {
      const preloadedImg = imagePreloadingService.getPreloadedImage(photo.id);
      if (preloadedImg) {
        console.log(`Using preloaded image for ${photo.name}`);
        setImageSrc(preloadedImg.src);
        setIsPreloaded(true);
        setIsLoading(false);
        setImageError(false);
        return true;
      }
      return false;
    };

    // Check immediately
    if (!checkPreloadedImage()) {
      // Fallback to regular loading
      const thumbnailUrl = libraryService.getPhotoThumbnailUrl(photo.id, photo.name);
      setImageSrc(thumbnailUrl);
      setIsPreloaded(false);
    }

    // Subscribe to preloading completion
    const handlePreloadComplete = () => {
      checkPreloadedImage();
    };

    imagePreloadingService.subscribe(photo.id, handlePreloadComplete);

    return () => {
      imagePreloadingService.unsubscribe(photo.id, handlePreloadComplete);
    };
  }, [photo.id, photo.name]);

  // Request preloading for this image
  useEffect(() => {
    if (priority === 'high') {
      imagePreloadingService.addToQueue([photo], 'high');
    }
  }, [photo, priority]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const { saveScrollPosition } = useAppStore.getState();
    saveScrollPosition(window.scrollY);
    setDetailedPhoto(photo.id);
  }, [photo.id, setDetailedPhoto]);

  const handleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(photo.id);
  }, [onSelect, photo.id]);

  const handleImageError = useCallback(() => {
    if (!imageError) {
      console.log('Thumbnail failed, falling back to full image:', { photoId: photo.id, photoName: photo.name });
      setImageError(true);
      setImageSrc(libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name));
    }
    setIsLoading(false);
  }, [imageError, photo.id, photo.ext, photo.name]);

  const handleImageLoad = useCallback(() => {
    const loadTime = performance.now() - loadStartTime;
    console.log(`Image loaded in ${loadTime.toFixed(2)}ms (preloaded: ${isPreloaded})`, { 
      photoId: photo.id, 
      photoName: photo.name 
    });
    setIsLoading(false);
  }, [photo.id, photo.name, isPreloaded, loadStartTime]);

  const handleVideoError = useCallback(() => {
    setVideoError(true);
    setIsLoading(false);
  }, []);

  const handleVideoLoad = useCallback(() => {
    const loadTime = performance.now() - loadStartTime;
    console.log(`Video loaded in ${loadTime.toFixed(2)}ms`, { 
      photoId: photo.id, 
      photoName: photo.name 
    });
    setIsLoading(false);
  }, [photo.id, photo.name, loadStartTime]);

  // Track load start time
  useEffect(() => {
    if (imageSrc && !isPreloaded) {
      setLoadStartTime(performance.now());
    }
  }, [imageSrc, isPreloaded]);

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

  const getSizeClasses = () => {
    const sizeMap = {
      small: 'w-16 h-16',
      medium: 'w-24 h-24',
      large: 'w-32 h-32',
    };
    return sizeMap[size];
  };

  const renderMediaContent = () => {
    // Show loading skeleton
    if (isLoading) {
      return (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">
            {isPreloaded ? 'Preloaded' : 'Loading...'}
          </div>
        </div>
      );
    }

    // Show placeholder if no image source
    if (!imageSrc) {
      return (
        <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-gray-400 text-sm">📷</div>
        </div>
      );
    }

    if (isVideoFile(photo.ext) && !videoError) {
      return (
        <video
          ref={videoRef}
          src={libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name)}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
          onError={handleVideoError}
          onLoadedData={handleVideoLoad}
        />
      );
    } else {
      return (
        <img
          ref={imgRef}
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

  const renderPreloadIndicator = () => {
    if (isPreloaded) {
      return (
        <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded opacity-75">
          ⚡
        </div>
      );
    }
    return null;
  };

  const renderPriorityIndicator = () => {
    if (priority === 'high') {
      return (
        <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded opacity-75">
          🔥
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={getCardClasses()}
      style={getCardStyle()}
      onClick={handleClick}
    >
      {renderPreloadIndicator()}
      {renderPriorityIndicator()}
      
      <div className="relative w-full h-full">
        {renderMediaContent()}
        
        {/* Selection overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
            <div className={`${getAccentColor(accentColor)} text-white rounded-full p-2`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
        
        {/* Selection checkbox */}
        <div
          className="absolute top-2 left-2 w-5 h-5 bg-white bg-opacity-80 rounded border-2 border-gray-300 cursor-pointer hover:bg-opacity-100 transition-all duration-200"
          onClick={handleSelect}
        >
          {isSelected && (
            <div className="w-full h-full bg-blue-500 rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        
        {/* File info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="text-white text-xs truncate">
            {photo.name}
          </div>
          <div className="text-gray-300 text-xs">
            {photo.size ? `${(photo.size / 1024 / 1024).toFixed(1)}MB` : ''}
            {isPreloaded && ' • Preloaded'}
          </div>
        </div>
      </div>
    </div>
  );
};