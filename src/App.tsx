import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from '@/components/Layout/Sidebar';
import { PhotoGrid } from '@/components/PhotoGrid/PhotoGrid';
import SettingsPage from '@/pages/SettingsPage';
import { AdminDatabaseStatus } from '@/pages/AdminDatabaseStatus';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
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
import { RouteWrapper } from '@/components/Layout/RouteWrapper';
import { SplashScreen } from '@/components/SplashScreen/SplashScreen';
import { SetupWizard } from '@/components/SetupWizard/SetupWizard';
import './App.css';

// ─── Route components ───

const RootRoute: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
  const { setCurrentFolder, setCurrentTag } = useAppStore();

  useEffect(() => {
    setCurrentFolder(null);
    setCurrentTag(null);
  }, [setCurrentFolder, setCurrentTag]);

  return (
    <RouteWrapper>
      <PhotoGrid isMobile={isMobile} />
    </RouteWrapper>
  );
};

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
        navigate('/', { replace: true });
      }
    } else {
      setCurrentTag(null);
      setCurrentFolder(null);
    }
  }, [tagPath, setCurrentTag, setCurrentFolder, navigate]);

  return (
    <RouteWrapper>
      <PhotoGrid isMobile={isMobile} />
    </RouteWrapper>
  );
};

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
        navigate('/', { replace: true });
      }
    } else if (!folderPath) {
      setCurrentFolder(null);
      setCurrentTag(null);
    }
  }, [folderPath, folderTree, setCurrentFolder, setCurrentTag, navigate]);

  return (
    <RouteWrapper>
      <PhotoGrid isMobile={isMobile} />
    </RouteWrapper>
  );
};

// ─── Main App ───

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
    setCurrentFolder,
    setCurrentTag,
    setFolderTree,
    setAllPhotos,
    accentColor,
    loadFromCache,
    clearCache,
    isCacheValid,
    cacheProgress,
    audioPlayer,
    closeAudioPlayer,
    playNextAudio,
    playPreviousAudio,
    isMiniPlayer,
  } = useAppStore();

  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null); // null = checking
  const { folderTree } = useAppStore();

  // ── First-run detection: ask server if library is configured ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) { setNeedsSetup(false); return; }
        const data = await res.json();
        if (!cancelled) {
          setNeedsSetup(!data._configured);
          // If already configured, seed the store with the server's libraryPath
          if (data._configured && !currentLibraryPath) {
            setCurrentLibraryPath(data.libraryPath);
          }
        }
      } catch {
        // Server unreachable – fall through to normal flow
        if (!cancelled) setNeedsSetup(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetupComplete = useCallback(() => {
    setNeedsSetup(false);
    // Re-fetch config to seed the store
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data.libraryPath) setCurrentLibraryPath(data.libraryPath);
      })
      .catch(() => {});
  }, [setCurrentLibraryPath]);

  // ── Detect mobile ──
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && sidebarOpen) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setIsMobile, sidebarOpen, setSidebarOpen]);

  // ── Initialize library with IndexedDB caching ──
  useEffect(() => {
    const initializeLibrary = async () => {
      try {
        setIsLoading(true);

        const cacheLoaded = await loadFromCache();
        if (cacheLoaded) {
          const cacheValid = await isCacheValid();
          if (cacheValid) return;
        }

        const result = await libraryService.initializeLibrary();
        if (result) {
          await setFolderTree(result.folderTree);
          await setAllPhotos(result.allPhotos);
        }
      } catch (error) {
        console.error('Error initializing library:', error);
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          try {
            await clearCache();
            const result = await libraryService.initializeLibrary();
            if (result) {
              await setFolderTree(result.folderTree);
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

    if (currentLibraryPath) initializeLibrary();
  }, [currentLibraryPath, setCurrentLibraryPath, loadFromCache, isCacheValid, setFolderTree, setAllPhotos, setIsLoading, clearCache]);

  // ── Hide splash once data arrives ──
  useEffect(() => {
    const onPhotosLoadStart = () => setShowSplash(false);
    window.addEventListener('photosLoadStart', onPhotosLoadStart as EventListener);
    return () => window.removeEventListener('photosLoadStart', onPhotosLoadStart as EventListener);
  }, []);

  useEffect(() => {
    if (folderTree) setShowSplash(false);
  }, [folderTree]);

  // ── Handle tag selection from detailed view ──
  useEffect(() => {
    const handleTagSelection = (event: CustomEvent) => {
      setCurrentTag(event.detail);
      setCurrentFolder(null);
    };
    window.addEventListener('selectTag', handleTagSelection as EventListener);
    return () => window.removeEventListener('selectTag', handleTagSelection as EventListener);
  }, [setCurrentTag, setCurrentFolder]);

  // ── Render ──

  // Still checking config
  if (needsSetup === null) {
    return <SplashScreen visible onClose={() => {}} />;
  }

  // Show setup wizard for first-run
  if (needsSetup) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <SetupWizard onComplete={handleSetupComplete} />
      </div>
    );
  }

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

            {/* Breadcrumbs */}
            <div
              className="transition-all duration-300 ease-in-out"
              style={{ marginLeft: sidebarOpen && !isMobile ? `${sidebarWidth}px` : '0px' }}
            >
              <Breadcrumbs />
            </div>

            {/* Main Content */}
            <div className="flex">
              <Sidebar />
              <main
                className="flex-1 transition-all duration-300 ease-in-out"
                style={{ marginLeft: sidebarOpen && !isMobile ? `${sidebarWidth}px` : '0px' }}
              >
                <Routes>
                  <Route path="/" element={<RootRoute isMobile={isMobile} />} />
                  <Route path="/admin" element={<RouteWrapper><AdminDatabaseStatus /></RouteWrapper>} />
                  <Route path="/folder/*" element={<FolderRoute isMobile={isMobile} />} />
                  <Route path="/tag/:tagPath" element={<TagRoute isMobile={isMobile} />} />
                  <Route path="/settings" element={<RouteWrapper><SettingsPage /></RouteWrapper>} />
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

            <DetailedPhotoModal />
            <AudioPlayer
              isOpen={audioPlayer.isOpen}
              onClose={closeAudioPlayer}
              currentAudio={audioPlayer.currentAudio}
              playlist={audioPlayer.playlist}
              onNext={playNextAudio}
              onPrevious={playPreviousAudio}
            />
          </div>
        </div>
      </AudioProvider>
    </ErrorBoundary>
  );
}

export default App;
