import { useEffect, useRef } from 'react';
import { PhotoMetadata } from '@/types';
import { libraryService } from '@/services/libraryService';

interface SimplePreloadingConfig {
  preloadCount: number;
  delay: number;
}

const DEFAULT_CONFIG: SimplePreloadingConfig = {
  preloadCount: 5,
  delay: 1000, // 1 second delay
};

export function useSimpleImagePreloading(
  photos: PhotoMetadata[],
  config: Partial<SimplePreloadingConfig> = {}
) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const preloadedImages = useRef<Set<string>>(new Set());
  const preloadingImages = useRef<Set<string>>(new Set());

  // Simple preload function using native browser preloading
  const preloadImage = (photo: PhotoMetadata) => {
    const { id } = photo;
    
    // Skip if already preloaded or preloading
    if (preloadedImages.current.has(id) || preloadingImages.current.has(id)) {
      return;
    }

    preloadingImages.current.add(id);

    // Create image element for preloading
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      preloadedImages.current.add(id);
      preloadingImages.current.delete(id);
      console.log(`✅ Preloaded: ${photo.name}`);
    };
    
    img.onerror = () => {
      preloadingImages.current.delete(id);
      console.log(`❌ Failed to preload: ${photo.name}`);
    };

    // Use thumbnail URL
    img.src = libraryService.getPhotoThumbnailUrl(photo.id, photo.name);
  };

  // Preload images in background
  useEffect(() => {
    if (photos.length === 0) return;

    const timeout = setTimeout(() => {
      const batch = photos.slice(0, mergedConfig.preloadCount);
      console.log(`🚀 Starting background preload of ${batch.length} images`);
      
      batch.forEach(photo => {
        preloadImage(photo);
      });
    }, mergedConfig.delay);

    return () => clearTimeout(timeout);
  }, [photos.length, mergedConfig.preloadCount, mergedConfig.delay]);

  // Check if image is preloaded
  const isImagePreloaded = (photoId: string) => {
    return preloadedImages.current.has(photoId);
  };

  // Get preloading stats
  const getStats = () => {
    return {
      preloaded: preloadedImages.current.size,
      preloading: preloadingImages.current.size,
      total: photos.length,
    };
  };

  return {
    isImagePreloaded,
    getStats,
  };
}