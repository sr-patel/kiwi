import { useEffect } from 'react';
import type { PhotoMetadata } from '@/types';
import { libraryService } from '@/services/libraryService';

/** Preload a small navigation window and cancel pending work when it changes. */
export function useMediaPreload(photos: readonly PhotoMetadata[], limit = 3): void {
  const photoKey = photos
    .slice(0, limit)
    .map((photo) => `${photo.id}:${photo.name}`)
    .join('|');

  useEffect(() => {
    const images = photos.slice(0, limit).map((photo) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = libraryService.getPhotoDisplayUrl(photo.id, photo.ext, photo.name);
      return image;
    });

    return () => {
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
        image.src = '';
      }
    };
  }, [photoKey, limit]);
}
