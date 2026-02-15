import React, { useEffect } from 'react';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import { X, ArrowLeft, ArrowRight, Camera, MapPin, Calendar, FileText, Tag, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Play, Pause, BookOpen, Download, Folder, Volume2, VolumeX, Repeat, Rewind, FastForward, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useInfinitePhotos } from '@/hooks/useInfinitePhotos';
import { usePhotosByTag } from '@/hooks/usePhotosByTag';
import { useFastSearch } from '@/hooks/useFastSearch';
import { useTagCounts } from '@/hooks/useTagCounts';
import { useAllPhotos } from '@/hooks/useAllPhotos';
import { useAllPhotosByTag } from '@/hooks/useAllPhotosByTag';
import { imagePreloadingService } from '@/services/imagePreloadingService';
import { getFileTypeInfo, shouldUseFileCard } from '@/utils/fileTypes';
import { getAccentColor, getAccentHover } from '@/utils/accentColors';
import { generateTagUrl } from '@/utils/tagUrls';
import { generateFolderUrl } from '@/utils/folderUrls';
import { useNavigate } from 'react-router-dom';
import { renderClickableUrl, linkifyText } from '@/utils/linkify';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';
import { EpubViewer } from './EpubViewer';

export const DetailedPhotoModal: React.FC = () => {
  const navigate = useNavigate();
  const { detailedPhoto, setDetailedPhoto, currentFolder, currentTag, sortOptions, restoreScrollPosition, folderTree, setCurrentFolder, setCurrentTag, saveScrollPosition, filters, searchQuery, navigationList, infoBoxSize, hideControlsWithInfoBox, transitionEffect = 'slide' } = useAppStore();
  const { accentColor } = useAppStore();
  const [photo, setPhoto] = React.useState<any>(null);
  const [currentIndex, setCurrentIndex] = React.useState<number>(-1);
  const [viewMode, setViewMode] = React.useState<'fit' | 'vertical' | 'horizontal'>('fit');
  const [zoom, setZoom] = React.useState<number>(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fetchingPhotoId, setFetchingPhotoId] = React.useState<string | null>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imageContainerRef = React.useRef<HTMLDivElement>(null);
  const [hasVerticalOverflow, setHasVerticalOverflow] = React.useState<boolean>(false);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = React.useState<boolean>(false);
  const [horizontalMaxScroll, setHorizontalMaxScroll] = React.useState<number>(0);
  const [isVideoLoop, setIsVideoLoop] = React.useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = React.useState<boolean>(true);
  const [videoVolume, setVideoVolume] = React.useState<number>(1);
  const [playbackRate, setPlaybackRate] = React.useState<number>(1);
  const [isInfoBoxVisible, setIsInfoBoxVisible] = React.useState<boolean>(true);
  const [videoDimensions, setVideoDimensions] = React.useState<{width: number, height: number} | null>(null);
  const [videoProgress, setVideoProgress] = React.useState<number>(0);
  const [videoDuration, setVideoDuration] = React.useState<number>(0);
  const [isSeeking, setIsSeeking] = React.useState<boolean>(false);
  const [pendingNavigation, setPendingNavigation] = React.useState<{ direction: 'next'; anchorId: string } | null>(null);
  
  // Touch/swipe support for mobile navigation with animations
  const [touchStart, setTouchStart] = React.useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = React.useState<number>(0);
  const [isSwipeTransitioning, setIsSwipeTransitioning] = React.useState<boolean>(false);
  const minSwipeDistance = 80; // Minimum swipe distance in pixels

  // Preload cache for next/previous images
  const preloadCacheRef = React.useRef<Set<string>>(new Set());

  // Treat only real external URLs as metadata URLs (exclude internal file API links)
  const isExternalUrl = (value: string | undefined | null) => {
    if (!value) return false;
    if (/^https?:\/\//i.test(value)) return true;
    // Exclude internal API/file URLs like /api/photos/...
    if (value.startsWith('/api/')) return false;
    return false;
  };

  // Edge arrow visibility based on mouse proximity
  const [isNearLeftEdge, setIsNearLeftEdge] = React.useState<boolean>(false);
  const [isNearRightEdge, setIsNearRightEdge] = React.useState<boolean>(false);
  const edgeRevealThreshold = 96; // px from screen edge to reveal arrows

  const handleRootMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const x = e.clientX;
    const vw = window.innerWidth;
    setIsNearLeftEdge(x <= edgeRevealThreshold);
    setIsNearRightEdge(x >= vw - edgeRevealThreshold);
  };

  // Get tag counts for displaying in tags
  const { data: tagCounts = {} } = useTagCounts();

  // Debug logging (disabled for performance)
  // console.log('DetailedPhotoModal render:', { detailedPhoto, currentFolder, currentTag, sortOptions });

  // Get photos from the appropriate query based on current selection
  const folderPhotosQuery = useInfinitePhotos(currentFolder, {
    field: sortOptions.field,
    direction: sortOptions.direction,
    randomSeed: sortOptions.field === 'random' ? sortOptions.randomSeed : undefined,
    enabled: searchQuery.trim().length === 0 && !currentTag && sortOptions.field !== 'random'
  });

  const tagPhotosQuery = usePhotosByTag({
    tag: currentTag,
    limit: 50,
    sortField: sortOptions.field,
    sortDirection: sortOptions.direction,
    randomSeed: sortOptions.field === 'random' ? sortOptions.randomSeed : undefined,
    enabled: !!currentTag // Enable for all sorts including random, just like PhotoGrid
  });

  // For random sort, use special hooks that load all photos at once
  const allPhotosQuery = useAllPhotos(currentFolder, {
    field: sortOptions.field,
    direction: sortOptions.direction,
    randomSeed: sortOptions.randomSeed
  });

  const allPhotosByTagQuery = useAllPhotosByTag({
    tag: currentTag,
    sortField: sortOptions.field,
    sortDirection: sortOptions.direction,
    randomSeed: sortOptions.randomSeed,
    enabled: !!currentTag
  });

  // Get search results if there's a search query
  const fastSearchQuery = useFastSearch({
    query: searchQuery,
    type: filters.fileTypes.length > 0 ? filters.fileTypes[0] : null,
    limit: 50,
    orderBy: sortOptions.field,
    orderDirection: sortOptions.direction === 'asc' ? 'ASC' : 'DESC',
    enabled: searchQuery.trim().length > 0
  });

  // Use the appropriate query based on current selection
  const photosQuery = currentTag ? tagPhotosQuery : folderPhotosQuery;

  const hasNextPageAvailable = React.useMemo(() => {
    if (searchQuery.trim().length > 0) return false;
    if (currentTag) return Boolean(tagPhotosQuery.hasNextPage);
    return Boolean(folderPhotosQuery.hasNextPage);
  }, [
    searchQuery,
    currentTag,
    tagPhotosQuery.hasNextPage,
    folderPhotosQuery.hasNextPage
  ]);

  const isFetchingNextPage = React.useMemo(() => {
    if (searchQuery.trim().length > 0) return false;
    if (currentTag) return Boolean(tagPhotosQuery.isFetchingNextPage);
    return Boolean(folderPhotosQuery.isFetchingNextPage);
  }, [
    searchQuery,
    currentTag,
    tagPhotosQuery.isFetchingNextPage,
    folderPhotosQuery.isFetchingNextPage
  ]);

  const triggerFetchNextPage = React.useCallback(() => {
    if (searchQuery.trim().length > 0) return;
    if (currentTag) {
      if (tagPhotosQuery.hasNextPage && !tagPhotosQuery.isFetchingNextPage) {
        tagPhotosQuery.fetchNextPage();
      }
    } else {
      if (folderPhotosQuery.hasNextPage && !folderPhotosQuery.isFetchingNextPage) {
        folderPhotosQuery.fetchNextPage();
      }
    }
  }, [
    searchQuery,
    currentTag,
    tagPhotosQuery.hasNextPage,
    tagPhotosQuery.isFetchingNextPage,
    tagPhotosQuery.fetchNextPage,
    folderPhotosQuery.hasNextPage,
    folderPhotosQuery.isFetchingNextPage,
    folderPhotosQuery.fetchNextPage
  ]);
  
  // Source of truth for navigation order:
  // 1) If we have a captured navigationList from the grid, build the list strictly
  //    in that order from the union of available photos.
  // 2) Else, for random sort load-all, use the all-photos arrays.
  // 3) Else, fall back to current paginated data or search.
  const unionPool = React.useMemo(() => {
    const sets: any[] = [];
    
    // Always include current folder photos (paged data)
    const paged = photosQuery.data?.pages.flatMap(page => page.photos) || [];
    sets.push(paged);
    
    // Include search results if there's a search query
    if (searchQuery.trim().length > 0) {
      sets.push(fastSearchQuery.photos || []);
    }
    
    // Include random sort data if applicable
    if (sortOptions.field === 'random' && !currentTag) {
      sets.push(allPhotosQuery.data || []);
    }
    if (sortOptions.field === 'random' && currentTag) {
      sets.push(allPhotosByTagQuery.data || []);
    }
    
    console.log('DetailedPhotoModal: unionPool debug:', {
      currentTag,
      photosQueryData: photosQuery.data,
      pagedLength: paged.length,
      searchQuery: searchQuery.trim(),
      sortOptionsField: sortOptions.field,
      allPhotosByTagQueryData: allPhotosByTagQuery.data,
      allPhotosByTagQueryDataLength: allPhotosByTagQuery.data?.length || 0
    });
    
    console.log('DetailedPhotoModal: unionPool sets debug:', {
      setsLength: sets.length,
      setsSizes: sets.map((set, i) => ({ index: i, size: set.length })),
      isRandom: sortOptions.field === 'random',
      hasCurrentTag: !!currentTag
    });
    
    const map = new Map<string, any>();
    for (const arr of sets) {
      for (const p of arr) {
        if (p && !map.has(p.id)) map.set(p.id, p);
      }
    }
    console.log('DetailedPhotoModal: unionPool result:', { mapSize: map.size, firstFewIds: Array.from(map.keys()).slice(0, 3) });
    return map; // id -> photo
  }, [searchQuery, fastSearchQuery.photos, photosQuery.data, allPhotosQuery.data, allPhotosByTagQuery.data, sortOptions.field, currentTag]);

  const photos = React.useMemo(() => {
    console.log('DetailedPhotoModal: photos assembly debug:', {
      navigationListLength: navigationList?.length || 0,
      unionPoolSize: unionPool.size,
      searchQuery: searchQuery.trim(),
      sortOptionsField: sortOptions.field,
      currentTag
    });
    
    // If we have a navigation list, try to use it first
    if (navigationList && navigationList.length > 0) {
      const ordered: any[] = [];
      for (const id of navigationList) {
        const p = unionPool.get(id);
        if (p) ordered.push(p);
      }
      console.log('DetailedPhotoModal: Navigation list assembly result:', { orderedLength: ordered.length });
      if (ordered.length > 0) return ordered;
      
      // If navigation list assembly failed, try to get photos from the current query
      console.log('DetailedPhotoModal: Navigation list assembly failed, trying current query');
    }
    
    // Fallback to current query data
    if (searchQuery.trim().length > 0) return fastSearchQuery.photos || [];
    if (sortOptions.field === 'random' && currentTag) return allPhotosByTagQuery.data || [];
    if (sortOptions.field === 'random' && !currentTag) return allPhotosQuery.data || [];
    
    // For tag views, try to get photos from tagPhotosQuery directly
    if (currentTag) {
      const tagPhotos = tagPhotosQuery.data?.pages.flatMap(page => page.photos) || [];
      console.log('DetailedPhotoModal: Tag photos from tagPhotosQuery:', { tagPhotosLength: tagPhotos.length });
      if (tagPhotos.length > 0) return tagPhotos;
      
      // If tagPhotosQuery is empty (e.g., for random sort), try allPhotosByTagQuery
      if (sortOptions.field === 'random') {
        const allTagPhotos = allPhotosByTagQuery.data || [];
        console.log('DetailedPhotoModal: All tag photos from allPhotosByTagQuery:', { allTagPhotosLength: allTagPhotos.length });
        if (allTagPhotos.length > 0) return allTagPhotos;
      }
    }
    
    const fallbackPhotos = photosQuery.data?.pages.flatMap(page => page.photos) || [];
    console.log('DetailedPhotoModal: Fallback photos result:', { fallbackPhotosLength: fallbackPhotos.length });
    return fallbackPhotos;
  }, [navigationList, unionPool, searchQuery, fastSearchQuery.photos, sortOptions.field, currentTag, allPhotosByTagQuery.data, allPhotosQuery.data, photosQuery.data, tagPhotosQuery.data]);

  // Debug logging (disabled for performance)
  // console.log('DetailedPhotoModal photos data:', { 
  //   photosLength: photos.length, 
  //   usingSearchResults: searchQuery.trim().length > 0,
  //   currentTag,
  //   currentFolder,
  //   firstPhotoId: photos[0]?.id,
  //   detailedPhoto
  // });

  // Track the latest requested detailed photo id to avoid stale closures in async flows
  const detailedPhotoRef = React.useRef<string | null>(detailedPhoto);
  useEffect(() => {
    detailedPhotoRef.current = detailedPhoto;
  }, [detailedPhoto]);

  // Track in-flight fetches to prevent duplicate requests for the same id
  const inFlightFetchesRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log('DetailedPhotoModal useEffect triggered:', { 
      detailedPhoto, 
      photosLength: photos.length, 
      fetchingPhotoId,
      currentTag,
      currentFolder,
      navigationListLength: navigationList?.length || 0
    });
    if (!detailedPhoto) {
      console.log('DetailedPhotoModal: No detailedPhoto, setting photo to null');
      setPhoto(null);
      setCurrentIndex(-1);
      setFetchingPhotoId(null);
      return;
    }

    // Reset fetching state if we're looking for a different photo than what's currently being fetched
    if (fetchingPhotoId && fetchingPhotoId !== detailedPhoto) {
      console.log('Resetting stale fetch state:', { oldFetchingPhotoId: fetchingPhotoId, newPhotoId: detailedPhoto });
      setFetchingPhotoId(null);
    }

    // If we have a navigationList, derive index from it for stability
    if (navigationList && navigationList.length > 0) {
      const navIdx = navigationList.indexOf(detailedPhoto);
      if (navIdx !== -1) setCurrentIndex(navIdx);
    }

    // Also compute index within our current assembled photos array
    const idx = photos.findIndex((p) => p.id === detailedPhoto);
    console.log('DetailedPhotoModal: Photo search debug:', { 
      detailedPhoto, 
      foundIndex: idx, 
      fetchingPhotoId, 
      photosLength: photos.length,
      firstFewPhotoIds: photos.slice(0, 3).map(p => p.id),
      currentTag,
      currentFolder
    });

    if (idx !== -1) {
      // Photo found in current dataset
      setCurrentIndex(idx);
      setPhoto(photos[idx]);
      setFetchingPhotoId(null); // Clear any previous fetch state
      
      // Immediately prioritize the current image for loading
      const currentPhoto = photos[idx];
      if (currentPhoto && !imagePreloadingService.isPreloaded(currentPhoto.id)) {
        imagePreloadingService.forceLoadImage(currentPhoto);
      }
      
      // Preload neighbor images for smooth navigation
      const neighbors = [];
      if (idx > 0) neighbors.push(photos[idx - 1]);
      if (idx < photos.length - 1) neighbors.push(photos[idx + 1]);
      
      if (neighbors.length > 0) {
        imagePreloadingService.addToQueue(neighbors, 'high');
      }
    } else if (photo && photo.id === detailedPhoto) {
      // Already have the specifically-fetched photo in state; avoid re-fetch loop
      setCurrentIndex(-1);
      setFetchingPhotoId(null);
      
      // Still prioritize this image for loading if not already preloaded
      if (!imagePreloadingService.isPreloaded(photo.id)) {
        imagePreloadingService.forceLoadImage(photo);
      }
    } else if (photos.length > 0) {
      // Photo not found in current dataset, try to fetch it specifically
      if (!inFlightFetchesRef.current.has(detailedPhoto)) {
        console.log('Photo not found in current dataset, fetching specifically:', detailedPhoto);
        inFlightFetchesRef.current.add(detailedPhoto);
        setFetchingPhotoId(detailedPhoto);
        fetchSpecificPhoto(detailedPhoto)
          .finally(() => {
            inFlightFetchesRef.current.delete(detailedPhoto);
          });
      } else {
        // Already fetching this photo in-flight, waiting for result
        console.log('Fetch already in-flight (ref), waiting...', { detailedPhoto });
      }
    } else if (photos.length === 0) {
      // No photos in dataset yet, wait for them to load
      // console.log('No photos in dataset yet, waiting...');
      setPhoto(null);
      setCurrentIndex(-1);
      setFetchingPhotoId(null);
    }
  }, [detailedPhoto, photos, photo?.id]);

  useEffect(() => {
    if (!pendingNavigation) return;
    if (pendingNavigation.direction === 'next') {
      const anchorIndex = photos.findIndex((p) => p.id === pendingNavigation.anchorId);
      if (anchorIndex !== -1 && anchorIndex < photos.length - 1) {
        setPendingNavigation(null);
        setDetailedPhoto(photos[anchorIndex + 1].id);
      }
    }
  }, [pendingNavigation, photos, setDetailedPhoto]);

  useEffect(() => {
    if (!pendingNavigation) return;
    if (!hasNextPageAvailable && !isFetchingNextPage) {
      setPendingNavigation(null);
    }
  }, [pendingNavigation, hasNextPageAvailable, isFetchingNextPage]);

  // Function to fetch a specific photo when it's not in the current dataset
  const fetchSpecificPhoto = async (photoId: string) => {
    try {
      const response = await fetchWithRetry(`/api/photos/${photoId}/metadata`);
      if (!response.ok) {
        throw new Error(`Failed to fetch photo metadata: ${response.statusText}`);
      }
      const photoData = await response.json();
      console.log('Fetched specific photo:', photoData);
      
      // Only set the photo if we're still looking for this specific photo
      const stillNeeded = detailedPhotoRef.current === photoId;
      console.log('Fetch complete, checking if still needed:', { currentRequested: detailedPhotoRef.current, photoId, stillNeeded });
      if (stillNeeded) {
        console.log('Setting photo data:', { photoId: photoData.id, photoName: photoData.name });
        setPhoto(photoData);
        setCurrentIndex(-1); // Indicate this photo is not in the main navigation array
        if (detailedPhotoRef.current === photoId) {
          setFetchingPhotoId(null); // Clear the fetching state only if still current
        }
      } else {
        console.log('Ignoring fetch result, photo no longer needed:', { currentRequested: detailedPhotoRef.current, photoId });
      }
    } catch (error) {
      console.error('Failed to fetch specific photo:', error, { photoId, currentRequested: detailedPhotoRef.current });
      if (detailedPhotoRef.current === photoId) {
        setPhoto(null);
        setCurrentIndex(-1);
        setFetchingPhotoId(null);
      }
    }
  };

  // Debug the photo URL when photo changes
  useEffect(() => {
    console.log('Photo state changed:', { photo: photo ? `${photo.id} (${photo.name})` : null });
    if (photo) {
      const photoUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
      console.log('Photo URL debug:', {
        photoId: photo.id,
        photoExt: photo.ext,
        photoName: photo.name,
        generatedUrl: photoUrl
      });
    }
  }, [photo]);

  const closeModal = () => {
    console.log('Closing detailed modal, restoring scroll position for folder:', currentFolder);
    setDetailedPhoto(null);
  };

  const handleModalClick = (e: React.MouseEvent) => {
    // Only close if clicking on the background, not on the image or controls
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const performTransition = (direction: 'next' | 'prev', callback: () => void) => {
    if (transitionEffect === 'none' || zoom > 1) {
      callback();
      return;
    }

    setIsSwipeTransitioning(true);
    // Slide: -window.innerWidth for next (slide left), window.innerWidth for prev (slide right)
    const offset = direction === 'next' ? -window.innerWidth : window.innerWidth;
    setSwipeOffset(offset);

    setTimeout(() => {
      callback();
      setSwipeOffset(0);
      setIsSwipeTransitioning(false);
    }, 250); // Match CSS transition duration
  };

  const navigateToPhoto = (photoId: string | null, direction: 'next' | 'prev') => {
    if (!photoId) {
      setDetailedPhoto(null);
      return;
    }
    performTransition(direction, () => setDetailedPhoto(photoId));
  };

  const showPrev = () => {
    if (navigationList && navigationList.length > 0 && detailedPhoto) {
      const idx = navigationList.indexOf(detailedPhoto);
      if (idx > 0) {
        navigateToPhoto(navigationList[idx - 1], 'prev');
        return;
      }
    }
    if (photos.length && currentIndex > 0) {
      navigateToPhoto(photos[currentIndex - 1].id, 'prev');
    } else if (currentIndex === -1 && photos.length > 0) {
      navigateToPhoto(photos[photos.length - 1].id, 'prev');
    }
  };
  const showNext = () => {
    if (navigationList && navigationList.length > 0 && detailedPhoto) {
      const idx = navigationList.indexOf(detailedPhoto);
      if (idx !== -1 && idx < navigationList.length - 1) {
        navigateToPhoto(navigationList[idx + 1], 'next');
        return;
      }
      // Fall through when at the end of navigation list so we can load more items
    }
    if (photos.length && currentIndex >= 0 && currentIndex < photos.length - 1) {
      navigateToPhoto(photos[currentIndex + 1].id, 'next');
      return;
    }
    if (currentIndex === -1 && photos.length > 0) {
      navigateToPhoto(photos[0].id, 'next');
      return;
    }
    if (hasNextPageAvailable && detailedPhoto) {
      if (!pendingNavigation) {
        setPendingNavigation({ direction: 'next', anchorId: detailedPhoto });
      }
      triggerFetchNextPage();
    }
  };

  // Touch/swipe handlers for mobile navigation
  const onTouchStart = (e: React.TouchEvent) => {
    // Only handle single touch
    if (e.targetTouches.length !== 1) return;
    
    // Don't interfere with zoom/pan gestures when zoomed in
    if (zoom > 1) return;
    
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Only handle single touch
    if (e.targetTouches.length !== 1) return;
    
    // Don't interfere with zoom/pan gestures when zoomed in
    if (zoom > 1) return;
    
    const currentTouch = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
    
    setTouchEnd(currentTouch);
    
    // Calculate drag offset for visual feedback
    if (touchStart) {
      const distanceX = currentTouch.x - touchStart.x;
      const distanceY = currentTouch.y - touchStart.y;
      const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
      
      // Only show drag feedback for horizontal swipes
      if (isHorizontalSwipe) {
        // Apply resistance at edges
        let offset = distanceX;
        if ((distanceX > 0 && currentIndex === 0) || (distanceX < 0 && currentIndex === photos.length - 1)) {
          // At edge - apply resistance (rubber band effect)
          offset = distanceX * 0.3;
        }
        setSwipeOffset(offset);
      }
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    // Don't interfere with zoom/pan gestures when zoomed in
    if (zoom > 1) {
      setTouchStart(null);
      setTouchEnd(null);
      setSwipeOffset(0);
      return;
    }
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    
    // Only trigger swipe if it's clearly horizontal and meets minimum distance
    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance && Math.abs(distanceY) < 100) {
      // Trigger transition animation
      setIsSwipeTransitioning(true);
      
      if (distanceX > 0) {
        // Swiped left - show next image
        // Complete the slide animation to show the next image
        setSwipeOffset(-window.innerWidth);
        setTimeout(() => {
          showNext();
          // Reset without animation so new image appears centered
          setSwipeOffset(0);
          setIsSwipeTransitioning(false);
        }, 250);
      } else {
        // Swiped right - show previous image
        // Complete the slide animation to show the previous image
        setSwipeOffset(window.innerWidth);
        setTimeout(() => {
          showPrev();
          // Reset without animation so new image appears centered
          setSwipeOffset(0);
          setIsSwipeTransitioning(false);
        }, 250);
      }
    } else {
      // Swipe didn't meet threshold - snap back
      setIsSwipeTransitioning(true);
      setSwipeOffset(0);
      setTimeout(() => {
        setIsSwipeTransitioning(false);
      }, 200);
    }
    
    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  const getImageClasses = () => {
    switch (viewMode) {
      case 'vertical':
        // Fit to height: image takes full container height; allow horizontal overflow (no object-contain)
        return 'block h-full w-auto max-w-none';
      case 'horizontal':
        // Fit to width: image takes full container width; allow vertical overflow (no object-contain)
        return 'block w-full h-auto max-h-none';
      default:
        // Fit to screen: use full width and height, object-contain will handle the rest
        return 'block w-full h-full object-contain';
    }
  };

  const getImageStyle = () => {
    const baseStyle = {}; // Removed black background
    
    // Apply swipe offset for touch drag animation
    if (swipeOffset !== 0) {
      const progress = Math.abs(swipeOffset) / window.innerWidth;
      const baseTransition = isSwipeTransitioning ? 'all 0.2s ease-out' : 'none';

      if (transitionEffect === 'fade') {
        return {
          ...baseStyle,
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: 'center',
          transition: baseTransition,
          opacity: Math.max(0, 1 - progress),
          cursor: isDragging ? 'grabbing' : 'grab'
        };
      } else if (transitionEffect === 'zoom') {
        const scale = Math.max(0.5, 1 - progress * 0.5);
        return {
          ...baseStyle,
          transform: `scale(${zoom * scale}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: 'center',
          transition: baseTransition,
          opacity: Math.max(0, 1 - progress),
          cursor: isDragging ? 'grabbing' : 'grab'
        };
      } else {
        // Slide (Default)
        const opacity = 1 - Math.abs(swipeOffset) / (window.innerWidth * 2);
        return {
          ...baseStyle,
          transform: `translateX(${swipeOffset}px) scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: 'center',
          transition: baseTransition,
          opacity: Math.max(0.3, opacity),
          cursor: isDragging ? 'grabbing' : 'grab'
        };
      }
    }
    
    if (zoom !== 1) {
      return {
        ...baseStyle,
        transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
        transformOrigin: 'center',
        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        cursor: isDragging ? 'grabbing' : 'grab'
      };
    }
    
    return baseStyle;
  };

  const getPrevPreviewStyle = () => {
    const progress = swipeOffset > 0 ? swipeOffset / window.innerWidth : 0;
    const base = {
      transition: isSwipeTransitioning ? 'all 0.2s ease-out' : 'none',
      zIndex: swipeOffset > 0 ? 1 : -1
    };

    if (transitionEffect === 'fade') {
      return {
        ...base,
        opacity: progress,
        transform: 'none',
      };
    }
    if (transitionEffect === 'zoom') {
      return {
        ...base,
        opacity: progress,
        transform: `scale(${0.5 + 0.5 * progress})`,
      };
    }
    // Slide
    return {
      ...base,
      opacity: swipeOffset > 0 ? Math.min(1, swipeOffset / 200) : 0,
      transform: `translateX(${swipeOffset > 0 ? swipeOffset - window.innerWidth : -window.innerWidth}px)`,
    };
  };

  const getNextPreviewStyle = () => {
    const progress = swipeOffset < 0 ? Math.abs(swipeOffset) / window.innerWidth : 0;
    const base = {
      transition: isSwipeTransitioning ? 'all 0.2s ease-out' : 'none',
      zIndex: swipeOffset < 0 ? 1 : -1
    };

    if (transitionEffect === 'fade') {
      return {
        ...base,
        opacity: progress,
        transform: 'none',
      };
    }
    if (transitionEffect === 'zoom') {
      return {
        ...base,
        opacity: progress,
        transform: `scale(${0.5 + 0.5 * progress})`,
      };
    }
    // Slide
    return {
      ...base,
      opacity: swipeOffset < 0 ? Math.min(1, Math.abs(swipeOffset) / 200) : 0,
      transform: `translateX(${swipeOffset < 0 ? swipeOffset + window.innerWidth : window.innerWidth}px)`,
    };
  };

  // Apply video settings when state changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = isVideoLoop;
    v.muted = isVideoMuted;
    v.volume = videoVolume;
    v.playbackRate = playbackRate;
  }, [isVideoLoop, isVideoMuted, videoVolume, playbackRate]);

  const togglePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const toggleMute = () => {
    setIsVideoMuted(prev => {
      const newMuted = !prev;
      // If unmuting and volume is 0, set to a reasonable default
      if (!newMuted && videoVolume === 0) {
        setVideoVolume(0.5);
      }
      return newMuted;
    });
  };

  const handleVolumeChange = (newVolume: number) => {
    setVideoVolume(newVolume);
    // If volume is set to 0, mute the video
    if (newVolume === 0) {
      setIsVideoMuted(true);
    } else if (isVideoMuted) {
      // If volume is increased from 0 and currently muted, unmute
      setIsVideoMuted(false);
    }
  };

  const toggleLoop = () => setIsVideoLoop(prev => !prev);
  const cycleSpeed = () => {
    const speeds = [0.5, 1, 1.5, 2];
    const idx = speeds.indexOf(playbackRate);
    setPlaybackRate(speeds[(idx + 1) % speeds.length]);
  };
  const seekBy = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime + seconds);
  };

  const formatVideoTime = (time: number) => {
    if (isNaN(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !videoDuration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * videoDuration;
    
    v.currentTime = Math.max(0, Math.min(newTime, videoDuration));
    setVideoProgress(newTime);
  };

  // Calculate pan limits based on zoom level and image size
  const getPanLimits = () => {
    if (!imageRef.current || zoom <= 1) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    const image = imageRef.current;
    const imageRect = image.getBoundingClientRect();
    const modalRect = modalRef.current?.getBoundingClientRect();
    
    if (!modalRect) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    // Calculate how much the image extends beyond the viewport
    const overflowX = Math.max(0, imageRect.width - modalRect.width);
    const overflowY = Math.max(0, imageRect.height - modalRect.height);

    // Stricter limits: ensure image edges are always visible
    // Use 80% of the overflow to keep edges visible
    const maxPanX = overflowX * 0.4; // Reduced from 0.5 to 0.4
    const maxPanY = overflowY * 0.4; // Reduced from 0.5 to 0.4

    return {
      minX: -maxPanX,
      maxX: maxPanX,
      minY: -maxPanY,
      maxY: maxPanY
    };
  };

  const constrainPan = (newPan: { x: number; y: number }) => {
    const limits = getPanLimits();
    return {
      x: Math.max(limits.minX, Math.min(limits.maxX, newPan.x)),
      y: Math.max(limits.minY, Math.min(limits.maxY, newPan.y))
    };
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    
    // Scale scroll speed based on zoom level
    // Higher zoom = slower, more precise scrolling
    const zoomFactor = Math.max(0.1, 1 / zoom);
    const scrollAmount = -e.deltaY * 0.5 * zoomFactor;
    
    setPan(prev => {
      const newPan = {
        ...prev,
        y: prev.y + scrollAmount
      };
      return constrainPan(newPan);
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Always allow dragging when mouse is pressed
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      // Scale panning speed based on zoom level
      // Higher zoom = slower, more precise panning
      const zoomFactor = Math.max(0.1, 1 / zoom);
      const deltaX = (e.clientX - dragStart.x) * zoomFactor;
      const deltaY = (e.clientY - dragStart.y) * zoomFactor;
      
      const newPan = {
        x: deltaX,
        y: deltaY
      };
      setPan(constrainPan(newPan));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    // This handler is only for clicks directly on the video content.
    e.stopPropagation(); // Prevent the background from closing the modal.
    togglePlayPause();
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    // For images, check if click is on letterboxed area to close modal
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const elementWidth = rect.width;
    const elementHeight = rect.height;

    // Get image dimensions
    const mediaWidth = photo?.width || 0;
    const mediaHeight = photo?.height || 0;

    // Fallback: if we can't determine intrinsic size, just stop propagation
    if (!mediaWidth || !mediaHeight || !elementWidth || !elementHeight) {
      e.stopPropagation();
      return;
    }

    // object-contain math: content scaled by the smaller scale, centered in the element
    const scale = Math.min(elementWidth / mediaWidth, elementHeight / mediaHeight);
    const drawnWidth = mediaWidth * scale;
    const drawnHeight = mediaHeight * scale;
    const drawnLeft = rect.left + (elementWidth - drawnWidth) / 2;
    const drawnTop = rect.top + (elementHeight - drawnHeight) / 2;

    const clickX = e.clientX;
    const clickY = e.clientY;
    const insideContent = clickX >= drawnLeft && clickX <= drawnLeft + drawnWidth && clickY >= drawnTop && clickY <= drawnTop + drawnHeight;

    if (insideContent) {
      // Clicking on the actual image content should not close
      e.stopPropagation();
    } else {
      // Clicking on letterboxed area inside the image element closes the modal
      e.stopPropagation();
      closeModal();
    }
  };

  const handleContainerClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    // This capture-phase handler intercepts clicks to see if they are on the letterbox.
    if (viewMode !== 'fit' || !videoRef.current) {
      return; // This logic is only for videos in fit mode.
    }

    // Don't interfere with clicks on UI controls like nav arrows.
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    const mediaWidth = video.videoWidth;
    const mediaHeight = video.videoHeight;

    // If dimensions aren't loaded, we can't know where the letterbox is. Do nothing.
    if (!mediaWidth || !mediaHeight) {
      return;
    }

    // Calculate the actual rendered size of the video content.
    const scale = Math.min(rect.width / mediaWidth, rect.height / mediaHeight);
    const drawnWidth = mediaWidth * scale;
    const drawnHeight = mediaHeight * scale;
    const drawnLeft = rect.left + (rect.width - drawnWidth) / 2;
    const drawnTop = rect.top + (rect.height - drawnHeight) / 2;

    const clickX = e.clientX;
    const clickY = e.clientY;
    const isInsideContent = clickX >= drawnLeft && clickX <= drawnLeft + drawnWidth && clickY >= drawnTop && clickY <= drawnTop + drawnHeight;

    if (!isInsideContent) {
      // The click was on the letterbox area. Prevent the video from playing/pausing, and close the modal.
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    }
    // If the click was inside the content, we do nothing here and let it bubble down to the video's own onClick handler.
  };

  // Capture-phase click handler on the container to intercept clicks on
  // letterboxed areas before the video element can toggle play/pause.

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Render different content based on file type
  const renderFileContent = () => {
    if (!photo) return null;

    const fileTypeInfo = getFileTypeInfo(photo.ext);
    
    if (shouldUseFileCard(photo.ext)) {
      // Render file-specific content
      if (fileTypeInfo.category === 'video') {
        // Render video player
        return (
          <video
            ref={videoRef}
            src={libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name)}
            className={getImageClasses()}
            autoPlay
            muted={isVideoMuted}
            loop={isVideoLoop}
            playsInline
            draggable={false}
            style={getImageStyle()}
            onClick={handleVideoClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setVideoDimensions({
                  width: videoRef.current.videoWidth,
                  height: videoRef.current.videoHeight
                });
                setVideoDuration(videoRef.current.duration);
              }
            }}
            onTimeUpdate={() => {
              if (videoRef.current && !isSeeking) {
                setVideoProgress(videoRef.current.currentTime);
              }
            }}
            onEnded={() => {
              setVideoProgress(0);
              if (!isVideoLoop && videoRef.current) {
                videoRef.current.pause();
              }
            }}
            onError={(e) => {
              console.log('Video load error in detailed view:', e);
            }}
          />
        );
      }
      if (fileTypeInfo.category === 'ebook' && photo.ext.toLowerCase() === 'epub') {
        const fileUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
        return (
          <div className="flex flex-col items-center justify-center">
            <EpubViewer fileUrl={fileUrl} />
          </div>
        );
      }
      
      return (
        <div className="flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
          {/* File icon */}
          <div className="text-8xl mb-6 opacity-80">
            {fileTypeInfo.icon}
          </div>
          
          {/* File name */}
          <h2 className="text-2xl font-bold text-white mb-4">{photo.name}</h2>
          
          {/* File type */}
          <p className="text-lg text-gray-300 mb-6">{fileTypeInfo.displayName}</p>
          
          {/* File info */}
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-6 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Size:</span>
                <span className="ml-2 text-white">{libraryService.formatFileSize(photo.size)}</span>
              </div>
              <div>
                <span className="text-gray-400">Modified:</span>
                <span className="ml-2 text-white">{libraryService.formatDate(photo.mtime)}</span>
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-4">
            {fileTypeInfo.canPreview ? (
              <button
                onClick={() => {
                  const fileUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
                  window.open(fileUrl, '_blank');
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                {fileTypeInfo.category === 'audio' && <Play className="w-5 h-5" />}
                {fileTypeInfo.category === 'ebook' && <BookOpen className="w-5 h-5" />}
                {fileTypeInfo.category === 'document' && <FileText className="w-5 h-5" />}
                {fileTypeInfo.canPreview ? 'Open' : 'Download'}
              </button>
            ) : (
              <button
                onClick={() => {
                  const fileUrl = libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name);
                  const link = document.createElement('a');
                  link.href = fileUrl;
                  link.download = photo.name;
                  link.click();
                }}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
            )}
          </div>
          
          {/* Tags */}
          {photo.tags && photo.tags.length > 0 && (
            <div className="mt-6">
              <div className="text-sm text-gray-400 mb-2">Tags:</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {photo.tags.map((tag: string, i: number) => (
                  <span key={i} className="px-3 py-1 text-sm bg-white/20 text-white rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    } else {
      // Render image or video content
      if (fileTypeInfo.category === 'video') {
        // Render video player
        return (
          <video
            ref={videoRef}
            src={libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name)}
            className={getImageClasses()}
            autoPlay
            muted={isVideoMuted}
            loop={isVideoLoop}
            playsInline
            draggable={false}
            style={getImageStyle()}
            onClick={handleVideoClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setVideoDimensions({
                  width: videoRef.current.videoWidth,
                  height: videoRef.current.videoHeight
                });
                setVideoDuration(videoRef.current.duration);
              }
            }}
            onTimeUpdate={() => {
              if (videoRef.current && !isSeeking) {
                setVideoProgress(videoRef.current.currentTime);
              }
            }}
            onEnded={() => {
              setVideoProgress(0);
              if (!isVideoLoop && videoRef.current) {
                videoRef.current.pause();
              }
            }}
            onError={(e) => {
              console.log('Video load error in detailed view:', e);
            }}
          />
        );
      } else {
        // Render image content
        return (
          <img
            ref={imageRef}
            src={libraryService.getPhotoFileUrl(photo.id, photo.ext, photo.name)}
            alt={photo.name}
            className={getImageClasses()}
            draggable={false}
            style={getImageStyle()}
            width={photo.width}
            height={photo.height}
            decoding="async"
            fetchPriority="high"
            loading="eager"
            sizes="(max-width: 768px) 100vw, 80vw"
            onClick={handleImageClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        );
      }
    }
  };

  // Add wheel event listener with passive: false (only when zoomed in for panning)
  useEffect(() => {
    const handleWheelEvent = (e: WheelEvent) => {
      if (zoom > 1 && photo && !shouldUseFileCard(photo.ext)) {
        handleWheel(e);
      }
    };

    const modalElement = modalRef.current;
    if (modalElement) {
      modalElement.addEventListener('wheel', handleWheelEvent, { passive: false });
    }

    return () => {
      if (modalElement) {
        modalElement.removeEventListener('wheel', handleWheelEvent as EventListener);
      }
    };
  }, [photo, zoom, pan]);

  // Ensure scroll starts at the beginning for overflow modes
  useEffect(() => {
    if (!imageContainerRef.current) return;
    const el = imageContainerRef.current;
    if (viewMode === 'horizontal' && hasVerticalOverflow) {
      el.scrollTop = 0;
    } else if (viewMode === 'vertical' && hasHorizontalOverflow) {
      el.scrollLeft = 0;
    }
  }, [photo, viewMode, hasVerticalOverflow, hasHorizontalOverflow]);

  // Measure overflow depending on mode (use intrinsic media dimensions vs container size)
  useEffect(() => {
    const measure = () => {
      if (!imageContainerRef.current) return;
      const container = imageContainerRef.current;
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      // Determine intrinsic media size
      let mw = 0;
      let mh = 0;
      if (videoRef.current && videoRef.current.videoWidth && videoRef.current.videoHeight) {
        mw = videoRef.current.videoWidth;
        mh = videoRef.current.videoHeight;
      } else if (photo) {
        mw = photo.width || 0;
        mh = photo.height || 0;
      }
      if (!mw || !mh || !cw || !ch) {
        setHasVerticalOverflow(false);
        setHasHorizontalOverflow(false);
        return;
      }

      if (viewMode === 'horizontal') {
        // Fit to width → scale by container width; check if resulting height exceeds container height
        const scale = cw / mw;
        const scaledHeight = mh * scale;
        setHasVerticalOverflow(scaledHeight > ch + 0.5);
        setHasHorizontalOverflow(false);
      } else if (viewMode === 'vertical') {
        // Fit to height → scale by container height; check if resulting width exceeds container width
        const scale = ch / mh;
        const scaledWidth = mw * scale;
        const hasOverflow = scaledWidth > cw + 0.5;
        setHasHorizontalOverflow(hasOverflow);
        // Compute precise max scroll to avoid overscrolling beyond the image edges
        const maxScroll = Math.max(0, Math.round(scaledWidth - cw));
        setHorizontalMaxScroll(maxScroll);
        setHasVerticalOverflow(false);
      } else {
        // Fit mode should never overflow
        setHasVerticalOverflow(false);
        setHasHorizontalOverflow(false);
        setHorizontalMaxScroll(0);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    const id = window.setTimeout(measure, 0);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearTimeout(id);
    };
  }, [viewMode, photo, videoRef.current?.videoWidth, videoRef.current?.videoHeight]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
      if (e.key === 'v') setViewMode('vertical');
      if (e.key === 'h') setViewMode('horizontal');
      if (e.key === 'f') setViewMode('fit');
      if (e.key === 'i' || e.key === 'I') setIsInfoBoxVisible(!isInfoBoxVisible);
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') handleResetZoom();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Reset zoom when photo changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setVideoDimensions(null); // Reset video dimensions for new video
    setVideoProgress(0);
    setVideoDuration(0);
  }, [photo]);

  // Preload next images and trigger pagination when needed
  useEffect(() => {
    if (!photo || currentIndex === -1) return;

    const preloadImage = (photoToPreload: any) => {
      if (!photoToPreload || preloadCacheRef.current.has(photoToPreload.id)) return;
      
      // Skip videos and files - only preload images
      const fileType = getFileTypeInfo(photoToPreload.ext);
      if (fileType.category === 'video' || shouldUseFileCard(photoToPreload.ext)) return;

      const img = new Image();
      img.src = libraryService.getPhotoFileUrl(photoToPreload.id, photoToPreload.ext, photoToPreload.name);
      preloadCacheRef.current.add(photoToPreload.id);
      
      console.log('Preloading image:', { id: photoToPreload.id, name: photoToPreload.name });
    };

    // Preload next 2-3 images
    for (let i = 1; i <= 3; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < photos.length) {
        preloadImage(photos[nextIndex]);
      }
    }

    // Preload previous 1-2 images
    for (let i = 1; i <= 2; i++) {
      const prevIndex = currentIndex - i;
      if (prevIndex >= 0) {
        preloadImage(photos[prevIndex]);
      }
    }

    // Check if we're approaching the end of the current chunk and need to load more
    // Trigger when within 10 photos of the end
    const remainingPhotos = photos.length - currentIndex;
    const shouldLoadMore = remainingPhotos <= 10;

    if (shouldLoadMore) {
      console.log('DetailedView: Approaching end of chunk, checking for more photos...', {
        currentIndex,
        photosLength: photos.length,
        remainingPhotos,
        hasNextPage: hasNextPageAvailable,
        isFetchingNextPage
      });

      // Trigger pagination for the appropriate query
      if (searchQuery.trim().length > 0) {
        // Search results
        if (fastSearchQuery.hasNextPage && !fastSearchQuery.isLoading) {
          console.log('DetailedView: Fetching next page of search results');
          // Note: fastSearchQuery doesn't have fetchNextPage, it's a single query
        }
      } else if (hasNextPageAvailable && !isFetchingNextPage) {
        console.log('DetailedView: Fetching next page of results via auto-preload');
        triggerFetchNextPage();
      }
    }
  }, [
    photo,
    currentIndex,
    photos,
    hasNextPageAvailable,
    isFetchingNextPage,
    searchQuery,
    currentTag,
    fastSearchQuery,
    triggerFetchNextPage
  ]);


  const isModalOpen = detailedPhoto !== null;

  // Non-invasive scroll lock: prevent wheel/touch/keys, avoid layout/style changes
  useEffect(() => {
    if (!isModalOpen) return;
    const prevent = (e: Event) => {
      // Allow wheel/touchmove inside the image container ONLY when there's overflow on the active axis (and not zoomed)
      if (imageContainerRef.current && e.target && imageContainerRef.current.contains(e.target as Node) && zoom <= 1) {
        if (viewMode === 'horizontal' && hasVerticalOverflow) return; // permit vertical scroll inside
        if (viewMode === 'vertical' && hasHorizontalOverflow) return; // permit horizontal scroll inside
      }
      e.preventDefault();
    };
    const keyHandler = (e: KeyboardEvent) => {
      const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'];
      if (keys.includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', prevent, { passive: false } as AddEventListenerOptions);
    window.addEventListener('touchmove', prevent, { passive: false } as AddEventListenerOptions);
    window.addEventListener('keydown', keyHandler, { passive: false } as AddEventListenerOptions);

    // Hard lock page scroll by hiding document scrollbars
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('wheel', prevent as EventListener);
      window.removeEventListener('touchmove', prevent as EventListener);
      window.removeEventListener('keydown', keyHandler as EventListener);
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [isModalOpen, viewMode, zoom, hasVerticalOverflow, hasHorizontalOverflow]);

  // No scroll restoration needed; background never moved
  // (Keep this effect intentionally empty)

  // Early return if no photo is selected - all hooks have been called
  if (!detailedPhoto) {
    return null;
  }

  // Helper function to get folder names from folder IDs
  const getFolderNames = (folderIds: string[]): string[] => {
    if (!folderTree || !folderIds.length) {
      return [];
    }
    
    const findFolderName = (folders: any[], folderId: string): string | null => {
      for (const folder of folders) {
        if (folder.id === folderId) {
          return folder.name;
        }
        if (folder.children && folder.children.length > 0) {
          const found = findFolderName(folder.children, folderId);
          if (found) return found;
        }
      }
      return null;
    };
    
    return folderIds
      .map(id => findFolderName(folderTree, id))
      .filter((name): name is string => name !== null);
  };

  const handleFolderClick = (folderId: string) => {
    // Ensure we exit tag view and switch to the selected folder
    setCurrentTag(null);
    setCurrentFolder(folderId);
    setDetailedPhoto(null);

    // Build breadcrumbed URL and navigate
    if (folderTree) {
      const findFolder = (folders: any[], targetId: string): any | null => {
        for (const folder of folders) {
          if (folder.id === targetId) return folder;
          if (folder.children && folder.children.length) {
            const found = findFolder(folder.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };
      const folderNode = findFolder(folderTree, folderId);
      if (folderNode) {
        const url = generateFolderUrl(folderNode, folderTree);
        if (url) {
          navigate(url);
        }
      }
    }
  };

  if (!photo) {
    console.log('DetailedPhotoModal: No photo, returning null');
    return null;
  }
  if (!photos.length) {
    console.log('DetailedPhotoModal: No photos array, returning null');
    return null;
  }

  console.log('DetailedPhotoModal: Rendering modal with photo:', photo.name);

  const isWaitingForMorePhotos = Boolean(pendingNavigation) || isFetchingNextPage;
  const shouldShowNextButton = photos.length > 0 && (currentIndex < photos.length - 1 || hasNextPageAvailable || Boolean(pendingNavigation));

  return (
    <div 
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overscroll-contain" 
      onClick={handleModalClick}
      onMouseMove={handleRootMouseMove}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Navigation */}
      {photos.length && currentIndex > 0 && (
        <button
          className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white z-10 touch-manipulation transition-opacity ${
            isNearLeftEdge ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => { e.stopPropagation(); showPrev(); }}
        >
          <ArrowLeft className="w-8 h-8" />
        </button>
      )}
      {shouldShowNextButton && (
        <button
          className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white z-10 touch-manipulation transition-opacity disabled:opacity-70 disabled:cursor-not-allowed ${
            isNearRightEdge || currentIndex >= photos.length - 1 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => { e.stopPropagation(); showNext(); }}
          disabled={currentIndex >= photos.length - 1 && (!hasNextPageAvailable || isWaitingForMorePhotos)}
        >
          {currentIndex >= photos.length - 1 && isWaitingForMorePhotos ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <ArrowRight className="w-8 h-8" />
          )}
        </button>
      )}
      
      {/* Swipe direction indicators - show during drag */}
      {swipeOffset !== 0 && !isSwipeTransitioning && (
        <>
          {swipeOffset > 0 && currentIndex > 0 && (
            <div 
              className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white/20 to-transparent pointer-events-none z-10 flex items-center justify-start pl-4"
              style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 100) }}
            >
              <ArrowLeft className="w-12 h-12 text-white drop-shadow-lg" />
            </div>
          )}
          {swipeOffset < 0 && currentIndex < photos.length - 1 && (
            <div 
              className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white/20 to-transparent pointer-events-none z-10 flex items-center justify-end pr-4"
              style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 100) }}
            >
              <ArrowRight className="w-12 h-12 text-white drop-shadow-lg" />
            </div>
          )}
        </>
      )}

      {pendingNavigation && (
        <div className="absolute bottom-10 right-16 flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-2 rounded-full z-10">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading more photos…</span>
        </div>
      )}

      {/* View mode controls - only for images */}
      {photo && getFileTypeInfo(photo.ext).category !== 'video' && !shouldUseFileCard(photo.ext) && (!hideControlsWithInfoBox || isInfoBoxVisible) && (
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {/* Vertical expand button */}
          <button
            className={`p-3 rounded-full transition-colors ${
              viewMode === 'vertical' 
                ? 'bg-white/20 text-white' 
                : 'bg-black/50 hover:bg-black/70 text-white'
            }`}
            onClick={(e) => { e.stopPropagation(); setViewMode('vertical'); }}
            title="Expand to full height (V)"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-3 h-6 border-2 border-current rounded-sm"></div>
            </div>
          </button>

          {/* Horizontal expand button */}
          <button
            className={`p-3 rounded-full transition-colors ${
              viewMode === 'horizontal' 
                ? 'bg-white/20 text-white' 
                : 'bg-black/50 hover:bg-black/70 text-white'
            }`}
            onClick={(e) => { e.stopPropagation(); setViewMode('horizontal'); }}
            title="Expand to full width (H)"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-6 h-3 border-2 border-current rounded-sm"></div>
            </div>
          </button>

          {/* Fit to screen button */}
          <button
            className={`p-3 rounded-full transition-colors ${
              viewMode === 'fit' 
                ? 'bg-white/20 text-white' 
                : 'bg-black/50 hover:bg-black/70 text-white'
            }`}
            onClick={(e) => { e.stopPropagation(); setViewMode('fit'); }}
            title="Fit to screen (F)"
          >
            <Minimize2 className="w-6 h-6" />
          </button>

          {/* Toggle info box button */}
          <button
            className="p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors touch-manipulation"
            onClick={(e) => { e.stopPropagation(); setIsInfoBoxVisible(!isInfoBoxVisible); }}
            title={isInfoBoxVisible ? "Hide info box (I)" : "Show info box (I)"}
          >
            {isInfoBoxVisible ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
          </button>

          {/* Exit button */}
          <button
            className="p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); closeModal(); }}
            title="Exit (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Persistent eye button - shown when controls are hidden due to hideControlsWithInfoBox setting */}
      {hideControlsWithInfoBox && !isInfoBoxVisible && (
        <div className="absolute top-4 right-4 z-10">
          <button
            className="p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors touch-manipulation"
            onClick={(e) => { e.stopPropagation(); setIsInfoBoxVisible(true); }}
            title="Show info box and controls (I)"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Controls for non-image content (videos, files) */}
      {(!photo || getFileTypeInfo(photo.ext).category === 'video' || shouldUseFileCard(photo.ext)) && (!hideControlsWithInfoBox || isInfoBoxVisible) && (
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {/* Toggle info box button */}
          <button
            className="p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors touch-manipulation"
            onClick={(e) => { e.stopPropagation(); setIsInfoBoxVisible(!isInfoBoxVisible); }}
            title={isInfoBoxVisible ? "Hide info box (I)" : "Show info box (I)"}
          >
            {isInfoBoxVisible ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
          </button>

          {/* Exit button */}
          <button
            className="p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); closeModal(); }}
            title="Exit (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Video controls overlay - shown when displaying a video */}
      {photo && getFileTypeInfo(photo.ext).category === 'video' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 bg-black/30 backdrop-blur-lg text-white px-3 py-2 rounded-lg">
          {/* Seek bar */}
          <div className="flex items-center gap-2 w-full max-w-sm">
            <span className="text-xs text-gray-300 min-w-[30px]">{formatVideoTime(videoProgress)}</span>
            <div 
              className="flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer relative"
              onClick={(e) => { e.stopPropagation(); handleSeekBarClick(e); }}
            >
              <div 
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{ width: videoDuration ? `${(videoProgress / videoDuration) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-xs text-gray-300 min-w-[30px]">{formatVideoTime(videoDuration)}</span>
          </div>
          
          {/* Control buttons */}
          <div className="flex items-center gap-1.5">
            <button className="p-1.5 hover:bg-white/10 rounded-full" onClick={(e) => { e.stopPropagation(); seekBy(-5); }} title="Rewind 5s">
              <Rewind className="w-4 h-4" />
            </button>
            <button className="p-1.5 hover:bg-white/10 rounded-full" onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} title="Play/Pause">
              {videoRef.current && videoRef.current.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button className="p-1.5 hover:bg-white/10 rounded-full" onClick={(e) => { e.stopPropagation(); seekBy(5); }} title="Forward 5s">
              <FastForward className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-white/30 mx-0.5" />

            <button className={`p-1.5 rounded-full ${isVideoMuted ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={(e) => { e.stopPropagation(); toggleMute(); }} title={isVideoMuted ? 'Unmute' : 'Mute'}>
              {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            
            {/* Volume Slider */}
            <div className="flex items-center gap-1 min-w-[60px]">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={videoVolume}
                onChange={(e) => { e.stopPropagation(); handleVolumeChange(parseFloat(e.target.value)); }}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #ffffff 0%, #ffffff ${videoVolume * 100}%, rgba(255,255,255,0.2) ${videoVolume * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
                title={`Volume: ${Math.round(videoVolume * 100)}%`}
              />
              <span className="text-xs text-gray-300 min-w-[25px] text-center">
                {Math.round(videoVolume * 100)}%
              </span>
            </div>

            <button className={`p-1.5 rounded-full ${isVideoLoop ? 'bg-white/10' : 'hover:bg-white/10'}`} onClick={(e) => { e.stopPropagation(); toggleLoop(); }} title={isVideoLoop ? 'Loop: On' : 'Loop: Off'}>
              <Repeat className="w-4 h-4" />
            </button>
            <button className="px-2 py-1 text-xs bg-white/10 hover:bg-white/15 rounded-full" onClick={(e) => { e.stopPropagation(); cycleSpeed(); }} title="Playback speed">
              {playbackRate}x
            </button>
          </div>
        </div>
      )}

      {/* Zoom controls - only for images */}
      {photo && getFileTypeInfo(photo.ext).category !== 'video' && !shouldUseFileCard(photo.ext) && (!hideControlsWithInfoBox || isInfoBoxVisible) && (
        <div className="absolute top-4 left-4 flex gap-2 z-10">
          {/* Zoom out button */}
          <button
            className={`p-3 rounded-full transition-colors ${
              zoom <= 0.1 
                ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed' 
                : 'bg-black/50 hover:bg-black/70 text-white'
            }`}
            onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
            disabled={zoom <= 0.1}
            title="Zoom out (-)"
          >
            <ZoomOut className="w-6 h-6" />
          </button>

          {/* Zoom level indicator */}
          <div className="px-4 py-3 bg-black/70 text-white text-sm font-mono rounded-full flex items-center min-w-[60px] justify-center">
            {Math.round(zoom * 100)}%
          </div>

          {/* Zoom in button */}
          <button
            className={`p-3 rounded-full transition-colors ${
              zoom >= 5 
                ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed' 
                : 'bg-black/50 hover:bg-black/70 text-white'
            }`}
            onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
            disabled={zoom >= 5}
            title="Zoom in (+)"
          >
            <ZoomIn className="w-6 h-6" />
          </button>

          {/* Reset zoom button */}
          <button
            className={`p-3 rounded-full transition-colors ${
              zoom === 1 && pan.x === 0 && pan.y === 0
                ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                : 'bg-black/50 hover:bg-black/70 text-white'
            }`}
            onClick={(e) => { e.stopPropagation(); handleResetZoom(); }}
            disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
            title="Reset zoom (0)"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Navigation hint when zoomed in - only for images */}
      {photo && getFileTypeInfo(photo.ext).category !== 'video' && !shouldUseFileCard(photo.ext) && zoom > 1 && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full z-10">
          Scroll to navigate • Drag to pan
        </div>
      )}

      {/* Image container */}
      <div 
        ref={imageContainerRef}
        className={`relative flex overscroll-contain w-full h-full ${
          viewMode === 'horizontal'
            ? `${hasVerticalOverflow ? 'items-start' : 'items-center'} justify-center p-0 ${zoom <= 1 && hasVerticalOverflow ? 'overflow-y-auto' : 'overflow-y-hidden'} overflow-x-hidden`
            : viewMode === 'vertical'
            ? `items-center ${hasHorizontalOverflow ? 'justify-start' : 'justify-center'} p-0 ${zoom <= 1 && hasHorizontalOverflow ? 'overflow-x-auto' : 'overflow-x-hidden'} overflow-y-hidden`
            : 'items-center justify-center overflow-hidden'
        }`}
        onClick={handleModalClick}
        onClickCapture={handleContainerClickCapture}
        onScroll={(e) => {
          if (viewMode === 'vertical' && hasHorizontalOverflow && imageContainerRef.current && zoom <= 1) {
            const el = imageContainerRef.current;
            if (el.scrollLeft < 0) el.scrollLeft = 0;
            if (el.scrollLeft > horizontalMaxScroll) el.scrollLeft = horizontalMaxScroll;
          }
        }}
        onWheel={(e) => {
          // For very wide images in fit-to-height, translate vertical wheel to horizontal scroll
          if (viewMode === 'vertical' && hasHorizontalOverflow && imageContainerRef.current) {
            // If the user's intent is vertical (deltaY dominates), scroll horizontally instead
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              e.preventDefault();
              e.stopPropagation();
              const el = imageContainerRef.current;
              const prev = el.scrollLeft;
              const next = prev + e.deltaY;
              const maxScroll = horizontalMaxScroll > 0 ? horizontalMaxScroll : Math.max(0, el.scrollWidth - el.clientWidth);
              const clamped = Math.max(0, Math.min(next, maxScroll));
              if (clamped !== prev) el.scrollLeft = clamped;
              return;
            }
          }
          // Lock scroll when not overflow mode
          if (viewMode === 'horizontal' && !hasVerticalOverflow) { e.preventDefault(); e.stopPropagation(); return; }
          if (viewMode === 'vertical' && !hasHorizontalOverflow) { e.preventDefault(); e.stopPropagation(); return; }
          // Otherwise allow native scroll on the active axis but don't bubble to the background
          e.stopPropagation();
        }}
      >
        {/* Previous image preview - always rendered for preloading, positioned based on swipe */}
        {currentIndex > 0 && photos[currentIndex - 1] && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={getPrevPreviewStyle()}
          >
            <img
              src={libraryService.getPhotoFileUrl(photos[currentIndex - 1].id, photos[currentIndex - 1].ext, photos[currentIndex - 1].name)}
              alt={photos[currentIndex - 1].name}
              className={getImageClasses()}
              draggable={false}
            />
          </div>
        )}
        
        {/* Next image preview - always rendered for preloading, positioned based on swipe */}
        {currentIndex < photos.length - 1 && photos[currentIndex + 1] && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={getNextPreviewStyle()}
          >
            <img
              src={libraryService.getPhotoFileUrl(photos[currentIndex + 1].id, photos[currentIndex + 1].ext, photos[currentIndex + 1].name)}
              alt={photos[currentIndex + 1].name}
              className={getImageClasses()}
              draggable={false}
            />
          </div>
        )}
        
        {/* Current image */}
        {renderFileContent()}
      </div>

      {/* Metadata Corner Overlay */}
      {isInfoBoxVisible && (
        <div 
          className="absolute bottom-4 left-4 bg-black/30 backdrop-blur-lg rounded-lg p-4 text-white"
          style={{ 
            maxWidth: `${Math.min(infoBoxSize * 0.25, 35)}%`, // More aggressive width limit, cap at 35%
            transform: `scale(${infoBoxSize / 100})`,
            transformOrigin: 'bottom left'
          }}
          onClick={e => e.stopPropagation()}
        >
        <div className="space-y-3">
          {/* File Info */}
          <div>
            <h3 className="font-semibold text-lg break-words">{photo.name}</h3>
            <div className="text-sm text-gray-300">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">File Info:</span>
              </div>
              <div className="break-words">
                {shouldUseFileCard(photo.ext) ? (
                  <>
                    {getFileTypeInfo(photo.ext).displayName} • {libraryService.formatFileSize(photo.size)} • {photo.ext.toUpperCase()}
                    {getFileTypeInfo(photo.ext).category === 'video' && photo.duration && (
                      <> • {Math.round(photo.duration)}s</>
                    )}
                  </>
                ) : (
                  <>
                    {photo.width}×{photo.height} • {libraryService.formatFileSize(photo.size)} • {photo.ext.toUpperCase()}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Folders */}
          {photo.folders && photo.folders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Folder className="w-4 h-4" />
                Folders:
              </div>
              <div className="flex flex-wrap gap-1">
                {getFolderNames(photo.folders).map((folderName, index) => {
                  const folderId = photo.folders[index];
                  return (
                    <button
                      key={folderId}
                      onClick={() => handleFolderClick(folderId)}
                      className={`px-2 py-1 text-xs ${getAccentColor(accentColor)} hover:${getAccentHover(accentColor)} text-white rounded-full transition-colors cursor-pointer`}
                      title={`Go to ${folderName}`}
                    >
                      {folderName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags - only show if there are tags */}
          {photo.tags && photo.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Tag className="w-4 h-4" />
                Tags:
              </div>
              <div className="flex flex-wrap gap-1">
                {photo.tags.map((tag: string, i: number) => {
                  const tagCount = tagCounts[tag] || 0;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        // Navigate to tag view
                        setDetailedPhoto(null); // Close modal
                        setCurrentTag(tag);
                        setCurrentFolder(null);
                        const tagUrl = generateTagUrl(tag);
                        window.location.href = tagUrl;
                      }}
                      className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded-full transition-colors cursor-pointer"
                      title={`View all ${tagCount} files with tag: ${tag}`}
                    >
                      {tag}
                      {tagCount > 0 && (
                        <span className="ml-1 text-gray-300">({tagCount})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Camera Info - only for images */}
          {!shouldUseFileCard(photo.ext) && photo.camera && (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Camera className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Camera:</span>
              </div>
              <div className="break-words">
                {photo.camera}
              </div>
            </div>
          )}

          {/* Date/Time */}
          {photo.dateTime && (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Date/Time:</span>
              </div>
              <div className="break-words">
                {new Date(photo.dateTime).toLocaleString()}
              </div>
            </div>
          )}

          {/* Date Imported */}
          {photo.btime && (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Date Imported:</span>
              </div>
              <div className="break-words">
                {new Date(photo.btime).toLocaleString()}
              </div>
            </div>
          )}

          {/* URL - show only for true external links */}
          {isExternalUrl(photo.url) && (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">URL:</span>
              </div>
              <div className="break-all">
                {renderClickableUrl(photo.url, undefined, "text-blue-400 hover:text-blue-300 underline break-all")}
              </div>
            </div>
          )}

          {/* Notes */}
          {photo.annotation && (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Notes:</span>
              </div>
              <div className="break-words">
                {linkifyText(photo.annotation, "text-blue-400 hover:text-blue-300 underline break-words")}
              </div>
            </div>
          )}

          {/* GPS Location - only for images */}
          {!shouldUseFileCard(photo.ext) && photo.gps_latitude && photo.gps_longitude && (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">GPS Location:</span>
              </div>
              <div className="break-words">
                {photo.gps_latitude.toFixed(6)}, {photo.gps_longitude.toFixed(6)}
                {photo.gps_altitude && <span> ({photo.gps_altitude}m)</span>}
              </div>
            </div>
          )}

          {/* EXIF Data - only for images */}
          {!shouldUseFileCard(photo.ext) && photo.exif_data && (
            <div className="text-sm">
              <div className="font-medium mb-1">EXIF Data:</div>
              <div className="text-gray-300 space-y-1">
                {Object.entries(JSON.parse(photo.exif_data)).slice(0, 5).map(([key, value]) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400 flex-shrink-0">{key}:</span>
                    <span className="break-words">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}; 