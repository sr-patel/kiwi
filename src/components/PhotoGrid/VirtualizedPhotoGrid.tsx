import React, { useMemo, useCallback } from 'react';
import { PhotoMetadata } from '@/types';
import { PhotoCard } from './PhotoCard';
import { FileCard } from '../FileCard';
import { useVirtualScrolling } from '@/hooks/useVirtualScrolling';
import { shouldUseFileCard } from '@/utils/fileTypes';
import { useAppStore } from '@/store';

interface VirtualizedPhotoGridProps {
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
}

export const VirtualizedPhotoGrid: React.FC<VirtualizedPhotoGridProps> = ({
  photos,
  isMobile = false,
  currentView,
  selectedItems,
  onSelect,
  onDoubleClick,
  isFetchingNextPage,
  accentColor,
}) => {
  // Calculate item height based on view type and size
  const itemHeight = useMemo(() => {
    if (currentView.type === 'list') {
      return 80; // Fixed height for list items
    }
    
    // For grid view, calculate based on thumbnail size
    switch (currentView.thumbnailSize) {
      case 'small':
        return isMobile ? 150 : 200;
      case 'large':
        return isMobile ? 250 : 400;
      default:
        return isMobile ? 200 : 300;
    }
  }, [currentView.type, currentView.thumbnailSize, isMobile]);

  // Get container height (viewport height minus header/footer)
  const containerHeight = useMemo(() => {
    return window.innerHeight - 200; // Adjust based on your layout
  }, []);

  // Use virtual scrolling
  const { visibleItems, totalHeight, containerRef } = useVirtualScrolling(photos, {
    itemHeight,
    containerHeight,
    overscan: 10, // Render 10 extra items above/below visible area
  });

  // Render individual photo card
  const renderCard = useCallback((photo: PhotoMetadata, index: number) => {
    const isSelected = selectedItems.includes(photo.id);
    
    if (shouldUseFileCard(photo.ext)) {
      return (
        <FileCard
          key={photo.id}
          file={photo}
          size={currentView.thumbnailSize}
          isSelected={isSelected}
          onSelect={onSelect}
          onDoubleClick={onDoubleClick}
          isMobile={isMobile}
        />
      );
    }

    return (
      <PhotoCard
        key={photo.id}
        photo={photo}
        size={currentView.thumbnailSize}
        isSelected={isSelected}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        isMobile={isMobile}
      />
    );
  }, [selectedItems, currentView.thumbnailSize, onSelect, onDoubleClick, isMobile]);

  if (currentView.type === 'list') {
    return (
      <div
        ref={containerRef}
        className="h-full overflow-auto"
        style={{ height: containerHeight }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleItems.map(({ item: photo, index }) => (
            <div
              key={photo.id}
              style={{
                position: 'absolute',
                top: index * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              {renderCard(photo, index)}
            </div>
          ))}
        </div>
        
        {/* Loading indicator */}
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-8">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${accentColor}`}></div>
          </div>
        )}
      </div>
    );
  }

  // Grid view with virtual scrolling
  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto"
      style={{ height: containerHeight }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item: photo, index }) => {
          // Calculate grid position
          const itemsPerRow = isMobile ? 2 : 6; // Adjust based on your grid
          const row = Math.floor(index / itemsPerRow);
          const col = index % itemsPerRow;
          
          return (
            <div
              key={photo.id}
              style={{
                position: 'absolute',
                top: row * itemHeight,
                left: col * (100 / itemsPerRow) + '%',
                width: (100 / itemsPerRow) + '%',
                height: itemHeight,
                padding: '4px',
              }}
            >
              {renderCard(photo, index)}
            </div>
          );
        })}
      </div>
      
      {/* Loading indicator */}
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-8">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${accentColor}`}></div>
        </div>
      )}
    </div>
  );
};