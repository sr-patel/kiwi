export interface PhotoRecord {
  id: string;
  name: string;
  ext: string;
  size?: number;
  [key: string]: unknown;
}

export interface PhotosPageRecord {
  photos: PhotoRecord[];
  total: number;
  totalSize?: number;
  hasMore?: boolean;
}

export interface LegacyDatabase {
  initialize(): Promise<boolean>;
  close(): void;
  getStats(): Promise<
    Record<string, unknown> & {
      totalPhotos: number;
      dbSize: number;
      typeStats?: Array<{ type: string; count: number }>;
    }
  >;
  getDashboardAnalytics(): Promise<
    Record<string, unknown> & { topFolders: Array<{ folderId: string; count: number }> }
  >;
  getCacheInfo(key: string): Promise<unknown>;
  getPhotos(options?: Record<string, unknown>): Promise<PhotoRecord[]>;
  getPhotosPaginated(options: Record<string, unknown>): Promise<PhotosPageRecord>;
  searchPhotos(options: Record<string, unknown>): Promise<PhotoRecord[]>;
  getSearchCount(options: Record<string, unknown>): Promise<number>;
  getSearchTotalSize(options: Record<string, unknown>): Promise<number>;
  getPhotoById(id: string): Promise<PhotoRecord | null>;
  syncPhoto(photo: Record<string, unknown>, folders?: string[], tags?: string[]): boolean;
  getFoldersForPhoto(id: string): Promise<string[]>;
  getPhotoCount(options?: Record<string, unknown>): Promise<number>;
  getPhotoCountsByFolder(): Promise<Record<string, number>>;
  getPhotoCountForFolder(id: string): Promise<number>;
  getRecursivePhotoCountForFolder(id: string): Promise<number>;
  getRecursiveFolderCounts(tree: unknown[]): Promise<Record<string, number>>;
  getFirstImageInFolder(id: string): PhotoRecord | null;
  getAllTags(): Promise<Array<{ tag: string }>>;
  getTagCounts(): Promise<Record<string, number>>;
  getTagCoOccurrences(options: Record<string, unknown>): Promise<unknown[]>;
  getPhotosByTagsPaginated(options: Record<string, unknown>): Promise<PhotosPageRecord>;
  getPhotosByTagPaginated(options: Record<string, unknown>): Promise<PhotosPageRecord>;
}

export interface LegacyDatabaseConstructor {
  new (databasePath: string): LegacyDatabase;
}

export interface WatcherStatus {
  isWatching?: boolean;
  processing?: boolean;
  pendingCount?: number;
  [key: string]: unknown;
}
