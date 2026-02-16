export interface PhotoMetadata {
  id: string;
  name: string;
  size: number;
  btime: number;
  mtime: number;
  ext: string;
  tags: string[];
  folders: string[];
  isDeleted: boolean;
  url: string;
  annotation: string;
  modificationTime: number;
  width: number;
  height: number;
  lastModified: number;
  palettes?: Array<{
    color: number[];
    ratio: number;
  }>;
  // Video-specific fields
  duration?: number;
  fps?: number;
  bitrate?: number;
  codec?: string;
  // Audio-specific fields
  sampleRate?: number;
  channels?: number;
  // Camera/EXIF fields (optional)
  camera?: string;
  dateTime?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_altitude?: number;
  exif_data?: string;
}

export interface FolderMetadata {
  id: string;
  name: string;
  description: string;
  children: FolderMetadata[];
  modificationTime: number;
  tags: string[];
  extendTags: string[];
  pinyin: string;
  password: string;
  passwordTips: string;
  icon?: string;
}

export interface LibraryMetadata {
  folders: FolderMetadata[];
  smartFolders: any[];
  quickAccess: any[];
  tagsGroups: any[];
  modificationTime: number;
  applicationVersion: string;
}

export interface MTimeData {
  [photoId: string]: number;
}

export interface FolderCache {
  photoToFolder: { [photoId: string]: string[] };
  folderToPhotos: { [folderId: string]: string[] };
  lastUpdate: number;
  mtimeData: MTimeData;
}

export interface FolderNode {
  id: string;
  name: string;
  description: string;
  children: FolderNode[];
  photos: PhotoMetadata[];
  photoCount: number;
  modificationTime: number;
  tags: string[];
  icon?: string;
  path: string[];
}

export interface AppState {
  currentLibraryPath: string | null;
  sidebarOpen: boolean;
  sidebarWidth: number;
  isLoading: boolean;
  theme: 'light' | 'dark';
  isMobile: boolean;
  accentColor: 'kiwi' | 'orange' | 'blue' | 'green' | 'purple' | 'red' | 'pink' | 'teal' | 'indigo' | 'cyan' | 'lime' | 'amber';
  settingsOpen: boolean;
  currentFolder: string | null;
  currentTag: string | null;
  folderCache: FolderCache | null;
  folderTree: FolderNode[] | null;
  allPhotos: PhotoMetadata[] | null;
  currentView: {
    type: 'grid' | 'list';
    thumbnailSize: 'small' | 'medium' | 'large';
  };
  filters: {
    tags: string[];
    fileTypes: string[];
  };
  sortOptions: {
    field: 'name' | 'date' | 'date_created' | 'date_updated' | 'size' | 'type' | 'dimensions' | 'tags' | 'random';
    direction: 'asc' | 'desc';
    randomSeed?: number;
  };
  selectedItems: string[];
  navigationList: string[]; // exact order from grid used for detailed navigation
  detailedPhoto: string | null;
  searchQuery: string;
  cacheProgress: {
    current: number;
    total: number;
    isCaching: boolean;
  };
  scrollPositions: { [folderId: string]: number };
  
  // Podcast Mode State
  podcastMode: {
    enabled: boolean;
    audioTimeTracking: { [audioId: string]: number }; // Track last played time for each audio file
  };
  
  // Audio Player State
  audioPlayer: {
    isOpen: boolean;
    currentAudio: PhotoMetadata | null;
    playlist: PhotoMetadata[];
    currentIndex: number;
    isPlaying: boolean;
    volume: number;
    isMuted: boolean;
    isShuffled: boolean;
    isLooped: boolean;
    currentTime: number;
  };
  isMiniPlayer: boolean;
  
  // UI Preferences
  useFolderThumbnails?: boolean;
  enableColorIntegration?: boolean;
  enablePodcastMode?: boolean;
  defaultLandingPage?: 'dashboard' | 'all';
  requestPageSize: number;
  infoBoxSize: number;
  hideControlsWithInfoBox?: boolean;
  transitionEffect?: 'none' | 'slide' | 'fade' | 'zoom';
  
