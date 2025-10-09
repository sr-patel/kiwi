import { PhotoMetadata, LibraryMetadata, FolderMetadata, FolderCache, FolderNode, MTimeData } from '@/types';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';

class LibraryService {
  // Use relative URLs to go through the Vite proxy
  private baseUrl = '';

  async getMetadata() {
    const response = await fetchWithRetry(`${this.baseUrl}/api/library/metadata`);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    return response.json();
  }

  async getMtimeData() {
    const response = await fetchWithRetry(`${this.baseUrl}/api/library/mtime`);
    if (!response.ok) {
      throw new Error(`Failed to fetch mtime data: ${response.statusText}`);
    }
    return response.json();
  }

  async getPhotoMetadata(photoId: string) {
    const response = await fetchWithRetry(`${this.baseUrl}/api/photos/${photoId}/metadata`);
    if (!response.ok) {
      throw new Error(`Failed to fetch photo metadata: ${response.statusText}`);
    }
    return response.json();
  }

  async getPhotos() {
    const response = await fetchWithRetry(`${this.baseUrl}/api/photos`);
    if (!response.ok) {
      throw new Error(`Failed to fetch photos: ${response.statusText}`);
    }
    return response.json();
  }

  async getFolderCounts() {
    const response = await fetchWithRetry(`${this.baseUrl}/api/folders/counts`);
    if (!response.ok) {
      throw new Error(`Failed to fetch folder counts: ${response.statusText}`);
    }
    return response.json();
  }

  async getRecursiveFolderCounts() {
    const response = await fetchWithRetry(`${this.baseUrl}/api/folders/counts/recursive`);
    if (!response.ok) {
      throw new Error(`Failed to fetch recursive folder counts: ${response.statusText}`);
    }
    return response.json();
  }

  async getPhotoCount() {
    const response = await fetchWithRetry(`${this.baseUrl}/api/photos/count`);
    if (!response.ok) {
      throw new Error(`Failed to fetch photo count: ${response.statusText}`);
    }
    const data = await response.json();
    return data.count;
  }

  async getPhotosPaginated(options: {
    folderId?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: string;
    tags?: string[];
  } = {}) {
    const params = new URLSearchParams();
    
    if (options.folderId) {
      params.append('folderId', options.folderId);
    }
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options.offset) {
      params.append('offset', options.offset.toString());
    }
    if (options.orderBy) {
      params.append('orderBy', options.orderBy);
    }
    if (options.orderDirection) {
      params.append('orderDirection', options.orderDirection);
    }
    if (options.tags && options.tags.length > 0) {
      options.tags.forEach(tag => params.append('tags', tag));
    }

