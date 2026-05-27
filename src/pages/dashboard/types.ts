export interface WatcherActivityEntry {
  id: number;
  timestamp: string;
  type: string;
  message: string;
  photoId?: string;
  photoName?: string;
  details?: Record<string, unknown>;
}

export interface SyncStatus {
  running: boolean;
  libraryPath: string | null;
  lastEvent: string | null;
  lastEventTime: string | null;
  lastError: string | null;
  pendingCount: number;
  processedCount: number;
  lastReconcileTime: string | null;
  activityLog: WatcherActivityEntry[];
}

export interface DashboardAnalytics {
  timelineByMonth: { month: string; count: number }[];
  storageByGroup: { group: string; totalSize: number; count: number }[];
  topTags: { tag: string; count: number }[];
  topFolders: { folderId: string; name: string; count: number }[];
  resolutionBuckets: { bucket: string; count: number }[];
  orientationStats: { landscape: number; portrait: number; square: number };
  summary: {
    avgFileSize: number;
    taggedPhotos: number;
    untaggedPhotos: number;
    imageCount: number;
  };
}

export interface DashboardStats {
  totalPhotos: number;
  totalFolders: number;
  totalTags: number;
  totalSize: number;
  dbSize: number;
  lastRefresh: string | null;
  fileTypes: { [key: string]: number };
  typeStats?: { type: string; count: number }[];
  extensionStats?: {
    ext: string;
    count: number;
    avgSize: number;
    totalSize: number;
  }[];
  analytics?: DashboardAnalytics;
}
