import { PhotoMetadata, LibraryMetadata, FolderCache, FolderNode, FolderMetadata, MTimeData } from '@/types';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';

class LibraryService {
  private baseUrl = '';

  // ─── URL helpers (used by many components) ───

  getPhotoFileUrl(photoId: string, ext: string, name: string): string {
    return `${this.baseUrl}/api/photos/${photoId}/file?ext=${ext}&name=${encodeURIComponent(name)}`;
  }

  getPhotoThumbnailUrl(photoId: string, name: string): string {
    return `${this.baseUrl}/api/photos/${photoId}/thumbnail?name=${encodeURIComponent(name)}`;
  }

  // ─── Formatting helpers ───

  getFileType(ext: string): string {
    const typeMap: { [key: string]: string } = {
      jpg: 'JPEG', jpeg: 'JPEG', png: 'PNG', gif: 'GIF', webp: 'WebP',
      bmp: 'BMP', tiff: 'TIFF', mp4: 'MP4', avi: 'AVI', mov: 'MOV',
      mkv: 'MKV', mp3: 'MP3', wav: 'WAV', flac: 'FLAC', pdf: 'PDF',
      epub: 'EPUB', mobi: 'MOBI',
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

  // ─── Paginated / counted API calls (used by hooks) ───

  async loadPaginatedPhotos(
    folderId: string | null,
    limit = 50,
    offset = 0,
    orderBy = 'mtime',
    orderDirection = 'DESC',
    randomSeed?: number,
  ): Promise<{ photos: PhotoMetadata[]; total: number }> {
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset), orderBy, orderDirection });
      if (randomSeed) params.append('randomSeed', String(randomSeed));
      if (folderId) params.append('folderId', folderId);
      const response = await fetchWithRetry(`${this.baseUrl}/api/photos?${params}`);
      if (!response.ok) throw new Error('Failed to load paginated photos');
      return await response.json();
    } catch (error) {
      console.error('Error loading paginated photos:', error);
      return { photos: [], total: 0 };
    }
  }

  async loadFolderCounts(): Promise<{ [folderId: string]: number }> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/folders/counts`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load folder counts:', error);
      return {};
    }
  }

  async loadRecursiveFolderCounts(): Promise<{ [folderId: string]: number }> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/folders/counts/recursive`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load recursive folder counts:', error);
      return {};
    }
  }

  async getTotalPhotoCount(): Promise<number> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/photos/count`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error('Failed to get total photo count:', error);
      return 0;
    }
  }

  // ─── Internal loaders (used by initializeLibrary) ───

  private async loadLibraryMetadata(): Promise<LibraryMetadata | null> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/library/metadata`);
      if (!response.ok) throw new Error('Failed to load library metadata');
      return await response.json();
    } catch (error) {
      console.error('Error loading library metadata:', error);
      return null;
    }
  }

  private async loadMTimeData(): Promise<MTimeData | null> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/library/mtime`);
      if (!response.ok) throw new Error('Failed to load mtime data');
      return await response.json();
    } catch (error) {
      console.error('Error loading mtime data:', error);
      return null;
    }
  }

  private async loadAllPhotoMetadata(): Promise<PhotoMetadata[]> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/photos`);
      if (!response.ok) throw new Error('Failed to load all photo metadata');
      const data = await response.json();
      return data.photos || data;
    } catch (error) {
      console.error('Error loading all photo metadata:', error);
      return [];
    }
  }

  private async buildFolderCache(photos: PhotoMetadata[], mtimeData: MTimeData): Promise<FolderCache> {
    const photoToFolder: { [photoId: string]: string[] } = {};
    const folderToPhotos: { [folderId: string]: string[] } = {};

    photos.forEach(photo => {
      photoToFolder[photo.id] = photo.folders || [];
      photo.folders?.forEach(folderId => {
        if (!folderToPhotos[folderId]) folderToPhotos[folderId] = [];
        folderToPhotos[folderId].push(photo.id);
      });
    });

    return { photoToFolder, folderToPhotos, lastUpdate: Date.now(), mtimeData };
  }

  private async buildFolderTree(
    folders: FolderMetadata[],
    photos: PhotoMetadata[],
    folderCache: FolderCache,
  ): Promise<FolderNode[]> {
    const photoMap = new Map(photos.map(p => [p.id, p]));

    const buildNode = (folder: FolderMetadata, nodePath: string[] = []): FolderNode => {
      const folderPhotos = folderCache.folderToPhotos[folder.id] || [];
      const nodePhotos = folderPhotos
        .map(id => photoMap.get(id))
        .filter((p): p is PhotoMetadata => p !== undefined);

      return {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        children: folder.children.map(child => buildNode(child, [...nodePath, folder.name])),
        photos: nodePhotos,
        photoCount: nodePhotos.length,
        modificationTime: folder.modificationTime,
        tags: folder.tags,
        icon: folder.icon,
        path: [...nodePath, folder.name],
      };
    };

    return folders.map(folder => buildNode(folder));
  }

  // ─── Top-level initialization ───

  async initializeLibrary(): Promise<{
    folderTree: FolderNode[];
    folderCache: FolderCache;
    allPhotos: PhotoMetadata[];
  } | null> {
    try {
      const libraryMetadata = await this.loadLibraryMetadata();
      if (!libraryMetadata) return null;

      const mtimeData = await this.loadMTimeData();
      if (!mtimeData) return null;

      const allPhotos = await this.loadAllPhotoMetadata();
      const folderCache = await this.buildFolderCache(allPhotos, mtimeData);
      const folderTree = await this.buildFolderTree(libraryMetadata.folders, allPhotos, folderCache);

      return { folderTree, folderCache, allPhotos };
    } catch (error) {
      console.error('Error initializing library:', error);
      return null;
    }
  }
}

export const libraryService = new LibraryService();
