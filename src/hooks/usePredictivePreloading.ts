import { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoMetadata } from '@/types';
import { libraryService } from '@/services/libraryService';

interface PreloadingConfig {
  preloadAhead: number;        // Number of images to preload ahead
  preloadBehind: number;       // Number of images to preload behind
  maxConcurrent: number;       // Maximum concurrent preloads
  preloadDelay: number;        // Delay before starting preload (ms)
  priorityThreshold: number;   // Distance threshold for high priority
}

interface PreloadingState {
  preloadedImages: Set<string>;
  preloadingImages: Set<string>;
  failedImages: Set<string>;
  currentIndex: number;
  scrollDirection: 'down' | 'up' | 'idle';
  scrollVelocity: number;
}

const DEFAULT_CONFIG: PreloadingConfig = {
  preloadAhead: 10,      // Preload 10 images ahead
  preloadBehind: 5,      // Preload 5 images behind
  maxConcurrent: 5,      // Max 5 concurrent preloads
  preloadDelay: 100,     // 100ms delay
  priorityThreshold: 5,  // High priority within 5 images
};

export function usePredictivePreloading(
  photos: PhotoMetadata[],
  currentIndex: number,
  config: Partial<PreloadingConfig> = {}
) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<PreloadingState>({
    preloadedImages: new Set(),
    preloadingImages: new Set(),
    failedImages: new Set(),
    currentIndex: 0,
    scrollDirection: 'idle',
    scrollVelocity: 0,
  });

  const scrollHistory = useRef<number[]>([]);
  const preloadTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Calculate scroll direction and velocity
  const updateScrollMetrics = useCallback((newIndex: number) => {
    const now = Date.now();
    scrollHistory.current.push(now);
    
    // Keep only last 10 scroll events
    if (scrollHistory.current.length > 10) {
      scrollHistory.current.shift();
    }

    setState(prev => {
      const direction = newIndex > prev.currentIndex ? 'down' : 
                      newIndex < prev.currentIndex ? 'up' : 'idle';
      
      // Calculate velocity (items per second)
      const velocity = scrollHistory.current.length > 1 ? 
        (scrollHistory.current.length - 1) / 
        ((scrollHistory.current[scrollHistory.current.length - 1] - scrollHistory.current[0]) / 1000) : 0;

      return {
        ...prev,
        currentIndex: newIndex,
        scrollDirection: direction,
        scrollVelocity: velocity,
      };
    });
  }, []);

  // Preload a single image
  const preloadImage = useCallback(async (photo: PhotoMetadata, priority: 'high' | 'normal' = 'normal') => {
    const { id, name } = photo;
    
    // Check if already preloaded, preloading, or failed
    let shouldPreload = false;
    setState(prev => {
      if (prev.preloadedImages.has(id) || 
          prev.preloadingImages.has(id) || 
          prev.failedImages.has(id) ||
          prev.preloadingImages.size >= mergedConfig.maxConcurrent) {
        return prev;
      }

      shouldPreload = true;
      // Add to preloading set
      return {
        ...prev,
        preloadingImages: new Set([...prev.preloadingImages, id])
      };
    });

    if (!shouldPreload) return;

    try {
      // Create image element
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Set up load handlers
      const loadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => {
          imageCache.current.set(id, img);
          setState(prevState => ({
            ...prevState,
            preloadedImages: new Set([...prevState.preloadedImages, id]),
            preloadingImages: new Set([...prevState.preloadingImages].filter(imgId => imgId !== id))
          }));
          resolve();
        };
        
        img.onerror = () => {
          // Try fallback to full image if thumbnail fails
          const fallbackUrl = libraryService.getPhotoFileUrl(id, photo.ext, name);
          console.log(`Thumbnail failed for ${name}, trying fallback:`, fallbackUrl);
          
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = 'anonymous';
          
          fallbackImg.onload = () => {
            imageCache.current.set(id, fallbackImg);
            setState(prevState => ({
              ...prevState,
              preloadedImages: new Set([...prevState.preloadedImages, id]),
              preloadingImages: new Set([...prevState.preloadingImages].filter(imgId => imgId !== id))
            }));
            resolve();
          };
          
          fallbackImg.onerror = () => {
            setState(prevState => ({
              ...prevState,
              failedImages: new Set([...prevState.failedImages, id]),
              preloadingImages: new Set([...prevState.preloadingImages].filter(imgId => imgId !== id))
            }));
            reject(new Error(`Failed to preload image: ${name}`));
          };
          
          fallbackImg.src = fallbackUrl;
        };
      });

      // Add delay for non-priority images
      const delay = priority === 'high' ? 0 : mergedConfig.preloadDelay;
      
      // Use libraryService to get the correct URL
      const thumbnailUrl = libraryService.getPhotoThumbnailUrl(id, name);
      
      if (delay > 0) {
        const timeout = setTimeout(() => {
          img.src = thumbnailUrl;
        }, delay);
        
        preloadTimeouts.current.set(id, timeout);
      } else {
        img.src = thumbnailUrl;
      }

      await loadPromise;
      
    } catch (error) {
      console.warn(`Failed to preload image ${name}:`, error);
    }
  }, [mergedConfig.maxConcurrent, mergedConfig.preloadDelay]);

  // Get preload range based on scroll direction and velocity
  const getPreloadRange = useCallback((index: number, scrollDirection: string, scrollVelocity: number) => {
    // Adjust preload range based on scroll velocity
    const velocityMultiplier = Math.min(1 + scrollVelocity * 0.1, 2); // Max 2x multiplier
    
    let ahead = Math.ceil(mergedConfig.preloadAhead * velocityMultiplier);
    let behind = Math.ceil(mergedConfig.preloadBehind * velocityMultiplier);
    
    // Adjust based on scroll direction
    if (scrollDirection === 'down') {
      ahead = Math.ceil(ahead * 1.5); // More ahead when scrolling down
    } else if (scrollDirection === 'up') {
      behind = Math.ceil(behind * 1.5); // More behind when scrolling up
    }
    
    return {
      start: Math.max(0, index - behind),
      end: Math.min(photos.length - 1, index + ahead),
    };
  }, [mergedConfig.preloadAhead, mergedConfig.preloadBehind, photos.length]);

  // Main preloading effect
  useEffect(() => {
    if (photos.length === 0) return;

    updateScrollMetrics(currentIndex);
    
    // Get current state for preload range calculation
    setState(prev => {
      const { start, end } = getPreloadRange(currentIndex, prev.scrollDirection, prev.scrollVelocity);
      
      // Clear existing timeouts
      preloadTimeouts.current.forEach(timeout => clearTimeout(timeout));
      preloadTimeouts.current.clear();
      
      // Preload images in range
      for (let i = start; i <= end; i++) {
        const photo = photos[i];
        if (!photo) continue;
        
        const distance = Math.abs(i - currentIndex);
        const priority = distance <= mergedConfig.priorityThreshold ? 'high' : 'normal';
        
        preloadImage(photo, priority);
      }
      
      return prev;
    });
  }, [currentIndex, photos, updateScrollMetrics, getPreloadRange, preloadImage, mergedConfig.priorityThreshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      preloadTimeouts.current.forEach(timeout => clearTimeout(timeout));
      preloadTimeouts.current.clear();
    };
  }, []);

  // Get preloaded image URL
  const getPreloadedImageUrl = useCallback((photo: PhotoMetadata) => {
    const { id } = photo;
    
    if (state.preloadedImages.has(id)) {
      const cachedImg = imageCache.current.get(id);
      if (cachedImg) {
        return cachedImg.src;
      }
    }
    
    return null;
  }, [state.preloadedImages]);

  // Check if image is preloaded
  const isImagePreloaded = useCallback((photoId: string) => {
    return state.preloadedImages.has(photoId);
  }, [state.preloadedImages]);

  // Get preloading statistics
  const getPreloadingStats = useCallback(() => {
    return {
      preloaded: state.preloadedImages.size,
      preloading: state.preloadingImages.size,
      failed: state.failedImages.size,
      total: photos.length,
      preloadRate: photos.length > 0 ? (state.preloadedImages.size / photos.length) * 100 : 0,
      scrollDirection: state.scrollDirection,
      scrollVelocity: state.scrollVelocity,
    };
  }, [state, photos.length]);

  // Clear preloaded images (for memory management)
  const clearPreloadedImages = useCallback(() => {
    imageCache.current.clear();
    setState(prev => ({
      ...prev,
      preloadedImages: new Set(),
      preloadingImages: new Set(),
      failedImages: new Set(),
    }));
  }, []);

  return {
    getPreloadedImageUrl,
    isImagePreloaded,
    getPreloadingStats,
    clearPreloadedImages,
    preloadingState: state,
  };
}