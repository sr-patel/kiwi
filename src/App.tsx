import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from '@/components/Layout/Sidebar';
import { PhotoGrid } from '@/components/PhotoGrid/PhotoGrid';
// import { Settings } from '@/components/Settings/Settings';
import SettingsPage from '@/pages/SettingsPage';
import { AdminDatabaseStatus } from '@/pages/AdminDatabaseStatus';
import { VirtualScrollingTestPage } from '@/pages/VirtualScrollingTestPage';
import { PreloadingTest } from '@/components/PreloadingTest/PreloadingTest';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import { configService } from '@/services/configService';
import { Moon, Sun, Settings as SettingsIcon } from 'lucide-react';
import { getAccentHex } from '@/utils/accentColors';
import { DetailedPhotoModal } from '@/components/DetailedView/DetailedPhotoModal';
import { AudioPlayer } from '@/components/AudioPlayer/AudioPlayer';
import { Breadcrumbs } from '@/components/Breadcrumbs/Breadcrumbs';
import { parseFolderPathFromUrl } from '@/utils/folderUrls';
import { parseTagFromUrl } from '@/utils/tagUrls';
import { MiniAudioPlayer } from '@/components/AudioPlayer/MiniAudioPlayer';
import { AudioProvider } from '@/components/AudioPlayer/AudioProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { ApiErrorBoundary } from '@/components/ErrorBoundary/ApiErrorBoundary';
import { SplashScreen } from '@/components/SplashScreen/SplashScreen';
import './App.css';

// Component to handle root routing (All Files)
const RootRoute: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
  const { setCurrentFolder, setCurrentTag } = useAppStore();

  useEffect(() => {
    // Clear folder and tag selection when on root route
    setCurrentFolder(null);
    setCurrentTag(null);
  }, [setCurrentFolder, setCurrentTag]);

  return (
    <ApiErrorBoundary>
      <PhotoGrid isMobile={isMobile} />
    </ApiErrorBoundary>
  );
};

// Component to handle tag routing
const TagRoute: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
  const { tagPath } = useParams<{ tagPath: string }>();
  const { setCurrentFolder, setCurrentTag } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (tagPath) {
      const tag = parseTagFromUrl(tagPath);
      if (tag) {
        setCurrentTag(tag);
        setCurrentFolder(null);
      } else {
        // Invalid tag, redirect to root
        navigate('/', { replace: true });
      }
    } else {
      // No tag path, clear tag selection
      setCurrentTag(null);
      setCurrentFolder(null);
    }
  }, [tagPath, setCurrentTag, setCurrentFolder, navigate]);

  return (
    <ApiErrorBoundary>
      <PhotoGrid isMobile={isMobile} />
    </ApiErrorBoundary>
  );
};

// Component to handle folder routing
const FolderRoute: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
  const { '*': folderPath } = useParams<{ '*': string }>();
  const { folderTree, setCurrentFolder, setCurrentTag } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (folderPath && folderTree) {
      const folderId = parseFolderPathFromUrl(folderPath, folderTree);
      if (folderId) {
        setCurrentFolder(folderId);
        setCurrentTag(null);
      } else {
        // Folder not found, redirect to root
        navigate('/', { replace: true });
      }
    } else if (!folderPath) {
      // Root path, clear folder selection
      setCurrentFolder(null);
      setCurrentTag(null);
    }
  }, [folderPath, folderTree, setCurrentFolder, setCurrentTag, navigate]);

  return (
    <ApiErrorBoundary>
      <PhotoGrid isMobile={isMobile} />
    </ApiErrorBoundary>
  );
};

