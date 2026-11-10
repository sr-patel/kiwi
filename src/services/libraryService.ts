import { LibraryMetadata, FolderNode, FolderMetadata } from '@/types';
import { kiwiApi } from '@/services/kiwiApi';

import { needsServerPreview } from '@/utils/imageFormats';

/** Built once; `getFileType` runs for every card on every render. */
const FILE_TYPE_LABELS: Record<string, string> = {
  jpg: 'JPEG',
  jpeg: 'JPEG',
  png: 'PNG',
  gif: 'GIF',
  webp: 'WebP',
  bmp: 'BMP',
  tiff: 'TIFF',
  mp4: 'MP4',
  avi: 'AVI',
  mov: 'MOV',
  mkv: 'MKV',
  mp3: 'MP3',
  wav: 'WAV',
  flac: 'FLAC',
  pdf: 'PDF',
  epub: 'EPUB',
  mobi: 'MOBI',
};

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

class LibraryService {
  private baseUrl = '';

  // ─── URL helpers (used by many components) ───

  getPhotoFileUrl(photoId: string, ext: string, name: string): string {
    return `${this.baseUrl}/api/photos/${photoId}/file?ext=${ext}&name=${encodeURIComponent(name)}`;
  }

  /** URL for displaying an image in the browser (transcodes JXL/HEIC via server when needed). */
  getPhotoDisplayUrl(photoId: string, ext: string, name: string): string {
    if (needsServerPreview(ext)) {
      return `${this.baseUrl}/api/photos/${photoId}/preview?ext=${ext}&name=${encodeURIComponent(name)}`;
    }
    return this.getPhotoFileUrl(photoId, ext, name);
  }

  getPhotoThumbnailUrl(photoId: string, name: string, width?: number): string {
    const base = `${this.baseUrl}/api/photos/${photoId}/thumbnail?name=${encodeURIComponent(name)}`;
    return width === undefined ? base : `${base}&w=${width}`;
  }

  /**
   * `srcset` for the same thumbnail at several server-rendered widths.
   * The server snaps each request to a supported step and caches the result.
   */
  getPhotoThumbnailSrcSet(photoId: string, name: string, widths: readonly number[]): string {
    return widths.map((width) => `${this.getPhotoThumbnailUrl(photoId, name, width)} ${width}w`).join(', ');
  }

  // ─── Formatting helpers ───

  getFileType(ext: string): string {
    return FILE_TYPE_LABELS[ext.toLowerCase()] || ext.toUpperCase();
  }

  formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const i = Math.min(SIZE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${SIZE_UNITS[i]}`;
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }

  async loadFolderCounts(): Promise<{ [folderId: string]: number }> {
    return kiwiApi.folders.counts();
  }

  async loadRecursiveFolderCounts(): Promise<{ [folderId: string]: number }> {
    return kiwiApi.folders.counts(true);
  }

  async getTotalPhotoCount(): Promise<number> {
    return (await kiwiApi.photos.count()).count;
  }

  // ─── Internal loaders (used by initializeLibrary) ───

  private async loadLibraryMetadata(): Promise<LibraryMetadata | null> {
    return kiwiApi.library.metadata() as Promise<LibraryMetadata>;
  }

  private async buildFolderTree(folders: FolderMetadata[]): Promise<FolderNode[]> {
    const buildNode = (folder: FolderMetadata, nodePath: string[] = []): FolderNode => {
      return {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        children: folder.children.map((child) => buildNode(child, [...nodePath, folder.name])),
        photos: [],
        photoCount: 0,
        modificationTime: folder.modificationTime,
        tags: folder.tags,
        icon: folder.icon,
        path: [...nodePath, folder.name],
      };
    };

    return folders.map((folder) => buildNode(folder));
  }

  async refreshFolderTree(): Promise<FolderNode[] | null> {
    try {
      const libraryMetadata = await this.loadLibraryMetadata();
      if (!libraryMetadata) return null;
      return this.buildFolderTree(libraryMetadata.folders);
    } catch (error) {
      console.error('Error refreshing folder tree:', error);
      return null;
    }
  }

  // ─── Top-level initialization ───

  async initializeLibrary(): Promise<{
    folderTree: FolderNode[];
  } | null> {
    try {
      const libraryMetadata = await this.loadLibraryMetadata();
      if (!libraryMetadata) return null;

      const folderTree = await this.buildFolderTree(libraryMetadata.folders);
      return { folderTree };
    } catch (error) {
      console.error('Error initializing library:', error);
      return null;
    }
  }
}

export const libraryService = new LibraryService();