  // Visualizer Settings
  visualizerSettings: {
    visBarCount: number;
    visBarRound: number;
    visGlow: number;
    visOpacity: number;
    visType: string;
    visSmoothing: number;
  };

  // Media preferences
  autoplayGifsInGrid?: boolean;
}

export interface AppActions {
  setCurrentLibraryPath: (path: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setIsLoading: (loading: boolean) => void;
  toggleTheme: () => void;
  setIsMobile: (isMobile: boolean) => void;
  setAccentColor: (color: AppState['accentColor']) => void;
  setSettingsOpen: (open: boolean) => void;
  setCurrentFolder: (folderId: string | null) => void;
  setCurrentTag: (tag: string | null) => void;
  setFolderCache: (cache: FolderCache | null) => Promise<void>;
  setFolderTree: (tree: FolderNode[] | null) => Promise<void>;
  setAllPhotos: (photos: PhotoMetadata[] | null) => Promise<void>;
  setCurrentView: (view: AppState['currentView']) => void;
  setFilters: (filters: AppState['filters']) => void;
  setSortOptions: (sortOptions: AppState['sortOptions']) => void;
  setSelectedItems: (items: string[]) => void;
  toggleSelectedItem: (itemId: string) => void;
  setDetailedPhoto: (photoId: string | null) => void;
  setSearchQuery: (query: string) => void;
  // Cache management actions
  loadFromCache: () => Promise<boolean>;
  clearCache: () => Promise<void>;
  getCacheSize: () => Promise<number>;
  isCacheValid: (maxAge?: number) => Promise<boolean>;
  saveScrollPosition: (position: number) => void;
  restoreScrollPosition: () => void;
  clearScrollPosition: (folderId?: string) => void;
  
  // Podcast Mode Actions
  togglePodcastMode: () => void;
  saveAudioTime: (audioId: string, time: number) => void;
  getAudioTime: (audioId: string) => number;
  clearAudioTime: (audioId: string) => void;
  clearAllAudioTimes: () => void;
  
  // Audio Player Actions
  openAudioPlayer: (audio: PhotoMetadata, playlist?: PhotoMetadata[]) => void;
  closeAudioPlayer: () => void;
  setAudioPlayerState: (updates: Partial<AppState['audioPlayer']>) => void;
  playNextAudio: () => void;
  playPreviousAudio: () => void;
  setMiniPlayer: (value: boolean) => void;
  
  // Visualizer Settings Actions
  setVisualizerSettings: (settings: Partial<AppState['visualizerSettings']>) => void;
  
  // UI Preferences Actions
  setUseFolderThumbnails: (value: boolean) => void;
  setEnableColorIntegration: (value: boolean) => void;
  setEnablePodcastMode: (value: boolean) => void;
  setDefaultLandingPage: (page: 'dashboard' | 'all') => void;
  setAutoplayGifsInGrid: (value: boolean) => void;
  setRequestPageSize: (size: number) => void;
  setInfoBoxSize: (size: number) => void;
  setHideControlsWithInfoBox: (value: boolean) => void;
  setTransitionEffect: (effect: 'none' | 'slide' | 'fade' | 'zoom') => void;
  setNavigationList: (ids: string[]) => void;
  shuffleRandomOrder: () => void;
}

export interface TagsData {
  historyTags: string[];
  starredTags: string[];
}

export interface FilterOptions {
  tags: string[];
  folders: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  fileTypes: string[];
  sizeRange: {
    min: number | null;
    max: number | null;
  };
}

export interface SortOptions {
  field: 'name' | 'date' | 'date_created' | 'date_updated' | 'size' | 'type' | 'dimensions' | 'tags' | 'random';
  direction: 'asc' | 'desc';
}

export interface ViewMode {
  type: 'grid' | 'list' | 'masonry';
  thumbnailSize: 'small' | 'medium' | 'large';
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  defaultView: ViewMode;
  defaultSort: SortOptions;
  autoRefresh: boolean;
  thumbnailQuality: 'low' | 'medium' | 'high';
}

export interface PaginatedPhotosResponse {
  photos: PhotoMetadata[];
  total: number;
  totalSize: number;
} 