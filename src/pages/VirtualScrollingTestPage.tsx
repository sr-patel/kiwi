import React, { useState, useEffect } from 'react';
import { VirtualScrollingTest } from '@/components/PhotoGrid/VirtualScrollingTest';
import { PhotoMetadata } from '@/types';

// Generate test photos for virtual scrolling
const generateTestPhotos = (count: number): PhotoMetadata[] => {
  const photos: PhotoMetadata[] = [];
  const extensions = ['jpg', 'png', 'gif', 'mp4', 'mov', 'mp3', 'wav'];
  const types = ['image', 'video', 'audio'];
  
  for (let i = 0; i < count; i++) {
    const ext = extensions[i % extensions.length];
    const type = types[Math.floor(i / (count / types.length)) % types.length];
    
    photos.push({
      id: `test-photo-${i}`,
      name: `Test Photo ${i + 1}`,
      ext,
      size: Math.floor(Math.random() * 10000000) + 1000000,
      mtime: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      type,
      width: Math.floor(Math.random() * 2000) + 500,
      height: Math.floor(Math.random() * 2000) + 500,
      url: `/test-photos/${i}.${ext}`,
      folders: [],
      tags: [],
      exif: null,
      gps: null,
    });
  }
  
  return photos;
};

export const VirtualScrollingTestPage: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [photoCount, setPhotoCount] = useState(1000);

  useEffect(() => {
    const generatePhotos = () => {
      setIsLoading(true);
      console.log(`Generating ${photoCount} test photos...`);
      
      // Use setTimeout to avoid blocking the UI
      setTimeout(() => {
        const testPhotos = generateTestPhotos(photoCount);
        setPhotos(testPhotos);
        setIsLoading(false);
        console.log(`Generated ${testPhotos.length} test photos`);
      }, 100);
    };

    generatePhotos();
  }, [photoCount]);

  const handlePhotoCountChange = (count: number) => {
    setPhotoCount(count);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Generating test photos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Virtual Scrolling Performance Test
          </h1>
          
          {/* Photo Count Controls */}
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Number of Photos:
            </label>
            <div className="flex gap-2">
              {[100, 500, 1000, 5000, 10000, 50000].map(count => (
                <button
                  key={count}
                  onClick={() => handlePhotoCountChange(count)}
                  className={`px-3 py-1 rounded text-sm ${
                    photoCount === count 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {count.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Testing virtual scrolling with {photos.length.toLocaleString()} photos
          </div>
        </div>

        {/* Virtual Scrolling Test Component */}
        <VirtualScrollingTest photos={photos} isMobile={false} />
      </div>
    </div>
  );
};