import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoMetadata } from '@/types';
import { useAppStore } from './index';

const photo = (id: string): PhotoMetadata => ({
  id,
  name: `${id}.mp3`,
  ext: 'mp3',
  size: 1,
  btime: 1,
  mtime: 1,
  tags: [],
  folders: [],
  isDeleted: false,
  url: '',
  annotation: '',
  modificationTime: 1,
  width: 0,
  height: 0,
  lastModified: 1,
});

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('application preference and UI store', () => {
  it('updates and clamps persisted preferences', () => {
    const state = useAppStore.getState();
    state.toggleTheme();
    state.setSidebarOpen(true);
    state.setSidebarWidth(320);
    state.setIsLoading(true);
    state.setIsMobile(true);
    state.setAccentColor('blue');
    state.setUseFolderThumbnails(true);
    state.setEnableColorIntegration(false);
    state.setEnablePodcastMode(true);
    state.setDefaultLandingPage('all');
    state.setAutoplayGifsInGrid(true);
    state.setRequestPageSize(1_000);
    state.setInfoBoxSize(1);
    state.setHideControlsWithInfoBox(true);
    state.setTransitionEffect('fade');
    state.setTagNetworkSettings({ detailLevel: 4 });
    state.setSettingsOpen(true);
    state.setCurrentView({ type: 'list', thumbnailSize: 'large' });
    state.setFilters({ tags: ['one'], fileTypes: ['image'] });
    state.setSortOptions({ field: 'random', direction: 'asc', randomSeed: 1 });
    vi.spyOn(Date, 'now').mockReturnValueOnce(42);
    state.shuffleRandomOrder();
    state.setVisualizerSettings({ visGlow: 20 });

    expect(useAppStore.getState()).toMatchObject({
      theme: 'dark',
      sidebarOpen: true,
      sidebarWidth: 320,
      isLoading: true,
      isMobile: true,
      accentColor: 'blue',
      requestPageSize: 500,
      infoBoxSize: 50,
      tagNetworkSettings: { detailLevel: 4 },
      sortOptions: { randomSeed: 42 },
      visualizerSettings: { visGlow: 20 },
    });
  });

  it('manages navigation, selection, and per-view scroll state', () => {
    const state = useAppStore.getState();
    state.setCurrentLibraryPath('/library');
    state.setCurrentFolder('birds');
    state.setCurrentTag(null);
    state.setFolderTree([]);
    state.setSelectedItems(['one']);
    state.toggleSelectedItem('two');
    state.toggleSelectedItem('one');
    state.setDetailedPhoto('two');
    state.setNavigationList(['two']);
    state.setSearchQuery('owl');
    state.saveScrollPosition(120);
    expect(useAppStore.getState().scrollPositions['folder-birds']).toBe(120);
    state.clearScrollPosition();
    expect(useAppStore.getState().scrollPositions).toEqual({});

    state.setCurrentFolder(null);
    state.setCurrentTag('wildlife');
    state.saveScrollPosition(90);
    state.clearScrollPosition('tag-wildlife');
    state.setCurrentTag(null);
    state.saveScrollPosition(50);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    state.restoreScrollPosition();
    expect(scrollTo).toHaveBeenCalledWith({ top: 50, behavior: 'instant' });
    expect(useAppStore.getState()).toMatchObject({
      selectedItems: ['two'],
      detailedPhoto: 'two',
      searchQuery: 'owl',
    });
  });

  it('manages podcast progress and audio playlist boundaries', () => {
    const first = photo('first');
    const second = photo('second');
    const state = useAppStore.getState();
    state.togglePodcastMode();
    state.saveAudioTime(first.id, 12);
    expect(state.getAudioTime(first.id)).toBe(12);
    state.clearAudioTime(first.id);
    expect(state.getAudioTime(first.id)).toBe(0);
    state.saveAudioTime(second.id, 4);
    state.clearAllAudioTimes();

    state.playNextAudio();
    state.playPreviousAudio();
    state.openAudioPlayer(first, [first, second]);
    state.playNextAudio();
    expect(useAppStore.getState().audioPlayer.currentAudio?.id).toBe('second');
    state.playNextAudio();
    expect(useAppStore.getState().audioPlayer.currentAudio?.id).toBe('first');
    state.playPreviousAudio();
    expect(useAppStore.getState().audioPlayer.currentAudio?.id).toBe('second');
    state.setAudioPlayerState({ volume: 0.4, isMuted: true });
    state.setMiniPlayer(true);
    state.closeAudioPlayer();
    state.openAudioPlayer(first);
    expect(useAppStore.getState().audioPlayer).toMatchObject({ isOpen: true, currentIndex: 0 });
  });
});