    const response = await fetchWithRetry(`${this.baseUrl}/api/photos?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch paginated photos: ${response.statusText}`);
    }
    return response.json();
  }

  getPhotoFileUrl(photoId: string, ext: string, name: string) {
    return `${this.baseUrl}/api/photos/${photoId}/file?ext=${ext}&name=${encodeURIComponent(name)}`;
  }

  getPhotoThumbnailUrl(photoId: string, name: string) {
    return `${this.baseUrl}/api/photos/${photoId}/thumbnail?name=${encodeURIComponent(name)}`;
  }

  async loadLibraryMetadata(): Promise<LibraryMetadata | null> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/library/metadata`);
      if (!response.ok) throw new Error('Failed to load library metadata');
      return await response.json();
    } catch (error) {
      console.error('Error loading library metadata:', error);
      return null;
    }
  }

  async loadMTimeData(): Promise<MTimeData | null> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/library/mtime`);
      if (!response.ok) throw new Error('Failed to load mtime data');
      return await response.json();
    } catch (error) {
      console.error('Error loading mtime data:', error);
      return null;
    }
  }

  async loadPhotoMetadata(photoId: string): Promise<PhotoMetadata | null> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/photos/${photoId}/metadata`);
      if (!response.ok) throw new Error('Failed to load photo metadata');
      return await response.json();
    } catch (error) {
      console.error('Error loading photo metadata:', error);
      return null;
    }
  }

  async loadAllPhotoMetadata(): Promise<PhotoMetadata[]> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/photos`);
      if (!response.ok) throw new Error('Failed to load all photo metadata');
      const data = await response.json();
      return data.photos || data; // Handle both new paginated format and old format
    } catch (error) {
      console.error('Error loading all photo metadata:', error);
      return [];
    }
  }

  async loadFolderCounts(): Promise<{ [folderId: string]: number }> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/folders/counts`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to load folder counts:', error);
      return {};
    }
  }

  async loadRecursiveFolderCounts(): Promise<{ [folderId: string]: number }> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/folders/counts/recursive`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to load recursive folder counts:', error);
      return {};
    }
  }

  async getTotalPhotoCount(): Promise<number> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/photos/count`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error('Failed to get total photo count:', error);
      return 0;
    }
  }

  async loadPaginatedPhotos(
    folderId: string | null, 
    limit: number = 50, 
    offset: number = 0,
    orderBy: string = 'mtime',
    orderDirection: string = 'DESC',
    randomSeed?: number
  ): Promise<{
    photos: PhotoMetadata[];
    total: number;
  }> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        orderBy: orderBy,
        orderDirection: orderDirection
      });
      
      if (randomSeed) {
        params.append('randomSeed', randomSeed.toString());
      }
      
      if (folderId) {
        params.append('folderId', folderId);
      }
      
      const response = await fetchWithRetry(`${this.baseUrl}/api/photos?${params}`);
      if (!response.ok) throw new Error('Failed to load paginated photos');
      return await response.json();
    } catch (error) {
      console.error('Error loading paginated photos:', error);
      return { photos: [], total: 0 };
    }
  }

  async buildFolderCache(photos: PhotoMetadata[], mtimeData: MTimeData): Promise<FolderCache> {
    const photoToFolder: { [photoId: string]: string[] } = {};
    const folderToPhotos: { [folderId: string]: string[] } = {};

    // Build the mapping
    photos.forEach(photo => {
      photoToFolder[photo.id] = photo.folders || [];
      photo.folders?.forEach(folderId => {
        if (!folderToPhotos[folderId]) {
          folderToPhotos[folderId] = [];
        }
        folderToPhotos[folderId].push(photo.id);
      });
    });

    return {
      photoToFolder,
      folderToPhotos,
      lastUpdate: Date.now(),
      mtimeData,
      allPhotos: photos,
    };
  }

  async buildFolderTree(
    folders: FolderMetadata[], 
    photos: PhotoMetadata[], 
    folderCache: FolderCache
  ): Promise<FolderNode[]> {
    const photoMap = new Map(photos.map(p => [p.id, p]));
    
    const buildNode = (folder: FolderMetadata, path: string[] = []): FolderNode => {
      const folderPhotos = folderCache.folderToPhotos[folder.id] || [];
      const nodePhotos = folderPhotos
        .map(photoId => photoMap.get(photoId))
        .filter((p): p is PhotoMetadata => p !== undefined);

      return {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        children: folder.children.map(child => buildNode(child, [...path, folder.name])),
        photos: nodePhotos,
        photoCount: nodePhotos.length,
        modificationTime: folder.modificationTime,
        tags: folder.tags,
        icon: folder.icon,
        path: [...path, folder.name]
      };
    };

    return folders.map(folder => buildNode(folder));
  }

  async checkForUpdates(folderCache: FolderCache | null): Promise<{
    needsUpdate: boolean;
    updatedPhotos: string[];
    newMtimeData: MTimeData | null;
  }> {
    if (!folderCache) {
      return { needsUpdate: true, updatedPhotos: [], newMtimeData: null };
    }

    try {
      const newMtimeData = await this.loadMTimeData();
      if (!newMtimeData) {
        return { needsUpdate: false, updatedPhotos: [], newMtimeData: null };
      }

      const updatedPhotos: string[] = [];
      
      // Check for new photos or modified photos
      for (const [photoId, newMtime] of Object.entries(newMtimeData)) {
        const oldMtime = folderCache.mtimeData[photoId];
        if (!oldMtime || newMtime > oldMtime) {
          updatedPhotos.push(photoId);
        }
      }

      // Check for deleted photos
      for (const photoId of Object.keys(folderCache.mtimeData)) {
        if (!newMtimeData[photoId]) {
          updatedPhotos.push(photoId);
        }
      }

      return {
        needsUpdate: updatedPhotos.length > 0,
        updatedPhotos,
        newMtimeData
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      return { needsUpdate: false, updatedPhotos: [], newMtimeData: null };
    }
  }

  async loadPhotosForFolder(folderId: string | null, allPhotos: PhotoMetadata[]): Promise<PhotoMetadata[]> {
    if (!folderId) {
      return allPhotos; // Root folder - show all photos
    }

    return allPhotos.filter(photo => 
      photo.folders && photo.folders.includes(folderId)
    );
  }

  getFileType(ext: string): string {
    const typeMap: { [key: string]: string } = {
      'jpg': 'JPEG',
      'jpeg': 'JPEG',
      'png': 'PNG',
      'gif': 'GIF',
      'webp': 'WebP',
      'bmp': 'BMP',
      'tiff': 'TIFF',
      'mp4': 'MP4',
      'avi': 'AVI',
      'mov': 'MOV',
      'mkv': 'MKV',
      'mp3': 'MP3',
      'wav': 'WAV',
      'flac': 'FLAC',
      'pdf': 'PDF',
      'epub': 'EPUB',
      'mobi': 'MOBI',
    };
    return typeMap[ext.toLowerCase()] || ext.toUpperCase();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }

  async initializeLibrary(): Promise<{
    folderTree: FolderNode[];
    folderCache: FolderCache;
    allPhotos: PhotoMetadata[];
  } | null> {
    try {
      // Load library metadata
      const libraryMetadata = await this.loadLibraryMetadata();
      if (!libraryMetadata) return null;

      // Load mtime data
      const mtimeData = await this.loadMTimeData();
      if (!mtimeData) return null;

      // Load all photo metadata
      const allPhotos = await this.loadAllPhotoMetadata();

      // Build folder cache
      const folderCache = await this.buildFolderCache(allPhotos, mtimeData);

      // Build folder tree
      const folderTree = await this.buildFolderTree(
        libraryMetadata.folders, 
        allPhotos, 
        folderCache
      );

      return {
        folderTree,
        folderCache,
        allPhotos
      };
    } catch (error) {
      console.error('Error initializing library:', error);
      return null;
    }
  }
}

export const libraryService = new LibraryService(); 