function App() {
  const { 
    sidebarOpen, 
    setSidebarOpen, 
    sidebarWidth,
    currentLibraryPath,
    setCurrentLibraryPath,
    setIsLoading,
    theme,
    toggleTheme,
    isMobile,
    setIsMobile,
    // folderCache,
    // setFolderCache,
    // folderTree,
    // currentFolder,
    // currentTag,
    setCurrentFolder,
    setCurrentTag,
    setFolderTree,
    setAllPhotos,
    // settingsOpen,
    // setSettingsOpen,
    // currentView,
    // setCurrentView,
    // filters,
    // setFilters,
    // sortOptions,
    // setSortOptions,
    // selectedItems,
    // setSelectedItems,
    // detailedPhoto,
    // setDetailedPhoto,
    // addSMBConnection,
    // removeSMBConnection,
    // smbConnections,
    accentColor,
    // setAccentColor,
    loadFromCache,
    clearCache,
    // getCacheSize,
    isCacheValid,
    cacheProgress,
    audioPlayer,
    // openAudioPlayer,
    closeAudioPlayer,
    playNextAudio,
    playPreviousAudio,
    isMiniPlayer,
  } = useAppStore();

  const navigate = useNavigate();
  const [showSplash, setShowSplash] = React.useState(true);
  const { folderTree } = useAppStore();

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Auto-close sidebar on mobile
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setIsMobile, sidebarOpen, setSidebarOpen]);

  // Initialize library with IndexedDB caching
  useEffect(() => {
    const initializeLibrary = async () => {
      try {
        setIsLoading(true);
        console.log('Initializing library...');

        // Try to load from cache first
        const cacheLoaded = await loadFromCache();
        
        if (cacheLoaded) {
          console.log('Loaded library data from cache');
          
          // Check if cache is still valid (default 24 hours)
          const cacheValid = await isCacheValid();
          if (cacheValid) {
            console.log('Cache is valid, using cached data');
            return;
          } else {
            console.log('Cache is stale, rebuilding...');
          }
        }

        // Load fresh data from server
        console.log('Loading fresh library data...');
        const result = await libraryService.initializeLibrary();
        
        if (result) {
          await setFolderTree(result.folderTree);
          // setFolderCache is not needed in this build
          await setAllPhotos(result.allPhotos);
          console.log('Library initialized successfully');
        } else {
          console.error('Failed to initialize library');
        }
      } catch (error) {
        console.error('Error initializing library:', error);
        
        // If it's a storage quota error, clear cache and retry once
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          console.log('Storage quota error, clearing cache and retrying...');
          try {
            await clearCache();
            // Retry initialization
            const result = await libraryService.initializeLibrary();
            if (result) {
              await setFolderTree(result.folderTree);
              // setFolderCache is not needed in this build
              await setAllPhotos(result.allPhotos);
            }
          } catch (retryError) {
            console.error('Failed to initialize library after cache clear:', retryError);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (currentLibraryPath) {
      initializeLibrary();
    }
  }, [currentLibraryPath, setCurrentLibraryPath, loadFromCache, isCacheValid, setFolderTree, setAllPhotos, setIsLoading, clearCache]);

  // Hide splash once folders are available or photos begin loading
  useEffect(() => {
    const onPhotosLoadStart = () => setShowSplash(false);
    window.addEventListener('photosLoadStart', onPhotosLoadStart as EventListener);
    return () => window.removeEventListener('photosLoadStart', onPhotosLoadStart as EventListener);
  }, []);

  useEffect(() => {
    if (folderTree) {
      setShowSplash(false);
    }
  }, [folderTree]);

  // Set default library path from config
  useEffect(() => {
    if (!currentLibraryPath) {
      // Set the library path from config
      setCurrentLibraryPath(configService.libraryPath);
    }
  }, [currentLibraryPath, setCurrentLibraryPath]);

  // Handle tag selection from detailed view
  useEffect(() => {
    const handleTagSelection = (event: CustomEvent) => {
      const tag = event.detail;
      console.log('App: Tag selected from detailed view:', tag);
      setCurrentTag(tag);
      setCurrentFolder(null); // Clear folder selection
    };

    window.addEventListener('selectTag', handleTagSelection as EventListener);
    
    return () => {
      window.removeEventListener('selectTag', handleTagSelection as EventListener);
    };
  }, [setCurrentTag, setCurrentFolder]);

  return (
    <ErrorBoundary>
      <AudioProvider>
        <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
          <SplashScreen visible={showSplash} onClose={() => setShowSplash(false)} />
          <div className="bg-gray-50 dark:bg-black min-h-screen">
          {/* Header */}
          <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
              <div className={`flex items-center justify-between px-4 transition-all duration-300 ease-in-out ${
                isMiniPlayer ? 'h-24' : 'py-4'
              }`}>
                <div className="flex items-center gap-4 flex-shrink-0">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <img src="/kiwi.png" alt="Kiwi" className="w-8 h-8" />
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Kiwi</h1>
                </div>
                </div>
                {/* Mini Player stretches between left and right sections */}
                {isMiniPlayer && (
                  <div className="flex-1 flex justify-center items-center min-w-0 mx-4 max-w-6xl">
                    <MiniAudioPlayer className="w-full max-w-6xl min-w-[200px]" />
                  </div>
                )}
                <div className="flex items-center gap-2 flex-shrink-0">
                {cacheProgress.isCaching && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg border" 
                       style={{ 
                         backgroundColor: `${getAccentHex(accentColor)}20`,
                         borderColor: `${getAccentHex(accentColor)}40`
                       }}>
                    <div className="w-4 h-4 rounded-full animate-spin"
                         style={{ 
                           borderWidth: '2px',
                           borderStyle: 'solid',
                           borderColor: `${getAccentHex(accentColor)}40`,
                           borderTopColor: getAccentHex(accentColor)
                         }} />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm" style={{ color: getAccentHex(accentColor) }}>
                        Caching {cacheProgress.current.toLocaleString()} / {cacheProgress.total.toLocaleString()} files
                      </span>
                      <div className="w-32 h-1 rounded-full overflow-hidden" 
                           style={{ backgroundColor: `${getAccentHex(accentColor)}30` }}>
                        <div 
                          className="h-full transition-all duration-300 ease-out"
                          style={{ 
                            width: `${cacheProgress.total > 0 ? (cacheProgress.current / cacheProgress.total) * 100 : 0}%`,
                            background: `linear-gradient(to right, ${getAccentHex(accentColor)}, ${getAccentHex(accentColor)}CC)`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => navigate('/admin')}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  title="Database Admin"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <SettingsIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleTheme}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </header>

            {/* Breadcrumbs - positioned below header */}
            <div 
              className="transition-all duration-300 ease-in-out"
              style={{ 
                marginLeft: sidebarOpen && !isMobile ? `${sidebarWidth}px` : '0px' 
              }}
            >
              <Breadcrumbs />
            </div>

          {/* Main Content */}
          <div className="flex">
            {/* Sidebar */}
            <Sidebar />
            
            {/* Main Content Area */}
            <main 
              className="flex-1 transition-all duration-300 ease-in-out"
              style={{ 
                marginLeft: sidebarOpen && !isMobile ? `${sidebarWidth}px` : '0px' 
              }}
            >
              <Routes>
                  <Route path="/" element={<RootRoute isMobile={isMobile} />} />
                <Route path="/admin" element={<AdminDatabaseStatus />} />
                  <Route path="/folder/*" element={<FolderRoute isMobile={isMobile} />} />
                  <Route path="/tag/:tagPath" element={<TagRoute isMobile={isMobile} />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/virtual-scrolling-test" element={<VirtualScrollingTestPage />} />
                <Route path="/preloading-test" element={<PreloadingTest />} />
                  {/* Fallback route for any unmatched paths */}
                  <Route path="*" element={<RootRoute isMobile={isMobile} />} />
              </Routes>
            </main>
          </div>

          {/* Mobile overlay */}
          {sidebarOpen && isMobile && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Settings now rendered as full page route */}
          {/* Detailed Photo Modal */}
          <DetailedPhotoModal />
          {/* Audio Player */}
          <AudioPlayer
            isOpen={audioPlayer.isOpen}
            onClose={closeAudioPlayer}
            currentAudio={audioPlayer.currentAudio}
            playlist={audioPlayer.playlist}
            onNext={playNextAudio}
            onPrevious={playPreviousAudio}
          />
          
          
          {/* Preloading Controls */}
                </div>
      </div>
    </AudioProvider>
    </ErrorBoundary>
  );
}

export default App; 