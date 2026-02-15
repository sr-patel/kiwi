interface LoadingTask {
  photoId: string;
  photoName: string;
  priority: number;
  callback: (url: string) => void;
  index: number;
}

class SequentialImageLoader {
  private loadingQueue: LoadingTask[] = [];
  private currentlyLoading: Set<string> = new Set();
  private loadedCache: Map<string, string> = new Map();
  private pendingCallbacks: Map<string, ((url: string) => void)[]> = new Map();
  private maxConcurrent = 2; // Load 2 images at a time
  private isProcessing = false;
  private loadingDelay = 100; // 100ms delay between starting each image load

  constructor() {
    this.startProcessing();
  }

  /**
   * Add an image to the loading queue
   */
  addToQueue(photoId: string, photoName: string, callback: (url: string) => void, index: number, priority: 'high' | 'normal' | 'low' = 'normal') {
    // Check cache first
    if (this.loadedCache.has(photoId)) {
      const url = this.loadedCache.get(photoId)!;
      callback(url);
      return;
    }

    // Add to pending callbacks if already loading or queued
    if (this.currentlyLoading.has(photoId) || this.loadingQueue.some(task => task.photoId === photoId)) {
      // console.log(`SequentialLoader: ${photoId} already loading/queued, adding to pending callbacks`);
      if (!this.pendingCallbacks.has(photoId)) {
        this.pendingCallbacks.set(photoId, []);
      }
      this.pendingCallbacks.get(photoId)!.push(callback);
      return;
    }

    const priorityMap = { high: 1, normal: 2, low: 3 };
    const task: LoadingTask = {
      photoId,
      photoName,
      priority: priorityMap[priority],
      callback, // This will be the first callback
      index
    };

    this.loadingQueue.push(task);
    
    // Sort by priority, then by index (top to bottom)
    this.loadingQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.index - b.index;
    });

    console.log(`SequentialLoader: Added ${photoId} to queue (index: ${index}, priority: ${priority}). Queue size: ${this.loadingQueue.length}`);
  }

  /**
   * Start processing the loading queue
   */
  private async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('SequentialLoader: Started processing queue');
    
    while (true) {
      // Wait if queue is empty or max concurrent reached
      if (this.loadingQueue.length === 0 || this.currentlyLoading.size >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      // Get next task from queue
      const task = this.loadingQueue.shift();
      if (!task) continue;

      console.log(`SequentialLoader: Processing ${task.photoId} (index: ${task.index}). Queue remaining: ${this.loadingQueue.length}`);
      
      // Start loading
      this.loadImage(task);
    }
  }

  /**
   * Load a single image
   */
  private async loadImage(task: LoadingTask) {
    this.currentlyLoading.add(task.photoId);
    
    try {
      // Add delay for sequential loading effect
      await new Promise(resolve => setTimeout(resolve, this.loadingDelay));
      
      const { libraryService } = await import('./libraryService');
      const thumbnailUrl = libraryService.getPhotoThumbnailUrl(task.photoId, task.photoName);
      
      console.log(`SequentialLoader: Loading ${task.photoId} from ${thumbnailUrl}`);
      
      // Create image element to preload
      const img = new Image();
      
      const loadPromise = new Promise<string>((resolve) => {
        let resolved = false;
        
        // Add timeout to prevent stuck images
        const timeout = setTimeout(() => {
          if (!resolved) {
            console.log(`SequentialLoader: Timeout loading ${task.photoId}, trying fallback`);
            resolved = true;
            this.currentlyLoading.delete(task.photoId);
            const fallbackUrl = libraryService.getPhotoFileUrl(task.photoId, task.photoName.split('.').pop() || '', task.photoName);
            this.handleSuccess(task.photoId, fallbackUrl, task.callback);
            resolve(fallbackUrl);
          }
        }, 10000); // 10 second timeout
        
        img.onload = () => {
          if (!resolved) {
            console.log(`SequentialLoader: Successfully loaded ${task.photoId}`);
            resolved = true;
            clearTimeout(timeout);
            this.currentlyLoading.delete(task.photoId);
            this.handleSuccess(task.photoId, thumbnailUrl, task.callback);
            resolve(thumbnailUrl);
          }
        };
        
        img.onerror = () => {
          if (!resolved) {
            console.log(`SequentialLoader: Thumbnail failed for ${task.photoId}, trying fallback`);
            // Try fallback to full image
            const fallbackUrl = libraryService.getPhotoFileUrl(task.photoId, task.photoName.split('.').pop() || '', task.photoName);
            console.log(`SequentialLoader: Loading fallback image for ${task.photoId}:`, fallbackUrl);
            
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
              if (!resolved) {
                console.log(`SequentialLoader: Fallback image loaded successfully for ${task.photoId}`);
                resolved = true;
                clearTimeout(timeout);
                this.currentlyLoading.delete(task.photoId);
                this.handleSuccess(task.photoId, fallbackUrl, task.callback);
                resolve(fallbackUrl);
              }
            };
            fallbackImg.onerror = () => {
              if (!resolved) {
                console.log(`SequentialLoader: Fallback image also failed for ${task.photoId}`);
                resolved = true;
                clearTimeout(timeout);
                this.currentlyLoading.delete(task.photoId);
                // Still pass the fallback URL in case the browser can handle it
                this.handleSuccess(task.photoId, fallbackUrl, task.callback);
                resolve(fallbackUrl);
              }
            };
            fallbackImg.src = fallbackUrl;
          }
        };
      });

      img.src = thumbnailUrl;
      await loadPromise;
      
    } catch (error) {
      console.warn(`SequentialLoader: Failed to load image ${task.photoId}:`, error);
      this.currentlyLoading.delete(task.photoId);
    }
  }

  private handleSuccess(photoId: string, url: string, initialCallback: (url: string) => void) {
    // Update cache
    this.loadedCache.set(photoId, url);

    // Call initial callback
    initialCallback(url);

    // Call any pending callbacks
    const pending = this.pendingCallbacks.get(photoId);
    if (pending) {
      pending.forEach(cb => cb(url));
      this.pendingCallbacks.delete(photoId);
    }
  }

  /**
   * Clear the loading queue
   */
  clearQueue() {
    this.loadingQueue.length = 0;
    this.currentlyLoading.clear();
  }

  /**
   * Force process the queue (useful for debugging or manual triggers)
   */
  forceProcessQueue() {
    console.log(`SequentialLoader: Force processing queue. Size: ${this.loadingQueue.length}, Currently loading: ${this.currentlyLoading.size}`);
    // The processing loop will automatically pick up any pending items
  }

  /**
   * Retry any stuck images (useful when grid size changes)
   */
  retryStuckImages() {
    console.log(`SequentialLoader: Retrying stuck images. Currently loading: ${this.currentlyLoading.size}`);
    // Clear currently loading to allow retry
    this.currentlyLoading.clear();
  }

  /**
   * Get loading statistics
   */
  getStats() {
    return {
      queueSize: this.loadingQueue.length,
      currentlyLoading: this.currentlyLoading.size,
      loadingIds: Array.from(this.currentlyLoading)
    };
  }
}

// Export singleton instance
export const sequentialImageLoader = new SequentialImageLoader();
