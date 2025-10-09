import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeGrid, FixedSizeList } from 'react-window';
import { PhotoMetadata } from '@/types';
import { MemoizedPhotoCard } from './MemoizedPhotoCard';
import { useSimpleImagePreloading } from '@/hooks/useSimpleImagePreloading';
import { useAppStore } from '@/store';

interface ReactWindowPhotoGridProps {
  photos: PhotoMetadata[];
  isMobile?: boolean;
  currentView: {
    type: 'grid' | 'list';
    thumbnailSize: 'small' | 'medium' | 'large';
  };
  selectedItems: string[];
  onSelect: (photoId: string) => void;
  onDoubleClick: (photo: PhotoMetadata) => void;
  isFetchingNextPage: boolean;
  accentColor: string;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
}

// Calculate responsive column count based on screen size and thumbnail size
const getColumnCount = (thumbnailSize: 'small' | 'medium' | 'large', isMobile: boolean): number => {
  if (isMobile) return 2;
  
  const screenWidth = window.innerWidth;
  switch (thumbnailSize) {
    case 'small':
      if (screenWidth >= 1600) return 8;
      if (screenWidth >= 1200) return 6;
      if (screenWidth >= 900) return 4;
      if (screenWidth >= 600) return 3;
      return 2;
    case 'large':
      if (screenWidth >= 1600) return 4;
      if (screenWidth >= 1200) return 3;
      if (screenWidth >= 900) return 2;
      return 2;
    default: // medium
      if (screenWidth >= 1600) return 6;
      if (screenWidth >= 1200) return 4;
      if (screenWidth >= 900) return 3;
      if (screenWidth >= 600) return 2;
      return 2;
  }
};

// Calculate item size based on view type and thumbnail size
const getItemSize = (
  thumbnailSize: 'small' | 'medium' | 'large', 
  isMobile: boolean, 
  viewType: 'grid' | 'list'
): number => {
  if (viewType === 'list') {
    return 80; // Fixed height for list items
  }
  
  // For grid view, calculate based on thumbnail size
  switch (thumbnailSize) {
    case 'small':
      return isMobile ? 150 : 200;
    case 'large':
      return isMobile ? 250 : 400;
    default:
      return isMobile ? 200 : 300;
  }
};

// Grid item component
const GridItem = React.memo(({ 
  columnIndex, 
  rowIndex, 
  style, 
  data 
}: {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: {
    photos: PhotoMetadata[];
    columnCount: number;
    selectedItems: string[];
    onSelect: (photoId: string) => void;
    onDoubleClick: (photo: PhotoMetadata) => void;
    thumbnailSize: 'small' | 'medium' | 'large';
    isMobile: boolean;
  };
}) => {
  const { photos, columnCount, selectedItems, onSelect, onDoubleClick, thumbnailSize, isMobile } = data;
  const index = rowIndex * columnCount + columnIndex;
  const photo = photos[index];

  if (!photo) {
    return <div style={style} />;
  }

  const isSelected = selectedItems.includes(photo.id);

  return (
    <div style={style} className="p-1">
      <MemoizedPhotoCard
        photo={photo}
        size={thumbnailSize}
        isSelected={isSelected}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        isMobile={isMobile}
      />
    </div>
  );
});

// List item component
const ListItem = React.memo(({ 
  index, 
  style, 
  data 
}: {
  index: number;
  style: React.CSSProperties;
  data: {
    photos: PhotoMetadata[];
    selectedItems: string[];
    onSelect: (photoId: string) => void;
    onDoubleClick: (photo: PhotoMetadata) => void;
    thumbnailSize: 'small' | 'medium' | 'large';
    isMobile: boolean;
  };
}) => {
  const { photos, selectedItems, onSelect, onDoubleClick, thumbnailSize, isMobile } = data;
  const photo = photos[index];

  if (!photo) {
    return <div style={style} />;
  }

  const isSelected = selectedItems.includes(photo.id);

  return (
    <div style={style} className="p-1">
      <MemoizedPhotoCard
        photo={photo}
        size={thumbnailSize}
        isSelected={isSelected}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        isMobile={isMobile}
      />
    </div>
  );
});

