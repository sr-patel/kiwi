import React, { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Layout/Sidebar';
import { PhotoGrid } from '@/components/PhotoGrid/PhotoGrid';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import { Menu, Moon, Sun, Settings as SettingsIcon, Network } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { IconButton } from '@/components/ui/IconButton';
import { getAccentHex } from '@/utils/accentColors';

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
import { useShallow } from 'zustand/react/shallow';
import { queryKeys } from '@/hooks/queryKeys';
import './App.css';

// The viewer carries framer-motion and the zoom/pan/epub machinery, so it is
// loaded on first open instead of being part of the initial bundle.
const DetailedPhotoModal = lazy(() =>
  import('@/components/DetailedView/DetailedPhotoModal').then((module) => ({
    default: module.DetailedPhotoModal,
  })),
);
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
  // Targeted selectors instead of the whole store: this component used to
  // re-render on every store write, including the audio clock.
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
    closeAudioPlayer,
    playNextAudio,
    playPreviousAudio,
    isMiniPlayer,
    accentColor,
    detailedPhotoId,
    folderTree,
    audioIsOpen,
    audioCurrentAudio,
    audioPlaylist,
  } = useAppStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
      sidebarWidth: state.sidebarWidth,
      currentLibraryPath: state.currentLibraryPath,
      setCurrentLibraryPath: state.setCurrentLibraryPath,
      setIsLoading: state.setIsLoading,
      theme: state.theme,
      toggleTheme: state.toggleTheme,
      isMobile: state.isMobile,
      setIsMobile: state.setIsMobile,
      setCurrentFolder: state.setCurrentFolder,
      setCurrentTag: state.setCurrentTag,
      setFolderTree: state.setFolderTree,
      closeAudioPlayer: state.closeAudioPlayer,
      playNextAudio: state.playNextAudio,
      playPreviousAudio: state.playPreviousAudio,
      isMiniPlayer: state.isMiniPlayer,
      accentColor: state.accentColor,
      detailedPhotoId: state.detailedPhoto,
      folderTree: state.folderTree,
      audioIsOpen: state.audioPlayer.isOpen,
      audioCurrentAudio: state.audioPlayer.currentAudio,
      audioPlaylist: state.audioPlayer.playlist,
    })),
  );

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showSplash, setShowSplash] = useState(true);
  const configQuery = useQuery({
    queryKey: queryKeys.config(),
    queryFn: ({ signal }) => kiwiApi.config.get(signal),
    staleTime: 30_000,
  });
  const needsSetup = configQuery.data ? !configQuery.data._configured : null;
  const serverUnreachable = configQuery.isError;

  // Tokens live on <html>, so the whole document (including portalled UI and
  // scrollbars) repaints when the theme or accent changes — no wrapper classes.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.accent = accentColor;
    root.style.colorScheme = theme;
  }, [theme, accentColor]);

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
      <MotionConfig reducedMotion="user">
        <AudioProvider>
          <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
            <SplashScreen visible={showSplash} onClose={() => setShowSplash(false)} />
            <div className="min-h-screen bg-background">
              {/* Header */}
              <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
                <div
                  className={`flex items-center justify-between gap-3 px-3 transition-[height] duration-300 ease-out-soft sm:px-4 ${
                    isMiniPlayer ? 'h-24' : 'h-16'
                  }`}
                >
                  <div className="flex shrink-0 items-center gap-2">
                    <IconButton
                      label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                      <Menu className="size-5" />
                    </IconButton>
                    <button
                      type="button"
                      onClick={() => navigate('/all')}
                      className="flex items-center gap-2.5 rounded-lg pr-1.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Go to library"
                    >
                      <Logo size={30} />
                      <span className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                        Kiwi
                      </span>
                    </button>
                  </div>
                  {isMiniPlayer && (
                    <div className="flex-1 flex justify-center items-center min-w-0 mx-4 max-w-6xl">
                      <MiniAudioPlayer className="w-full max-w-6xl min-w-[200px]" />
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      label="Open Tag Atlas"
                      active={location.pathname === '/network'}
                      onClick={() => navigate('/network')}
                    >
                      <Network className="size-5" />
                    </IconButton>
                    <IconButton
                      label="Open settings"
                      active={location.pathname === '/settings'}
                      onClick={() => navigate('/settings')}
                    >
                      <SettingsIcon className="size-5" />
                    </IconButton>
                    <IconButton
                      label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                      onClick={toggleTheme}
                    >
                      {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
                    </IconButton>
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
                  className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm"
                  onClick={() => setSidebarOpen(false)}
                />
              )}

              {detailedPhotoId && (
                <Suspense fallback={null}>
                  <DetailedPhotoModal />
                </Suspense>
              )}
              <AudioPlayer
                isOpen={audioIsOpen}
                onClose={closeAudioPlayer}
                currentAudio={audioCurrentAudio}
                playlist={audioPlaylist}
                onNext={playNextAudio}
                onPrevious={playPreviousAudio}
              />
            </div>
          </div>
        </AudioProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
