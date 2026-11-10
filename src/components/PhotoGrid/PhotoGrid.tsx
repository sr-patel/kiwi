import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, List, Filter, ChevronDown, SortAsc, SortDesc, Headphones, RefreshCw } from 'lucide-react';
import { SimplePhotoCard } from './SimplePhotoCard';
import { FileCard } from '../FileCard';
import { PhotoMetadata, FolderNode, PaginatedPhotosResponse } from '@/types';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import {
  getAccentColor,
  getAccentRing,
  getAccentBorder,
  getAccentText,
  getAccentHover,
} from '@/utils/accentColors';
import { useInfinitePhotos, useRecursiveFolderCounts } from '@/hooks/useInfinitePhotos';
import { useFolderThumbnails } from '@/hooks/useFolderThumbnails';
import { usePhotosByTag } from '@/hooks/usePhotosByTag';
import { useSearchPhotos } from '@/hooks/useSearchPhotos';
// Removed all-photos hooks from PhotoGrid; we use pagination here
import { SearchBar } from '@/components/SearchBar/SearchBar';
import { FolderCard } from './FolderCard';
import { shouldUseFileCard } from '@/utils/fileTypes';
import { findFolderById, generateFolderUrl, getFolderIndex } from '@/utils/folderUrls';
// Removed virtual scrolling
import Masonry from 'react-masonry-css';
import { useShallow } from 'zustand/react/shallow';

interface PhotoGridProps {
  isMobile?: boolean;
}

// Virtual scrolling configuration
/** Extensions handled by the audio player rather than the detail viewer. */
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'opus', 'm4a', 'wma']);
const ABOVE_FOLD_COUNT = 8;
/** Placeholder tiles shown while the first page loads; reserves layout height. */
const SKELETON_TILE_COUNT = 12;

/**
 * Columns the masonry layout will use, mirroring `getMasonryBreakpoints`.
 * Arrow-key navigation needs this to move a whole visual row at a time.
 */
const columnCountFor = (width: number, size: 'small' | 'medium' | 'large'): number => {
  if (width <= 400) return size === 'large' ? 1 : 2;
  if (width <= 600) return size === 'small' ? 3 : 2;
  if (width <= 900) return size === 'small' ? 4 : size === 'medium' ? 3 : 2;
  if (width <= 1200) return size === 'small' ? 6 : size === 'medium' ? 4 : 3;
  if (width <= 1600) return size === 'small' ? 7 : size === 'medium' ? 5 : 3;
  return size === 'small' ? 8 : size === 'medium' ? 6 : 4;
};
const SCROLL_THRESHOLD = 200; // Pixels from bottom to trigger load more
const SCROLL_LOAD_AHEAD = 1000; // Reduced from 5000px to 1000px for less aggressive loading

// Define breakpoints for responsive columns based on thumbnail size
const getMasonryBreakpoints = (thumbnailSize: 'small' | 'medium' | 'large') => {
  switch (thumbnailSize) {
    case 'small':
      return {
        default: 8,
        1600: 7,
        1200: 6,
        900: 4,
        600: 3,
        400: 2,
      };
    case 'large':
      return {
        default: 4,
        1600: 3,
        1200: 3,
        900: 2,
        600: 2,
        400: 1,
      };
    default: // medium
      return {
        default: 6,
        1600: 5,
        1200: 4,
        900: 3,
        600: 2,
        400: 1,
      };
  }
};

