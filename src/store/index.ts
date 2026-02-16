import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, AppActions, FolderCache, FolderNode, PhotoMetadata } from '@/types';
import { cacheService } from '@/services/cacheService';

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentLibraryPath: null,
      sidebarOpen: false,
      sidebarWidth: 256, // Default width of 256px (w-64)
      isLoading: false,
      theme: 'light',
      isMobile: false,
      accentColor: 'kiwi',
      settingsOpen: false,
      currentFolder: null,
      currentTag: null,
      folderCache: null,
      folderTree: null,
      allPhotos: null,
      currentView: {
        type: 'grid',
        thumbnailSize: 'medium',
      },
      filters: {
        tags: [],
        fileTypes: [],
      },
      sortOptions: {
        field: 'date',
        direction: 'desc',
        randomSeed: undefined,
      },
      selectedItems: [],
      detailedPhoto: null,
      searchQuery: '',
      // Captured navigation list of photo IDs from the grid at open time
      navigationList: [],
      cacheProgress: {
        current: 0,
        total: 0,
        isCaching: false
      },
      scrollPositions: {} as { [folderId: string]: number }, // Track scroll position per folder
      
      // Podcast Mode State
      podcastMode: {
        enabled: false,
        audioTimeTracking: {} as { [audioId: string]: number },
      },
      
      // Audio Player State
      audioPlayer: {
        isOpen: false,
        currentAudio: null,
        playlist: [],
        currentIndex: -1,
        isPlaying: false,
        volume: 1,
        isMuted: false,
        isShuffled: false,
        isLooped: false,
        currentTime: 0
      },
      isMiniPlayer: false,
      
      // UI Preferences
      useFolderThumbnails: false,
      enableColorIntegration: true,
      enablePodcastMode: false,
      defaultLandingPage: 'dashboard',
      requestPageSize: 50,
      infoBoxSize: 100, // Percentage size of info box (50-150%)
      hideControlsWithInfoBox: false, // Hide top controls when info box is hidden
      autoplayGifsInGrid: false,
      transitionEffect: 'slide',

      // Visualizer Settings
      visualizerSettings: {
        visBarCount: 32,
        visBarRound: 0.4,
        visGlow: 12,
        visOpacity: 0.8,
        visType: 'Bars',
        visSmoothing: 0.7,
      },

      // Actions
      setCurrentLibraryPath: (path: string) => set({ currentLibraryPath: path }),
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      setSidebarWidth: (width: number) => set({ sidebarWidth: width }),
      setIsLoading: (loading: boolean) => set({ isLoading: loading }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setIsMobile: (isMobile: boolean) => set({ isMobile }),
      setAccentColor: (color: AppState['accentColor']) => set({ accentColor: color }),
      setUseFolderThumbnails: (value: boolean) => set({ useFolderThumbnails: value }),
      setEnableColorIntegration: (value: boolean) => set({ enableColorIntegration: value }),
      setEnablePodcastMode: (value: boolean) => set({ enablePodcastMode: value }),
      setDefaultLandingPage: (page: 'dashboard' | 'all') => set({ defaultLandingPage: page }),
      setAutoplayGifsInGrid: (value: boolean) => set({ autoplayGifsInGrid: value }),
      setRequestPageSize: (size: number) => set({ requestPageSize: Math.max(10, Math.min(500, Math.floor(size))) }),
      setInfoBoxSize: (size: number) => set({ infoBoxSize: Math.max(50, Math.min(150, Math.floor(size))) }),
      setHideControlsWithInfoBox: (value: boolean) => set({ hideControlsWithInfoBox: value }),
      setTransitionEffect: (effect) => set({ transitionEffect: effect }),
      setSettingsOpen: (open: boolean) => set({ settingsOpen: open }),
      
      setCurrentFolder: (folderId: string | null) => {
        console.log('Setting current folder:', folderId);
        set({ currentFolder: folderId });
      },
      
      setCurrentTag: (tag: string | null) => {
        console.log('Setting current tag:', tag);
        set({ currentTag: tag });
      },
      
      setFolderCache: async (cache: FolderCache | null) => {
        set({ folderCache: cache });
        if (cache) {
          try {
            console.log('Caching folder structure...');
            await cacheService.saveLibraryCache(cache);
            console.log('Folder structure cached successfully');
          } catch (error) {
            console.error('Failed to save folder cache to IndexedDB:', error);
          }
        }
      },
      
      setFolderTree: async (tree: FolderNode[] | null) => {
        set({ folderTree: tree });
        if (tree) {
          try {
            console.log('Caching folder tree...');
            await cacheService.saveFolderTree(tree);
            console.log('Folder tree cached successfully');
          } catch (error) {
            console.error('Failed to save folder tree to IndexedDB:', error);
          }
        }
      },
      
      setAllPhotos: async (photos: PhotoMetadata[] | null) => {
        set({ allPhotos: photos });
        if (photos) {
          try {
            // Set caching progress state
            set({ 
              cacheProgress: { 
                current: 0, 
                total: photos.length, 
                isCaching: true 
              } 
            });

            await cacheService.savePhotos(photos, (current, total) => {
              set({ 
                cacheProgress: { 
                  current, 
                  total, 
                  isCaching: true 
                } 
              });
            });

            // Clear progress when done
            set({ 
              cacheProgress: { 
                current: 0, 
                total: 0, 
                isCaching: false 
              } 
            });
          } catch (error) {
            console.error('Failed to save photos to IndexedDB:', error);
            // Clear progress on error
            set({ 
              cacheProgress: { 
                current: 0, 
                total: 0, 
                isCaching: false 
              } 
            });
          }
        }
      },
      
      setCurrentView: (view) => set({ currentView: view }),
      setFilters: (filters) => set({ filters }),
      setSortOptions: (sortOptions) => set({ sortOptions }),
      // Helper to refresh random order consistently across app
      shuffleRandomOrder: () => set((state) => ({
        sortOptions: {
          ...state.sortOptions,
          randomSeed: Date.now(),
        }
      })),
      
      setSelectedItems: (items: string[]) => set({ selectedItems: items }),
      toggleSelectedItem: (itemId: string) => set((state) => ({
        selectedItems: state.selectedItems.includes(itemId)
          ? state.selectedItems.filter(id => id !== itemId)
          : [...state.selectedItems, itemId]
      })),
      
      setDetailedPhoto: (photoId: string | null) => {
        console.log('setDetailedPhoto called with:', photoId);
        set({ detailedPhoto: photoId });
      },
      setNavigationList: (ids: string[]) => set({ navigationList: ids }),
      
      setSearchQuery: (query: string) => {
        console.log('setSearchQuery called with:', query);
        set({ searchQuery: query });
      },
      
      saveScrollPosition: (position: number) => {
        const state = get();
        const currentFolder = state.currentFolder;
        const currentTag = state.currentTag;
        
        // Create a unique key for the current view (folder, tag, or root)
        let viewKey = 'root'; // Default for root view (all photos)
        if (currentFolder) {
          viewKey = `folder-${currentFolder}`;
        } else if (currentTag) {
          viewKey = `tag-${currentTag}`;
        }
        
        console.log('Saving scroll position for view:', viewKey, 'position:', position);
        set((state) => ({
          scrollPositions: {
            ...state.scrollPositions,
            [viewKey]: position
          }
        }));
      },
      
      restoreScrollPosition: () => {
        const state = get();
        const currentFolder = state.currentFolder;
        const currentTag = state.currentTag;
        
        // Create the same unique key for the current view
        let viewKey = 'root'; // Default for root view (all photos)
        if (currentFolder) {
          viewKey = `folder-${currentFolder}`;
        } else if (currentTag) {
          viewKey = `tag-${currentTag}`;
        }
        
        const scrollPosition = state.scrollPositions[viewKey] || 0;
        console.log('Restoring scroll position for view:', viewKey, 'position:', scrollPosition);
        if (scrollPosition > 0) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            console.log('Executing scroll to:', scrollPosition);
            window.scrollTo({ top: scrollPosition, behavior: 'instant' });
          });
        }
      },
      
      clearScrollPosition: (viewId?: string) => {
        const state = get();
        const currentFolder = state.currentFolder;
        const currentTag = state.currentTag;
        
        // Determine which view to clear
        let viewKey: string;
        if (viewId) {
          viewKey = viewId;
        } else {
          // Clear current view
          viewKey = 'root'; // Default for root view
          if (currentFolder) {
            viewKey = `folder-${currentFolder}`;
          } else if (currentTag) {
            viewKey = `tag-${currentTag}`;
          }
        }
        
        console.log('Clearing scroll position for view:', viewKey);
        set((state) => {
          const newScrollPositions = { ...state.scrollPositions };
          delete newScrollPositions[viewKey];
          return { scrollPositions: newScrollPositions };
        });
      },
      
      // Podcast Mode Actions
      togglePodcastMode: () => set((state) => ({
        podcastMode: {
          ...state.podcastMode,
          enabled: !state.podcastMode.enabled
        }
      })),
      
      saveAudioTime: (audioId: string, time: number) => set((state) => ({
        podcastMode: {
          ...state.podcastMode,
          audioTimeTracking: {
            ...state.podcastMode.audioTimeTracking,
            [audioId]: time
          }
        }
      })),
      
      getAudioTime: (audioId: string) => {
        const state = get();
        return state.podcastMode.audioTimeTracking[audioId] || 0;
      },
      
      clearAudioTime: (audioId: string) => set((state) => {
        const newTimeTracking = { ...state.podcastMode.audioTimeTracking };
        delete newTimeTracking[audioId];
        return {
          podcastMode: {
            ...state.podcastMode,
            audioTimeTracking: newTimeTracking
          }
        };
      }),
      
      clearAllAudioTimes: () => set((state) => ({
        podcastMode: {
          ...state.podcastMode,
          audioTimeTracking: {}
        }
      })),
      
      // Cache management actions
      loadFromCache: async () => {
        try {
          const [cache, tree, photos] = await Promise.all([
            cacheService.getLibraryCache(),
            cacheService.getFolderTree(),
            cacheService.getPhotos()
          ]);

          if (cache && tree && photos) {
            set({ folderCache: cache, folderTree: tree, allPhotos: photos });
            return true;
          }
          return false;
        } catch (error) {
          console.error('Failed to load from cache:', error);
          return false;
        }
      },

      clearCache: async () => {
        try {
          await cacheService.clearCache();
          set({ folderCache: null, folderTree: null, allPhotos: null });
        } catch (error) {
          console.error('Failed to clear cache:', error);
        }
      },

      getCacheSize: async () => {
        try {
          return await cacheService.getCacheSize();
        } catch (error) {
          console.error('Failed to get cache size:', error);
          return 0;
        }
      },

      isCacheValid: async (maxAge?: number) => {
        try {
          return await cacheService.isCacheValid(maxAge);
        } catch (error) {
          console.error('Failed to check cache validity:', error);
          return false;
        }
      },

      // Audio Player Actions
      openAudioPlayer: (audio: any, playlist?: any[]) => set((state) => ({
        audioPlayer: {
          ...state.audioPlayer,
          isOpen: true,
          currentAudio: audio,
          playlist: playlist || [audio],
          currentIndex: playlist ? playlist.findIndex(item => item.id === audio.id) : 0
        }
      })),
      
      closeAudioPlayer: () => set((state) => ({
        audioPlayer: {
          ...state.audioPlayer,
          isOpen: false,
          currentAudio: null,
          playlist: [],
          currentIndex: -1,
          isPlaying: false
        }
      })),
      
      setAudioPlayerState: (updates: Partial<AppState['audioPlayer']>) => set((state) => ({
        audioPlayer: {
          ...state.audioPlayer,
          ...updates
        }
      })),
      
      playNextAudio: () => set((state) => {
        const { audioPlayer } = state;
        if (audioPlayer.playlist.length === 0) return state;
        
        let nextIndex = audioPlayer.currentIndex + 1;
        if (nextIndex >= audioPlayer.playlist.length) {
          nextIndex = 0; // Loop to beginning
        }
        
        return {
          audioPlayer: {
            ...audioPlayer,
            currentAudio: audioPlayer.playlist[nextIndex],
            currentIndex: nextIndex
          }
        };
      }),
      
      playPreviousAudio: () => set((state) => {
        const { audioPlayer } = state;
        if (audioPlayer.playlist.length === 0) return state;
        
        let prevIndex = audioPlayer.currentIndex - 1;
        if (prevIndex < 0) {
          prevIndex = audioPlayer.playlist.length - 1; // Loop to end
        }
        
        return {
          audioPlayer: {
            ...audioPlayer,
            currentAudio: audioPlayer.playlist[prevIndex],
            currentIndex: prevIndex
          }
        };
      }),

      setMiniPlayer: (value: boolean) => set({ isMiniPlayer: value }),

      // Visualizer Settings Actions
      setVisualizerSettings: (settings: Partial<AppState['visualizerSettings']>) => set((state) => ({
        visualizerSettings: {
          ...state.visualizerSettings,
          ...settings
        }
      })),
    }),
    {
      name: 'kiwi-app-storage',
      partialize: (state) => ({
        // Only persist user preferences, not large data
        theme: state.theme,
        accentColor: state.accentColor,
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        currentView: state.currentView,
        filters: state.filters,
        sortOptions: state.sortOptions,
        podcastMode: state.podcastMode,
        visualizerSettings: state.visualizerSettings, // Persist visualizer settings
        useFolderThumbnails: state.useFolderThumbnails,
        enableColorIntegration: state.enableColorIntegration,
        enablePodcastMode: state.enablePodcastMode,
        defaultLandingPage: state.defaultLandingPage,
        requestPageSize: state.requestPageSize,
        infoBoxSize: state.infoBoxSize,
        hideControlsWithInfoBox: state.hideControlsWithInfoBox,
        transitionEffect: state.transitionEffect,
        audioPlayer: {
          volume: state.audioPlayer.volume,
          isMuted: state.audioPlayer.isMuted,
          isShuffled: state.audioPlayer.isShuffled,
          isLooped: state.audioPlayer.isLooped,
        }, // Persist audio player preferences
        // Large data is stored in IndexedDB, not localStorage
      }),
    }
  )
); 