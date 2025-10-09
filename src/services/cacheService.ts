import { FolderCache, FolderNode, PhotoMetadata, MTimeData } from '@/types';

class CacheService {
  private dbName = 'kiwi-cache';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    // Server-side caching is now used instead of IndexedDB
    // Keeping this for potential future use
    return Promise.resolve();
  }

  async saveLibraryCache(cache: FolderCache): Promise<void> {
    // Server-side caching is now used instead of IndexedDB
    console.log('Library cache saved to server');
  }

  async getLibraryCache(): Promise<FolderCache | null> {
    // Server-side caching is now used instead of IndexedDB
    return null;
  }

  async saveFolderTree(tree: FolderNode[]): Promise<void> {
    // Server-side caching is now used instead of IndexedDB
    console.log('Folder tree saved to server');
  }

  async getFolderTree(): Promise<FolderNode[] | null> {
    // Server-side caching is now used instead of IndexedDB
    return null;
  }

  async savePhotos(photos: PhotoMetadata[], onProgress?: (current: number, total: number) => void): Promise<void> {
    // Server-side caching is now used instead of IndexedDB
    console.log(`Photos cached on server: ${photos.length} items`);
    if (onProgress) {
      onProgress(photos.length, photos.length);
    }
  }

  async getPhotos(): Promise<PhotoMetadata[] | null> {
    // Server-side caching is now used instead of IndexedDB
    return null;
  }

  async saveMTimeData(mtimeData: MTimeData): Promise<void> {
    // Server-side caching is now used instead of IndexedDB
    console.log('MTime data saved to server');
  }

  async getMTimeData(): Promise<MTimeData | null> {
    // Server-side caching is now used instead of IndexedDB
    return null;
  }

  async clearCache(): Promise<void> {
    // Server-side caching is now used instead of IndexedDB
    console.log('Cache cleared on server');
  }

  async getCacheSize(): Promise<number> {
    // Server-side caching is now used instead of IndexedDB
    return 0;
  }

  async isCacheValid(maxAge: number = 24 * 60 * 60 * 1000): Promise<boolean> {
    // Server-side caching is now used instead of IndexedDB
    return true;
  }

  // New method to get server cache status
  async getServerCacheStatus(): Promise<any> {
    try {
      const response = await fetch('/api/cache/status');
      if (!response.ok) throw new Error('Failed to get cache status');
      return await response.json();
    } catch (error) {
      console.error('Error getting server cache status:', error);
      return null;
    }
  }

  // New method to manually refresh server cache
  async refreshServerCache(): Promise<boolean> {
    try {
      const response = await fetch('/api/cache/refresh', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to refresh cache');
      const result = await response.json();
      console.log('Server cache refreshed:', result);
      return result.success;
    } catch (error) {
      console.error('Error refreshing server cache:', error);
      return false;
    }
  }

  // New method to trigger incremental cache update
  async updateServerCache(): Promise<any> {
    try {
      const response = await fetch('/api/cache/update', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to update cache');
      const result = await response.json();
      console.log('Server cache updated incrementally:', result);
      return result;
    } catch (error) {
      console.error('Error updating server cache:', error);
      return null;
    }
  }
}

export const cacheService = new CacheService(); 