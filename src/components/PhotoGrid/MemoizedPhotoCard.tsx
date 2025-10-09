import React from 'react';
import { PhotoMetadata } from '@/types';
import { PhotoCard } from './PhotoCard';
import { FileCard } from '../FileCard';
import { shouldUseFileCard } from '@/utils/fileTypes';

interface MemoizedPhotoCardProps {
  photo: PhotoMetadata;
  size: 'small' | 'medium' | 'large';
  isSelected: boolean;
  onSelect: (photoId: string) => void;
  onDoubleClick: (photo: PhotoMetadata) => void;
  isMobile?: boolean;
}

// Memoized PhotoCard component for virtual scrolling performance
export const MemoizedPhotoCard = React.memo<MemoizedPhotoCardProps>(({
  photo,
  size,
  isSelected,
  onSelect,
  onDoubleClick,
  isMobile = false,
}) => {
  if (shouldUseFileCard(photo.ext)) {
    return (
      <FileCard
        file={photo}
        size={size}
        isSelected={isSelected}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        isMobile={isMobile}
      />
    );
  }

  return (
    <PhotoCard
      photo={photo}
      size={size}
      isSelected={isSelected}
      onSelect={onSelect}
      onDoubleClick={onDoubleClick}
      isMobile={isMobile}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.photo.id === nextProps.photo.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.size === nextProps.size &&
    prevProps.isMobile === nextProps.isMobile &&
    // Only re-render if the photo data actually changed
    prevProps.photo.mtime === nextProps.photo.mtime &&
    prevProps.photo.name === nextProps.photo.name &&
    prevProps.photo.ext === nextProps.photo.ext
  );
});

MemoizedPhotoCard.displayName = 'MemoizedPhotoCard';