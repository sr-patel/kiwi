import { PhotoMetadata } from '@/types';
import { libraryService } from './libraryService';

interface PreloadTask {
  photo: PhotoMetadata;
  priority: number;
  timestamp: number;
  retryCount: number;
}

interface PreloadStats {
  totalPreloaded: number;
  totalFailed: number;
  currentlyPreloading: number;
  queueSize: number;
  averagePreloadTime: number;
  cacheHitRate: number;
}

class ImagePreloadingService {
  private preloadQueue: PreloadTask[] = [];
  private preloadedImages = new Map<string, HTMLImageElement>();
  private objectUrls = new Map<string, string>(); // Cache object URLs for memory efficiency
  private failedImages = new Set<string>();
  private preloadingImages = new Set<string>();
  private maxConcurrent = 5;
  private maxRetries = 3;
  private preloadTimes: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private isProcessing = false;
  private listeners = new Map<string, Set<() => void>>();

  constructor() {
    this.startProcessing();
  }

  /**
   * Force immediate loading of a specific image (highest priority)
   */
  forceLoadImage(photo: PhotoMetadata) {
    // Skip if already preloaded or preloading
    if (this.preloadedImages.has(photo.id) || this.preloadingImages.has(photo.id)) {
      return;
    }

    // Remove from queue if already queued
    const existingIndex = this.preloadQueue.findIndex(task => task.photo.id === photo.id);
    if (existingIndex !== -1) {
      this.preloadQueue.splice(existingIndex, 1);
    }

    // Add to front of queue with highest priority
    const task: PreloadTask = {
      photo,
      priority: 0, // Highest priority
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.preloadQueue.unshift(task); // Add to front
    this.preloadQueue.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add images to preload queue with priority
   */
  addToQueue(photos: PhotoMetadata[], priority: 'high' | 'normal' | 'low' = 'normal') {
    const priorityMap = { high: 1, normal: 2, low: 3 };
    const basePriority = priorityMap[priority];
    
    photos.forEach((photo, index) => {
      // Skip if already preloaded, preloading, or failed
      if (this.preloadedImages.has(photo.id) || 
          this.preloadingImages.has(photo.id) || 
          this.failedImages.has(photo.id)) {
        return;
      }

      // Check if already in queue
      const existingIndex = this.preloadQueue.findIndex(task => task.photo.id === photo.id);
      if (existingIndex !== -1) {
        // Update priority if higher
        if (this.preloadQueue[existingIndex].priority > basePriority) {
          this.preloadQueue[existingIndex].priority = basePriority;
          this.preloadQueue[existingIndex].timestamp = Date.now();
        }
        return;
      }

      // Add to queue with calculated priority
      const task: PreloadTask = {
        photo,
        priority: basePriority + (index * 0.1), // Slight offset for order
        timestamp: Date.now(),
        retryCount: 0,
      };

      this.preloadQueue.push(task);
    });

    // Sort queue by priority (lower number = higher priority)
    this.preloadQueue.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Start processing the preload queue
   */
  private async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (true) {
      // Wait if queue is empty or max concurrent reached
      if (this.preloadQueue.length === 0 || this.preloadingImages.size >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Get next task from queue
      const task = this.preloadQueue.shift();
      if (!task) continue;

      // Skip if already preloaded
      if (this.preloadedImages.has(task.photo.id)) {
        this.cacheHits++;
        continue;
      }

      // Start preloading
      this.preloadImage(task);
    }
  }

  /**
   * Preload a single image
   */
  private async preloadImage(task: PreloadTask) {
    const { photo } = task;
    this.preloadingImages.add(photo.id);
    
    const startTime = performance.now();
    
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const loadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const loadTime = performance.now() - startTime;
          this.preloadTimes.push(loadTime);
          
          // Keep only last 100 preload times for average calculation
          if (this.preloadTimes.length > 100) {
            this.preloadTimes.shift();
          }
          
          this.preloadedImages.set(photo.id, img);
          this.preloadingImages.delete(photo.id);
          this.cacheMisses++;
          this.notifyListeners(photo.id);
          resolve();
        };
        
        img.onerror = () => {
          // Try fallback to full image if thumbnail fails
          const fallbackUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
          console.log(`Thumbnail failed for ${photo.name}, trying fallback:`, fallbackUrl);
          
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = 'anonymous';
          
          fallbackImg.onload = () => {
            const loadTime = performance.now() - startTime;
            this.preloadTimes.push(loadTime);
            
            if (this.preloadTimes.length > 100) {
              this.preloadTimes.shift();
            }
            
            this.preloadedImages.set(photo.id, fallbackImg);
            this.preloadingImages.delete(photo.id);
            this.cacheMisses++;
            this.notifyListeners(photo.id);
            resolve();
          };
          
          fallbackImg.onerror = () => {
            this.preloadingImages.delete(photo.id);
            reject(new Error(`Failed to preload image: ${photo.name}`));
          };
          
          fallbackImg.src = fallbackUrl;
        };
      });

      // Add slight delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Use libraryService to get the correct URL
      const thumbnailUrl = libraryService.getPhotoThumbnailUrl(photo.id, photo.name);
      console.log(`Preloading thumbnail for ${photo.name}:`, thumbnailUrl);
      img.src = thumbnailUrl;
      await loadPromise;
      
    } catch (error) {
      console.warn(`Failed to preload image ${photo.name}:`, error);
      
      // Retry if retry count is below max
      if (task.retryCount < this.maxRetries) {
        task.retryCount++;
        task.timestamp = Date.now();
        this.preloadQueue.push(task);
        this.preloadQueue.sort((a, b) => a.priority - b.priority);
      } else {
        this.failedImages.add(photo.id);
      }
      
      this.preloadingImages.delete(photo.id);
    }
  }

  /**
   * Get preloaded image
   */
  getPreloadedImage(photoId: string): HTMLImageElement | null {
    const img = this.preloadedImages.get(photoId);
    if (img) {
      this.cacheHits++;
      return img;
    }
    this.cacheMisses++;
    return null;
  }

  /**
   * Check if image is preloaded
   */
  isPreloaded(photoId: string): boolean {
    return this.preloadedImages.has(photoId);
  }

  /**
   * Check if image is currently being loaded
   */
  isLoading(photoId: string): boolean {
    return this.preloadingImages.has(photoId);
  }

  /**
   * Check if image is in queue
   */
  isQueued(photoId: string): boolean {
    return this.preloadQueue.some(task => task.photo.id === photoId);
  }

  /**
   * Get preloaded image URL
   */
  getPreloadedImageUrl(photoId: string): string | null {
    const img = this.preloadedImages.get(photoId);
    return img ? img.src : null;
  }

  /**
   * Get or create object URL for memory caching
   */
  async getObjectUrl(photoId: string, _photo: PhotoMetadata): Promise<string | null> {
    // Check if we already have an object URL
    if (this.objectUrls.has(photoId)) {
      this.cacheHits++;
      return this.objectUrls.get(photoId)!;
    }

    // Check if we have a preloaded image
    const img = this.preloadedImages.get(photoId);
    if (img) {
      try {
        // Create object URL from the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            this.objectUrls.set(photoId, objectUrl);
          }
        });
        
        return this.objectUrls.get(photoId) || null;
      } catch (error) {
        console.warn('Failed to create object URL:', error);
        return null;
      }
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Get preloading statistics
   */
  getStats(): PreloadStats {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const averagePreloadTime = this.preloadTimes.length > 0 
      ? this.preloadTimes.reduce((sum, time) => sum + time, 0) / this.preloadTimes.length 
      : 0;

    return {
      totalPreloaded: this.preloadedImages.size,
      totalFailed: this.failedImages.size,
      currentlyPreloading: this.preloadingImages.size,
      queueSize: this.preloadQueue.length,
      averagePreloadTime: Math.round(averagePreloadTime),
      cacheHitRate: totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0,
    };
  }

  /**
   * Clear preloaded images (for memory management)
   */
  clearPreloadedImages() {
    // Revoke object URLs to free memory
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls.clear();
    
    this.preloadedImages.clear();
    this.failedImages.clear();
    this.preloadingImages.clear();
    this.preloadQueue.length = 0;
    this.preloadTimes.length = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Clear specific image from cache
   */
  clearImage(photoId: string) {
    // Revoke object URL if it exists
    const objectUrl = this.objectUrls.get(photoId);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      this.objectUrls.delete(photoId);
    }
    
    this.preloadedImages.delete(photoId);
    this.failedImages.delete(photoId);
    this.preloadingImages.delete(photoId);
    
    // Remove from queue
    const queueIndex = this.preloadQueue.findIndex(task => task.photo.id === photoId);
    if (queueIndex !== -1) {
      this.preloadQueue.splice(queueIndex, 1);
    }
  }

  /**
   * Update max concurrent preloads
   */
  setMaxConcurrent(max: number) {
    this.maxConcurrent = Math.max(1, Math.min(10, max));
  }

  /**
   * Preload images with smart batching
   */
  preloadImages(photos: PhotoMetadata[], options: {
    priority?: 'high' | 'normal' | 'low';
    batchSize?: number;
    delay?: number;
  } = {}) {
    const { priority = 'normal', batchSize = 10, delay = 0 } = options;
    
    // Process in batches to avoid overwhelming
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize);
      
      setTimeout(() => {
        this.addToQueue(batch, priority);
      }, i * delay);
    }
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): number {
    let totalSize = 0;
    this.preloadedImages.forEach(img => {
      // Rough estimate: width * height * 4 bytes (RGBA)
      totalSize += (img.naturalWidth || 0) * (img.naturalHeight || 0) * 4;
    });
    return totalSize;
  }

  /**
   * Cleanup old images based on memory usage
   */
  cleanupOldImages(maxMemoryMB: number = 100) {
    const maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    const currentMemory = this.getMemoryUsage();
    
    if (currentMemory > maxMemoryBytes) {
      // Remove oldest images (simple FIFO for now)
      const imagesToRemove = Math.floor(this.preloadedImages.size * 0.3); // Remove 30%
      const imageIds = Array.from(this.preloadedImages.keys()).slice(0, imagesToRemove);
      
      imageIds.forEach(id => {
        this.preloadedImages.delete(id);
      });
      
      console.log(`Cleaned up ${imagesToRemove} images to free memory`);
    }
  }

  /**
   * Subscribe to preloading events for a specific photo
   */
  subscribe(photoId: string, callback: () => void) {
    if (!this.listeners.has(photoId)) {
      this.listeners.set(photoId, new Set());
    }
    this.listeners.get(photoId)!.add(callback);
  }

  /**
   * Unsubscribe from preloading events
   */
  unsubscribe(photoId: string, callback: () => void) {
    const photoListeners = this.listeners.get(photoId);
    if (photoListeners) {
      photoListeners.delete(callback);
      if (photoListeners.size === 0) {
        this.listeners.delete(photoId);
      }
    }
  }

  /**
   * Notify listeners that a photo has been preloaded
   */
  private notifyListeners(photoId: string) {
    const photoListeners = this.listeners.get(photoId);
    if (photoListeners) {
      photoListeners.forEach(callback => callback());
    }
  }
}

// Export singleton instance
export const imagePreloadingService = new ImagePreloadingService();