export const ReactWindowPhotoGrid: React.FC<ReactWindowPhotoGridProps> = ({
  photos,
  isMobile = false,
  currentView,
  selectedItems,
  onSelect,
  onDoubleClick,
  isFetchingNextPage,
  accentColor,
  onLoadMore,
  hasNextPage = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(600);
  const [containerWidth, setContainerWidth] = React.useState<number>(typeof window !== 'undefined' ? window.innerWidth : 800);

  // Calculate responsive values
  const columnCount = useMemo(() => 
    getColumnCount(currentView.thumbnailSize, isMobile), 
    [currentView.thumbnailSize, isMobile]
  );

  const itemSize = useMemo(() => 
    getItemSize(currentView.thumbnailSize, isMobile, currentView.type), 
    [currentView.thumbnailSize, isMobile, currentView.type]
  );

  // Calculate grid dimensions
  const rowCount = useMemo(() => 
    Math.ceil(photos.length / columnCount), 
    [photos.length, columnCount]
  );

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 100; // Account for header/footer
        setContainerHeight(Math.max(400, availableHeight));
        setContainerWidth(Math.max(300, containerRef.current.clientWidth));
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Observe container size changes (e.g., sidebar toggles)
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => updateSize());
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      if (resizeObserver && containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);

  // Simple background preloading for virtual scrolling
  const preloading = useSimpleImagePreloading(photos, {
    preloadCount: 3,
    delay: 3000, // 3 second delay for virtual scrolling
  });

  // Prepare data for grid items
  const gridData = useMemo(() => ({
    photos,
    columnCount,
    selectedItems,
    onSelect,
    onDoubleClick,
    thumbnailSize: currentView.thumbnailSize,
    isMobile,
  }), [photos, columnCount, selectedItems, onSelect, onDoubleClick, currentView.thumbnailSize, isMobile]);

  // Prepare data for list items
  const listData = useMemo(() => ({
    photos,
    selectedItems,
    onSelect,
    onDoubleClick,
    thumbnailSize: currentView.thumbnailSize,
    isMobile,
  }), [photos, selectedItems, onSelect, onDoubleClick, currentView.thumbnailSize, isMobile]);

  // Handle infinite loading
  const handleItemsRendered = useCallback(({ visibleStopIndex }: { visibleStopIndex: number }) => {
    if (onLoadMore && hasNextPage && visibleStopIndex >= photos.length - 10) {
      onLoadMore();
    }
  }, [onLoadMore, hasNextPage, photos.length]);

  if (currentView.type === 'list') {
    return (
      <div ref={containerRef} className="w-full">
        <FixedSizeList
          height={containerHeight}
          width={containerWidth}
          itemCount={photos.length}
          itemSize={itemSize}
          itemData={listData}
          onItemsRendered={handleItemsRendered}
          overscanCount={5}
        >
          {ListItem}
        </FixedSizeList>
        
        {/* Loading indicator */}
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-8">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${accentColor}`}></div>
          </div>
        )}
      </div>
    );
  }

  // Grid view
  return (
    <div ref={containerRef} className="w-full">
      <FixedSizeGrid
        height={containerHeight}
        width={containerWidth}
        columnCount={columnCount}
        columnWidth={Math.max(1, Math.floor(containerWidth / Math.max(1, columnCount)))}
        rowCount={rowCount}
        rowHeight={itemSize}
        itemData={gridData}
        onItemsRendered={handleItemsRendered}
        overscanRowCount={3}
        overscanColumnCount={1}
      >
        {GridItem}
      </FixedSizeGrid>
      
      {/* Loading indicator */}
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-8">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${accentColor}`}></div>
        </div>
      )}
    </div>
  );
};