export const PhotoGrid: React.FC<PhotoGridProps> = ({ isMobile = false }) => {
  const navigate = useNavigate();
  // `useShallow` keeps this component out of unrelated store updates (scroll
  // positions, the audio clock, selection) without listing 25 separate hooks.
  const {
    currentView,
    setCurrentView,
    filters,
    setFilters,
    sortOptions,
    setSortOptions,
    isLoading,
    currentFolder,
    currentTag,
    folderTree,
    accentColor,
    useFolderThumbnails: folderThumbnailsEnabled,
    setCurrentFolder,
    setDetailedPhoto,
    detailedPhoto,
    saveScrollPosition,
    openAudioPlayer,
    podcastMode,
    togglePodcastMode,
    enablePodcastMode,
    searchQuery,
  } = useAppStore(
    useShallow((state) => ({
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
      filters: state.filters,
      setFilters: state.setFilters,
      sortOptions: state.sortOptions,
      setSortOptions: state.setSortOptions,
      isLoading: state.isLoading,
      currentFolder: state.currentFolder,
      currentTag: state.currentTag,
      folderTree: state.folderTree,
      accentColor: state.accentColor,
      useFolderThumbnails: state.useFolderThumbnails,
      setCurrentFolder: state.setCurrentFolder,
      setDetailedPhoto: state.setDetailedPhoto,
      detailedPhoto: state.detailedPhoto,
      saveScrollPosition: state.saveScrollPosition,
      openAudioPlayer: state.openAudioPlayer,
      podcastMode: state.podcastMode,
      togglePodcastMode: state.togglePodcastMode,
      enablePodcastMode: state.enablePodcastMode,
      searchQuery: state.searchQuery,
    })),
  );
  const [columnWidth, setColumnWidth] = useState('320px');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Roving tabindex: the grid is a single tab stop and arrow keys move within it.
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Signal App that photo loading is about to begin so it can hide splash
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('photosLoadStart'));
    } catch {}
  }, []);

  // Use different hooks based on whether we're viewing by folder or tag
  const folderPhotosQuery = useInfinitePhotos(currentFolder, {
    field: sortOptions.field,
    direction: sortOptions.direction,
    randomSeed: sortOptions.field === 'random' ? sortOptions.randomSeed : undefined,
    enabled: searchQuery.trim().length === 0 && !currentTag, // disable when searching or tagging
  });

  const tagPhotosQuery = usePhotosByTag({
    tag: currentTag,
    limit: 50,
    sortField: sortOptions.field,
    sortDirection: sortOptions.direction,
    randomSeed: sortOptions.field === 'random' ? sortOptions.randomSeed : undefined,
    enabled: !!currentTag, // Only enable when viewing by tag
  });

  // Use paginated search when there's a search query, otherwise use regular queries
  const searchPhotosQuery = useSearchPhotos({
    query: searchQuery,
    type: filters.fileTypes.length > 0 ? filters.fileTypes[0] : null, // For now, just use first file type filter
    limit: 50,
    sortField: sortOptions.field,
    sortDirection: sortOptions.direction,
    randomSeed: sortOptions.field === 'random' ? sortOptions.randomSeed : undefined,
    enabled: searchQuery.trim().length > 0 && !currentTag, // Disable search when in tag context
    folderId: currentFolder,
    tag: currentTag,
  });

  // No all-photos loading in grid; we keep pagination for performance

  // Use the appropriate query based on current selection
  const photosQuery =
    currentTag || searchQuery.trim().length > 0
      ? currentTag
        ? tagPhotosQuery
        : searchPhotosQuery
      : folderPhotosQuery;
  const { data: recursiveFolderCounts = {} } = useRecursiveFolderCounts();

  // Extract files from the query - use paginated search results if available
  let photos: PhotoMetadata[] = [];
  let totalPhotos = 0;
  let totalSize = 0;
  if (searchQuery.trim().length > 0 && !currentTag) {
    // Paginated search (not in tag context)
    const searchPages =
      (searchPhotosQuery.data?.pages as { photos: PhotoMetadata[]; total: number; totalSize: number }[]) ||
      [];
    photos = searchPages.flatMap((page) => page.photos || []);
    totalPhotos =
      searchPages.length > 0 && typeof searchPages[0].total === 'number' ? searchPages[0].total : 0;
    totalSize =
      searchPages.length > 0 && typeof searchPages[0].totalSize === 'number' ? searchPages[0].totalSize : 0;
  } else if (currentTag) {
    // Tag view (with or without search)
    const tagPages =
      (tagPhotosQuery.data?.pages as { photos: PhotoMetadata[]; total: number; totalSize: number }[]) || [];
    photos = tagPages.flatMap((page) => page.photos || []);
    totalPhotos = tagPages.length > 0 && typeof tagPages[0].total === 'number' ? tagPages[0].total : 0;
    totalSize = tagPages.length > 0 && typeof tagPages[0].totalSize === 'number' ? tagPages[0].totalSize : 0;

    // Debug logging
  } else {
    // Folder view
    const folderPages = (folderPhotosQuery.data?.pages as PaginatedPhotosResponse[]) || [];
    photos = folderPages.flatMap((page) => page.photos || []);
    totalPhotos =
      folderPages.length > 0 && typeof folderPages[0].total === 'number' ? folderPages[0].total : 0;
    totalSize =
      folderPages.length > 0 && typeof folderPages[0].totalSize === 'number' ? folderPages[0].totalSize : 0;

    // Debug logging for folder view
  }

  // No virtual scrolling

  let isFetchingNextPage =
    searchQuery.trim().length > 0 && !currentTag
      ? searchPhotosQuery.isFetchingNextPage
      : currentTag
        ? tagPhotosQuery.isFetchingNextPage
        : folderPhotosQuery.isFetchingNextPage;
  let hasNextPage =
    searchQuery.trim().length > 0 && !currentTag
      ? searchPhotosQuery.hasNextPage
      : currentTag
        ? tagPhotosQuery.hasNextPage
        : folderPhotosQuery.hasNextPage;

  // Compute effective hasNextPage for random explicitly from totals
  const totalLoaded = useMemo(() => {
    let pages;
    if (searchQuery.trim().length > 0 && !currentTag) {
      pages = searchPhotosQuery.data?.pages as { photos: PhotoMetadata[]; total: number }[] | undefined;
    } else if (currentTag) {
      pages = tagPhotosQuery.data?.pages as { photos: PhotoMetadata[]; total: number }[] | undefined;
    } else {
      pages = folderPhotosQuery.data?.pages as { photos: PhotoMetadata[]; total: number }[] | undefined;
    }
    if (!pages) return 0;
    const seen = new Set<string>();
    let count = 0;
    for (const page of pages) {
      for (const p of page.photos || []) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          count++;
        }
      }
    }

    // Debug logging
    if (currentTag) {
    }

    return count;
  }, [
    searchQuery,
    currentTag,
    searchPhotosQuery.data?.pages,
    tagPhotosQuery.data?.pages,
    folderPhotosQuery.data?.pages,
  ]);
  const totalAvailable = useMemo(() => {
    let pages;
    if (searchQuery.trim().length > 0 && !currentTag) {
      pages = searchPhotosQuery.data?.pages as { photos: PhotoMetadata[]; total: number }[] | undefined;
    } else if (currentTag) {
      pages = tagPhotosQuery.data?.pages as { photos: PhotoMetadata[]; total: number }[] | undefined;
    } else {
      pages = folderPhotosQuery.data?.pages as { photos: PhotoMetadata[]; total: number }[] | undefined;
    }
    return pages && pages.length > 0 ? (typeof pages[0].total === 'number' ? pages[0].total : 0) : 0;
  }, [
    searchQuery,
    currentTag,
    searchPhotosQuery.data?.pages,
    tagPhotosQuery.data?.pages,
    folderPhotosQuery.data?.pages,
  ]);
  const effectiveHasNextPage =
    sortOptions.field === 'random' || currentTag
      ? totalLoaded < totalAvailable && totalAvailable > 0
      : hasNextPage;

  // Single viewport-filler for tag/search views. There used to be a second,
  // near-identical effect here that also called fetchNextPage, so both could
  // fire and duplicate page requests.
  useEffect(() => {
    if (detailedPhoto) return;
    if (!currentTag && !searchQuery.trim()) return;
    if (!effectiveHasNextPage) return;
    if (fillingViewportRef.current) return;

    const fill = () => {
      if (detailedPhoto || (!currentTag && !searchQuery.trim())) {
        fillingViewportRef.current = false;
        return;
      }
      const nearBottom = document.documentElement.scrollHeight <= window.innerHeight + 100; // Reduced from 200
      if (nearBottom && effectiveHasNextPage && !isFetchingNextPage) {
        if (currentTag) {
          tagPhotosQuery.fetchNextPage();
        } else if (searchQuery.trim().length > 0) {
          searchPhotosQuery.fetchNextPage();
        }
        // Add delay before next fill attempt instead of immediate requestAnimationFrame
        setTimeout(() => {
          if (fillingViewportRef.current) {
            requestAnimationFrame(fill);
          }
        }, 100); // 100ms delay between fills
      } else {
        fillingViewportRef.current = false;
      }
    };

    fillingViewportRef.current = true;
    // Add initial delay before starting the fill process
    setTimeout(() => {
      if (fillingViewportRef.current) {
        requestAnimationFrame(fill);
      }
    }, 200); // 200ms initial delay
  }, [
    currentTag,
    searchQuery,
    detailedPhoto,
    effectiveHasNextPage,
    isFetchingNextPage,
    tagPhotosQuery,
    searchPhotosQuery,
  ]);

  // Check if we're currently searching
  const isSearching = searchQuery.trim().length > 0 && searchPhotosQuery.loading;

  // Get total size from the appropriate query
  // const totalSize = searchQuery.trim().length > 0
  //   ? 0 // Fast search doesn't return total size yet
  //   : currentTag
  //   ? tagPhotosQuery.data?.pages[0]?.totalSize || 0
  //   : photosQuery.data?.pages[0]?.totalSize || 0;

  // Debug log (disabled for performance)
  // console.log('PhotoGrid: currentTag =', currentTag, 'photos.length =', photos.length, 'totalPhotos =', totalPhotos);

  // Debug: Check for duplicate photo IDs (disabled for performance)
  // const rawPhotoIds = photos.map(p => p.id);
  // const rawUniqueIds = [...new Set(rawPhotoIds)];
  // if (rawPhotoIds.length !== rawUniqueIds.length) {
  //   console.warn(`PhotoGrid: Found ${rawPhotoIds.length - rawUniqueIds.length} duplicate photo IDs`);
  // }

  // Minimum swipe distance (in px) - increased for better mobile UX
  const minSwipeDistance = 80;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollHandlerFnRef = useRef<((e: Event) => void) | null>(null);
  const suppressPaginationRef = useRef<boolean>(false);
  const fillingViewportRef = useRef<boolean>(false);

  useEffect(() => {
    if (detailedPhoto) return; // pause observer while modal open
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && effectiveHasNextPage && !isFetchingNextPage) {
          if (suppressPaginationRef.current || detailedPhoto) return;
          if (currentTag) {
            tagPhotosQuery.fetchNextPage();
          } else if (searchQuery.trim().length > 0) {
            searchPhotosQuery.fetchNextPage();
          } else {
            folderPhotosQuery.fetchNextPage();
          }
        }
      },
      { rootMargin: `${SCROLL_LOAD_AHEAD}px 0px ${SCROLL_THRESHOLD}px 0px` },
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [
    detailedPhoto,
    effectiveHasNextPage,
    isFetchingNextPage,
    currentTag,
    searchQuery,
    tagPhotosQuery,
    searchPhotosQuery,
    folderPhotosQuery,
    photos.length,
  ]);

  // cleanup covered by the effect above

  // Passive scroll-based load-ahead as a fallback so tall images don't block pagination
  useEffect(() => {
    if (detailedPhoto) return; // pause scroll-based prefetch while modal open
    const onScroll = () => {
      if (suppressPaginationRef.current || detailedPhoto) return;
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        const viewportBottom = window.scrollY + window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const distanceToBottom = docHeight - viewportBottom;
        if (distanceToBottom <= SCROLL_LOAD_AHEAD && effectiveHasNextPage && !isFetchingNextPage) {
          if (suppressPaginationRef.current || detailedPhoto) return;
          if (currentTag) {
            tagPhotosQuery.fetchNextPage();
          } else if (searchQuery.trim().length > 0) {
            searchPhotosQuery.fetchNextPage();
          } else {
            folderPhotosQuery.fetchNextPage();
          }
        }
      });
    };
    scrollHandlerFnRef.current = onScroll as unknown as (e: Event) => void;
    window.addEventListener(
      'scroll',
      scrollHandlerFnRef.current as EventListener,
      { passive: true } as AddEventListenerOptions,
    );
    onScroll(); // initial check in case we start near bottom
    return () => {
      if (scrollHandlerFnRef.current) {
        window.removeEventListener('scroll', scrollHandlerFnRef.current as EventListener);
        scrollHandlerFnRef.current = null;
      }
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    };
  }, [
    detailedPhoto,
    effectiveHasNextPage,
    isFetchingNextPage,
    currentTag,
    searchQuery,
    tagPhotosQuery,
    searchPhotosQuery,
    folderPhotosQuery,
  ]);

  // When opening detailed view, force-disconnect observer and remove scroll listener immediately
  useEffect(() => {
    if (!detailedPhoto) return;
    // Suppress pagination immediately on open
    suppressPaginationRef.current = true;
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (scrollHandlerFnRef.current) {
      window.removeEventListener('scroll', scrollHandlerFnRef.current as EventListener);
      scrollHandlerFnRef.current = null;
    }
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, [detailedPhoto]);

  // When closing detailed view, re-enable pagination
  useEffect(() => {
    if (detailedPhoto) return;
    // Re-enable after a short tick to avoid handling any residual scroll
    const id = window.setTimeout(() => {
      suppressPaginationRef.current = false;
    }, 200);
    return () => window.clearTimeout(id);
  }, [detailedPhoto]);

  const onTouchStart = (e: React.TouchEvent) => {
    // Only handle single touch
    if (e.targetTouches.length !== 1) return;

    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Only handle single touch
    if (e.targetTouches.length !== 1) return;

    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    // Only trigger swipe if it's clearly horizontal and meets minimum distance
    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance && Math.abs(distanceY) < 100) {
      // Swiped left advances, swiped right goes back.
      goToSiblingFolder(distanceX > 0 ? 1 : -1);
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  /**
   * Horizontal swipe moves to the next/previous sibling folder.
   * This used to be two near-identical functions, each of which recursed the
   * whole tree on every call.
   */
  const goToSiblingFolder = useCallback(
    (direction: 1 | -1) => {
      if (!folderTree || !currentFolder) return;
      const index = getFolderIndex(folderTree);
      const parentId = index.parentById.get(currentFolder) ?? null;
      const siblings = parentId ? (index.byId.get(parentId)?.children ?? []) : folderTree;
      if (siblings.length < 2) return;
      const currentIndex = siblings.findIndex((folder) => folder.id === currentFolder);
      if (currentIndex === -1) return;
      const target = siblings[(currentIndex + direction + siblings.length) % siblings.length];
      const url = generateFolderUrl(target, folderTree);
      if (url) navigate(url);
      setCurrentFolder(target.id);
    },
    [currentFolder, folderTree, navigate, setCurrentFolder],
  );

  // Helper function to count all files in a folder including nested subfolders
  const getTotalPhotoCount = (folder: FolderNode): number => {
    // Use recursive folder counts that include all subfolders
    return recursiveFolderCounts[folder.id] || 0;
  };

  const subfolders = useMemo(() => {
    if (!folderTree || !currentFolder) return [];
    const node = findFolderById(folderTree, currentFolder);
    if (!node) return [];
    return [...node.children].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [folderTree, currentFolder]);

  // One batched request for every subfolder thumbnail instead of one per card.
  const subfolderIds = useMemo(() => subfolders.map((folder) => folder.id), [subfolders]);
  const { thumbnails: folderThumbnails } = useFolderThumbnails(subfolderIds, !!folderThumbnailsEnabled);

  // Update column width based on thumbnail size
  useEffect(() => {
    const getColumnWidth = () => {
      // Larger column widths to match bigger files
      switch (currentView.thumbnailSize) {
        case 'small':
          return '200px';
        case 'large':
          return '400px';
        default:
          return '300px';
      }
    };

    setColumnWidth(getColumnWidth());
  }, [currentView.thumbnailSize]);

  // Apply remaining client-side filters (tags and file types that aren't handled by backend search)
  const filteredPhotos = React.useMemo(() => {
    let filtered = photos;

    // Apply search query filtering when in tag context
    if (searchQuery.trim().length > 0 && currentTag) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((photo) => {
        // Check if search query contains tag: syntax
        if (searchLower.includes('tag:')) {
          const tagMatch = searchLower.match(/tag:([^\s]+)/);
          if (tagMatch) {
            const searchTag = tagMatch[1];
            return (
              photo.tags && photo.tags.some((tag) => tag.toLowerCase().includes(searchTag.toLowerCase()))
            );
          }
        }

        // Regular text search in filename
        return photo.name.toLowerCase().includes(searchLower);
      });
    }

    // Apply tag filters (only if not using fast search)
    if (filters.tags.length > 0 && searchQuery.trim().length === 0) {
      filtered = filtered.filter(
        (photo) => photo.tags && filters.tags.some((tag) => photo.tags.includes(tag)),
      );
    }

    // Apply file type filters (only if not using fast search)
    if (filters.fileTypes.length > 0 && searchQuery.trim().length === 0) {
      filtered = filtered.filter((photo) => filters.fileTypes.includes(photo.ext.toLowerCase()));
    }

    // Deduplicate by id in one pass; the old findIndex-per-item scan was O(n^2).
    const seenIds = new Set<string>();
    const uniquePhotos: PhotoMetadata[] = [];
    for (const photo of filtered) {
      if (seenIds.has(photo.id)) continue;
      seenIds.add(photo.id);
      uniquePhotos.push(photo);
    }
    return uniquePhotos;
  }, [photos, searchQuery, filters, currentTag]);

  // Latest-value refs keep `handlePhotoOpen` referentially stable, so memoised
  // cards do not re-render every time the page data changes.
  const photosRef = useRef<PhotoMetadata[]>(photos);
  photosRef.current = photos;
  const filteredPhotosRef = useRef<PhotoMetadata[]>(filteredPhotos);
  filteredPhotosRef.current = filteredPhotos;

  const handlePhotoOpen = useCallback(
    (photo: PhotoMetadata) => {
      if (AUDIO_EXTENSIONS.has(photo.ext?.toLowerCase() ?? '')) {
        openAudioPlayer(photo, photosRef.current);
        return;
      }
      // Save scroll position and capture the exact on-screen order for navigation
      saveScrollPosition(window.scrollY);
      suppressPaginationRef.current = true;
      useAppStore.getState().setNavigationList(filteredPhotosRef.current.map((p) => p.id));
      setDetailedPhoto(photo.id);
    },
    [openAudioPlayer, saveScrollPosition, setDetailedPhoto],
  );

  const handleSubfolderClick = (folderId: string) => {
    if (folderTree) {
      const folder = findFolderById(folderTree, folderId);
      if (folder) navigate(generateFolderUrl(folder, folderTree));
    }
    setCurrentFolder(folderId);
  };

  const handleViewChange = (type: 'grid' | 'list') => {
    setCurrentView({ ...currentView, type });
  };

  const handleThumbnailSizeChange = (size: 'small' | 'medium' | 'large') => {
    setCurrentView({ ...currentView, thumbnailSize: size });
  };

  // Handle random sort retry
  const handleRandomRetry = () => {
    if (sortOptions.field === 'random') {
      // Use store-level shuffle to propagate same seed across app
      if (useAppStore.getState().shuffleRandomOrder) {
        useAppStore.getState().shuffleRandomOrder();
      } else {
        // Fallback: update sortOptions with a new shared seed
        setSortOptions({ ...sortOptions, randomSeed: Date.now() });
      }
    }
  };

  const handleSortChange = (field: 'name' | 'date_created' | 'date_updated' | 'size' | 'type' | 'random') => {
    setSortOptions({ ...sortOptions, field });
    setSortDropdownOpen(false);
  };

  const toggleSortDirection = () => {
    setSortOptions({
      ...sortOptions,
      direction: sortOptions.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const getSortFieldLabel = (field: string) => {
    const labels: { [key: string]: string } = {
      name: 'Name',
      date_created: 'Date Created',
      date_updated: 'Date Updated',
      size: 'File Size',
      type: 'File Type',
      random: 'Random',
    };
    return labels[field] || field;
  };

  const getSortIcon = () => {
    return sortOptions.direction === 'asc' ? (
      <SortAsc className="w-4 h-4" />
    ) : (
      <SortDesc className="w-4 h-4" />
    );
  };

  // Helper function to render the appropriate card component
  const renderCard = useCallback(
    (photo: PhotoMetadata, index: number) => {
      const commonProps = {
        size: currentView.thumbnailSize,
        onOpen: handlePhotoOpen,
        isMobile,
        isAboveFold: index < ABOVE_FOLD_COUNT,
        index,
        tabIndex: index === focusedIndex ? 0 : -1,
      };

      // Stable key so items don't remount on pagination/reorder.
      return shouldUseFileCard(photo.ext) ? (
        <FileCard key={photo.id} file={photo} {...commonProps} />
      ) : (
        <SimplePhotoCard key={photo.id} photo={photo} {...commonProps} />
      );
    },
    [currentView.thumbnailSize, handlePhotoOpen, isMobile, focusedIndex],
  );

  /**
   * Arrow-key navigation across the grid.
   * Without a roving tabindex every card was its own tab stop, so a folder of
   * 500 photos meant 500 presses of Tab to reach the toolbar.
   */
  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rawIndex = (event.target as HTMLElement | null)?.dataset?.gridIndex;
    if (rawIndex === undefined) return;
    const current = Number.parseInt(rawIndex, 10);
    if (!Number.isFinite(current)) return;

    const columns = isMobile ? 2 : columnCountFor(window.innerWidth, currentView.thumbnailSize);

    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = current + 1;
        break;
      case 'ArrowLeft':
        next = current - 1;
        break;
      case 'ArrowDown':
        next = current + columns;
        break;
      case 'ArrowUp':
        next = current - columns;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = filteredPhotos.length - 1;
        break;
      default:
        return;
    }

    const bounded = Math.max(0, Math.min(filteredPhotos.length - 1, next));
    event.preventDefault();
    if (bounded === current) return;

    setFocusedIndex(bounded);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-grid-index="${bounded}"]`)?.focus();
    });
  };

  // Keep the roving index valid when the visible set changes.
  useEffect(() => {
    setFocusedIndex((current) => (current >= filteredPhotos.length ? 0 : current));
  }, [filteredPhotos.length]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [currentFolder, currentTag, searchQuery]);

  // Only used to decide whether the podcast-mode toggle is relevant.
  const hasAudioFiles = useMemo(
    () => filteredPhotos.some((photo) => AUDIO_EXTENSIONS.has(photo.ext?.toLowerCase() ?? '')),
    [filteredPhotos],
  );

  // Determine loading state from query hooks
  let loading = false;
  let queryError: string | null = null;
  let retryQuery: () => void = () => undefined;
  if (searchQuery.trim().length > 0) {
    loading = searchPhotosQuery.loading;
    queryError = searchPhotosQuery.error;
    retryQuery = () => void searchPhotosQuery.refetch();
  } else if (currentTag) {
    loading = tagPhotosQuery.loading;
    queryError = tagPhotosQuery.error;
    retryQuery = () => void tagPhotosQuery.refetch();
  } else {
    loading = folderPhotosQuery.isLoading;
    queryError = folderPhotosQuery.error?.message ?? null;
    retryQuery = () => void folderPhotosQuery.refetch();
  }

  return (
    <div
      className="flex-1 p-3 sm:p-4 space-y-3 sm:space-y-4"
      onKeyDown={handleGridKeyDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Main toolbar row - search, sort, and view controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {/* Left side: Search */}
          <div className="flex gap-2 items-center flex-1">
            <SearchBar className="flex-1" />
          </div>

          {/* Right side: View controls - only show when there are files */}
          {filteredPhotos.length > 0 && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className={`flex border ${getAccentBorder(accentColor)} rounded-lg overflow-hidden`}>
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={currentView.type === 'grid'}
                  onClick={() => handleViewChange('grid')}
                  className={`p-3 ${currentView.type === 'grid' ? `${getAccentColor(accentColor)} text-white` : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300'} touch-manipulation`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={currentView.type === 'list'}
                  onClick={() => handleViewChange('list')}
                  className={`p-3 ${currentView.type === 'list' ? `${getAccentColor(accentColor)} text-white` : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300'} touch-manipulation`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Thumbnail size slider */}
              <div className="flex items-center gap-2">
                <span className={`text-sm ${getAccentText(accentColor)} hidden sm:inline`}>Size:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${getAccentText(accentColor)}`}>S</span>
                  <input
                    type="range"
                    aria-label="Thumbnail size"
                    aria-valuetext={currentView.thumbnailSize}
                    min="1"
                    max="3"
                    value={
                      currentView.thumbnailSize === 'small'
                        ? 1
                        : currentView.thumbnailSize === 'medium'
                          ? 2
                          : 3
                    }
                    onChange={(e) => {
                      const size =
                        e.target.value === '1' ? 'small' : e.target.value === '2' ? 'medium' : 'large';
                      handleThumbnailSizeChange(size as 'small' | 'medium' | 'large');
                    }}
                    className={`w-20 sm:w-16 accent-${accentColor}-500 touch-manipulation`}
                  />
                  <span className={`text-xs ${getAccentText(accentColor)}`}>L</span>
                </div>
              </div>

              {/* Podcast Mode Toggle - only show when there are audio files and podcast mode is enabled in settings */}
              {hasAudioFiles && enablePodcastMode && (
                <button
                  onClick={togglePodcastMode}
                  className={`flex items-center gap-2 px-3 py-2 border ${getAccentBorder(accentColor)} rounded-lg transition-colors touch-manipulation ${
                    podcastMode.enabled
                      ? `${getAccentColor(accentColor)} text-white`
                      : `bg-white dark:bg-gray-900 ${getAccentText(accentColor)} ${getAccentHover(accentColor)}`
                  }`}
                  title={
                    podcastMode.enabled
                      ? 'Podcast Mode: ON - Remembers playback position'
                      : 'Podcast Mode: OFF - Start from beginning'
                  }
                >
                  <Headphones className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Podcast Mode</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results info */}
      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          {filteredPhotos.length > 0 ? (
            <>
              <span className="block sm:inline">
                Showing {filteredPhotos.length} of {totalPhotos} files
              </span>
              {/* Removed debug-loaded counts for tag view */}
            </>
          ) : loading ? (
            sortOptions.field === 'random' ||
            sortOptions.field.startsWith('date_') ||
            sortOptions.field === 'name' ||
            sortOptions.field === 'size' ||
            sortOptions.field === 'type' ? (
              'Sorting files...'
            ) : (
              'Loading files...'
            )
          ) : isSearching ? (
            'Searching...'
          ) : subfolders.length > 0 ? (
            `No files in this folder • ${subfolders.length} subfolder${subfolders.length === 1 ? '' : 's'}`
          ) : (
            'No files found'
          )}
        </div>
        {filteredPhotos.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="text-sm text-muted-foreground">
              Total size: {libraryService.formatFileSize(totalSize)}
            </div>
            <div className="relative flex items-center gap-2">
              <span>Sort:</span>
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="flex items-center gap-1 font-medium hover:opacity-70 transition-opacity cursor-pointer"
                title="Click to change sort order"
              >
                <span>{getSortFieldLabel(sortOptions.field)}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Sort direction toggle */}
              <button
                onClick={toggleSortDirection}
                disabled={sortOptions.field === 'random'}
                className={`transition-opacity ${
                  sortOptions.field === 'random'
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                    : 'hover:opacity-70 cursor-pointer'
                }`}
                title={
                  sortOptions.field === 'random'
                    ? 'Direction not applicable for random sorting'
                    : `Sort ${sortOptions.direction === 'asc' ? 'Descending' : 'Ascending'}`
                }
              >
                {getSortIcon()}
              </button>

              {/* Random retry button - only show when random sorting is enabled */}
              {sortOptions.field === 'random' && (
                <button
                  onClick={handleRandomRetry}
                  className="hover:opacity-70 transition-opacity cursor-pointer"
                  title="Shuffle random order"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}

              {/* Dropdown menu (same as toolbar) */}
              {sortDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-10">
                  <div className="py-1">
                    {[
                      { field: 'name', label: 'Name (A-Z)' },
                      { field: 'date_created', label: 'Date Created' },
                      { field: 'date_updated', label: 'Date Updated' },
                      { field: 'size', label: 'File Size' },
                      { field: 'type', label: 'File Type' },
                      { field: 'random', label: 'Random' },
                    ].map((option) => (
                      <button
                        key={option.field}
                        onClick={() => handleSortChange(option.field as any)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                          sortOptions.field === option.field
                            ? `${getAccentColor(accentColor)} text-white`
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Subfolders */}
      {subfolders.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Subfolders</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
            {subfolders.map((subfolder) => (
              <FolderCard
                key={subfolder.id}
                subfolder={subfolder}
                thumbnail={folderThumbnails[subfolder.id] ?? null}
                getTotalPhotoCount={getTotalPhotoCount}
                onClick={() => handleSubfolderClick(subfolder.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {queryError && (
        <div className="flex min-h-48 items-center justify-center px-4" role="alert">
          <div className="max-w-md space-y-3 text-center">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Could not load files</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{queryError}</p>
            <button
              type="button"
              onClick={retryQuery}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-gray-900"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {loading && !queryError && (
        <>
          <p className="sr-only" role="status" aria-live="polite">
            Loading files
          </p>
          {/* Skeleton tiles reserve the grid's height so the page does not jump
              and the pagination sentinel does not oscillate. */}
          <div
            aria-hidden
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3"
          >
            {Array.from({ length: SKELETON_TILE_COUNT }, (_, index) => (
              <div
                key={index}
                className="aspect-[4/3] animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800"
              />
            ))}
          </div>
        </>
      )}

      {/* File Grid - only show when there are files */}
      {!loading && !queryError && filteredPhotos.length > 0 && (
        <>
          {/* Mobile Two-Column Grid */}
          {isMobile && currentView.type === 'grid' && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full">
              {filteredPhotos.map((photo, index) => renderCard(photo, index))}
              {isFetchingNextPage && (
                <div className="col-span-2 flex items-center justify-center py-8">
                  <div
                    className={`animate-spin rounded-full h-8 w-8 border-b-2 ${getAccentColor(accentColor)}`}
                  ></div>
                </div>
              )}
            </div>
          )}

          {/* Desktop File Grid (row-first masonry) */}
          {!isMobile && currentView.type === 'grid' && (
            <Masonry
              breakpointCols={getMasonryBreakpoints(currentView.thumbnailSize)}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {filteredPhotos.map((photo, index) => renderCard(photo, index))}
              {isFetchingNextPage && (
                <div className="col-span-full flex items-center justify-center py-8">
                  <div
                    className={`animate-spin rounded-full h-8 w-8 border-b-2 ${getAccentColor(accentColor)}`}
                  ></div>
                </div>
              )}
            </Masonry>
          )}

          {/* List View */}
          {currentView.type === 'list' && (
            <div className="space-y-2">
              {filteredPhotos.map((photo, index) => renderCard(photo, index))}
              {isFetchingNextPage && (
                <div className="flex items-center justify-center py-8">
                  <div
                    className={`animate-spin rounded-full h-8 w-8 border-b-2 ${getAccentColor(accentColor)}`}
                  ></div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Load more sentinel for pagination */}
      <div ref={loadMoreRef} className="h-1" />

      {/* Empty state - only show when no files AND no subfolders */}
      {!loading && !queryError && filteredPhotos.length === 0 && subfolders.length === 0 && (
        <div className="flex items-center justify-center min-h-48 sm:min-h-64 py-6 sm:py-8 px-4">
          <div className="text-center w-full max-w-md">
            {isSearching || loading ? (
              <>
                <div
                  className={`animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 ${getAccentColor(accentColor)} mx-auto mb-4`}
                ></div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {isSearching ? 'Searching...' : 'Sorting...'}
                </h3>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                  {isSearching ? `Looking for "${searchQuery}"` : 'Reordering files...'}
                </p>
              </>
            ) : searchQuery.trim().length > 0 ? (
              <>
                <div className="text-4xl sm:text-6xl mb-4 opacity-20">🔍</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No files found
                </h3>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                  No results found for "{searchQuery}"
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl sm:text-6xl mb-4 opacity-20">📁</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No files here
                </h3>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                  Try <strong>All Files</strong> in the sidebar, or pick a different folder.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
