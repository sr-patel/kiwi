import { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoMetadata } from '@/types';
import { imagePreloadingService } from '@/services/imagePreloadingService';

interface SimplePreloadingConfig {
  preloadAhead: number;
  preloadBehind: number;
  maxConcurrent: number;
  preloadDelay: number;
  priorityThreshold: number;
}

const DEFAULT_CONFIG: SimplePreloadingConfig = {
  preloadAhead: 15,
  preloadBehind: 8,
  maxConcurrent: 6,
  preloadDelay: 50,
  priorityThreshold: 8,
};

export function useSimplePreloading(
  photos: PhotoMetadata[],
  currentIndex: number,
  config: Partial<SimplePreloadingConfig> = {}
) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [isPreloading, setIsPreloading] = useState(false);
  const preloadedImages = useRef<Set<string>>(new Set());
  const preloadingImages = useRef<Set<string>>(new Set());

  // Simple preload function
  const preloadImage = useCallback(async (photo: PhotoMetadata, priority: 'high' | 'normal' = 'normal') => {
    const { id } = photo;
    
    // Skip if already preloaded or preloading
    if (preloadedImages.current.has(id) || preloadingImages.current.has(id)) {
      return;
    }

    // Skip if too many concurrent preloads
    if (preloadingImages.current.size >= mergedConfig.maxConcurrent) {
      return;
    }

    preloadingImages.current.add(id);

    try {
      // Use the image preloading service
      imagePreloadingService.addToQueue([photo], priority);
      
      // Wait for the image to be preloaded
      return new Promise<void>((resolve) => {
        const checkPreloaded = () => {
          if (imagePreloadingService.isPreloaded(id)) {
            preloadedImages.current.add(id);
            preloadingImages.current.delete(id);
            resolve();
          } else {
            setTimeout(checkPreloaded, 50); // Check every 50ms
          }
        };
        
        // Start checking after a short delay
        setTimeout(checkPreloaded, 100);
      });
      
    } catch (error) {
      console.warn(`Failed to preload image ${photo.name}:`, error);
      preloadingImages.current.delete(id);
    }
  }, [mergedConfig.maxConcurrent]);

  // Preload images when currentIndex changes
  useEffect(() => {
    if (photos.length === 0 || isPreloading) return;

    console.log(`🔄 Preloading images around index ${currentIndex} (${photos.length} total photos)`);
    setIsPreloading(true);

    const preloadImages = async () => {
      const start = Math.max(0, currentIndex - mergedConfig.preloadBehind);
      const end = Math.min(photos.length - 1, currentIndex + mergedConfig.preloadAhead);

      console.log(`📦 Preloading range: ${start} to ${end}`);

      // Preload images in range
      for (let i = start; i <= end; i++) {
        const photo = photos[i];
        if (!photo) continue;
        
        const distance = Math.abs(i - currentIndex);
        const priority = distance <= mergedConfig.priorityThreshold ? 'high' : 'normal';
        
        console.log(`🖼️ Preloading ${photo.name} (priority: ${priority}, distance: ${distance})`);
        await preloadImage(photo, priority);
      }
    };

    preloadImages().finally(() => {
      console.log(`✅ Finished preloading around index ${currentIndex}`);
      setIsPreloading(false);
    });
  }, [currentIndex, photos.length, preloadImage, mergedConfig.preloadAhead, mergedConfig.preloadBehind, mergedConfig.priorityThreshold]);

  // Preload initial batch when photos change
  useEffect(() => {
    if (photos.length === 0) return;

    // Preload first batch immediately
    const initialBatch = photos.slice(0, 20);
    imagePreloadingService.preloadImages(initialBatch, {
      priority: 'high',
      batchSize: 10,
      delay: 0,
    });
  }, [photos.length]);

  // Check if image is preloaded
  const isImagePreloaded = useCallback((photoId: string) => {
    return preloadedImages.current.has(photoId) || imagePreloadingService.isPreloaded(photoId);
  }, []);

  // Get preloaded image URL
  const getPreloadedImageUrl = useCallback((photo: PhotoMetadata) => {
    const url = imagePreloadingService.getPreloadedImageUrl(photo.id);
    if (url) {
      preloadedImages.current.add(photo.id);
      return url;
    }
    return null;
  }, []);

  // Get preloading statistics
  const getPreloadingStats = useCallback(() => {
    const serviceStats = imagePreloadingService.getStats();
    return {
      ...serviceStats,
      localPreloaded: preloadedImages.current.size,
      localPreloading: preloadingImages.current.size,
    };
  }, []);

  // Clear preloaded images
  const clearPreloadedImages = useCallback(() => {
    preloadedImages.current.clear();
    preloadingImages.current.clear();
    imagePreloadingService.clearPreloadedImages();
  }, []);

  return {
    getPreloadedImageUrl,
    isImagePreloaded,
    getPreloadingStats,
    clearPreloadedImages,
    isPreloading,
  };
}