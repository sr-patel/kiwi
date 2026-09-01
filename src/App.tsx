import React, { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Layout/Sidebar';
import { PhotoGrid } from '@/components/PhotoGrid/PhotoGrid';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import { Moon, Sun, Settings as SettingsIcon, Network } from 'lucide-react';
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
import { ServerConnectionScreen } from '@/components/SetupWizard/ServerConnectionScreen';
import { useLibrarySyncRefresh } from '@/hooks/useLibrarySyncRefresh';
import { kiwiApi } from '@/services/kiwiApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/queryKeys';
import './App.css';

const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TagNetworkPage = lazy(() => import('@/pages/TagNetworkPage'));

const RouteLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
    <span className="sr-only">Loading page</span>
    <div className="h-9 w-9 animate-spin rounded-full border-2 border-gray-300 border-t-current dark:border-gray-700" />
  </div>
);

// ─── Route components ───

const HomeRedirect: React.FC = () => {
  const { defaultLandingPage } = useAppStore();
  // Default to dashboard if not set (for existing users) or if explicitly set
  const target = defaultLandingPage === 'all' ? '/all' : '/dashboard';
  return <Navigate to={target} replace />;
};

const AllFilesRoute: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
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
    accentColor,
    audioPlayer,
    closeAudioPlayer,
    playNextAudio,
    playPreviousAudio,
    isMiniPlayer,
  } = useAppStore();

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showSplash, setShowSplash] = useState(true);
  const { folderTree } = useAppStore();
  const configQuery = useQuery({
    queryKey: queryKeys.config(),
    queryFn: ({ signal }) => kiwiApi.config.get(signal),
    staleTime: 30_000,
  });
  const needsSetup = configQuery.data ? !configQuery.data._configured : null;
  const serverUnreachable = configQuery.isError;

  const librarySyncEnabled = needsSetup === false && !!currentLibraryPath && !serverUnreachable;
  useLibrarySyncRefresh(librarySyncEnabled);

  useEffect(() => {
    if (configQuery.data?._configured && !currentLibraryPath) {
      setCurrentLibraryPath(configQuery.data.libraryPath);
    }
  }, [configQuery.data, currentLibraryPath, setCurrentLibraryPath]);

  const handleSetupComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.config() });
  }, [queryClient]);

  // ── Detect mobile ──
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setIsMobile, setSidebarOpen]);

  // ── Initialize the lightweight folder tree; photo pages live in TanStack Query ──
  useEffect(() => {
    const initializeLibrary = async () => {
      try {
        setIsLoading(true);

        const result = await libraryService.initializeLibrary();
        if (result) {
          setFolderTree(result.folderTree);
        }
      } catch (error) {
        console.error('Error initializing library:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (currentLibraryPath) initializeLibrary();
  }, [currentLibraryPath, setFolderTree, setIsLoading]);

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
  if (needsSetup === null && !serverUnreachable) {
    return <SplashScreen visible onClose={() => {}} />;
  }

  if (serverUnreachable) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <ServerConnectionScreen
          onRetry={() => void configQuery.refetch()}
          retrying={configQuery.isFetching}
        />
      </div>
    );
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
              <div
                className={`flex items-center justify-between px-4 transition-all duration-300 ease-in-out ${
                  isMiniPlayer ? 'h-24' : 'py-4'
                }`}
              >
                <div className="flex items-center gap-4 flex-shrink-0">
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
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
                  <button
                    onClick={() => navigate('/network')}
                    aria-label="Open Tag Atlas"
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                    title="Tag Atlas"
                  >
                    <Network className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    aria-label="Open settings"
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  >
                    <SettingsIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={toggleTheme}
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </header>

            {/* Breadcrumbs */}
            {location.pathname !== '/network' && (
              <div
                className="transition-all duration-300 ease-in-out"
                style={{ marginLeft: sidebarOpen && !isMobile ? `${sidebarWidth}px` : '0px' }}
              >
                <Breadcrumbs />
              </div>
            )}

            {/* Main Content */}
            <div className="flex">
              <Sidebar />
              <main
                className="flex-1 transition-all duration-300 ease-in-out"
                style={{ marginLeft: sidebarOpen && !isMobile ? `${sidebarWidth}px` : '0px' }}
              >
                <Suspense fallback={<RouteLoading />}>
                  <Routes>
                    <Route path="/" element={<HomeRedirect />} />
                    <Route
                      path="/dashboard"
                      element={
                        <RouteWrapper>
                          <DashboardPage />
                        </RouteWrapper>
                      }
                    />
                    <Route path="/all" element={<AllFilesRoute isMobile={isMobile} />} />
                    <Route path="/folder/*" element={<FolderRoute isMobile={isMobile} />} />
                    <Route path="/tag/:tagPath" element={<TagRoute isMobile={isMobile} />} />
                    <Route
                      path="/network"
                      element={
                        <RouteWrapper>
                          <TagNetworkPage />
                        </RouteWrapper>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <RouteWrapper>
                          <SettingsPage />
                        </RouteWrapper>
                      }
                    />
                    <Route path="*" element={<HomeRedirect />} />
                  </Routes>
                </Suspense>
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
