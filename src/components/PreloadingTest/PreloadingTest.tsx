import React, { useState, useEffect } from 'react';
import { PhotoMetadata } from '@/types';
import { imagePreloadingService } from '@/services/imagePreloadingService';
import { useSimplePreloading } from '@/hooks/useSimplePreloading';
import { testPreloading, testThumbnailEndpoint } from '@/utils/testPreloading';

// Generate test photos
const generateTestPhotos = (count: number): PhotoMetadata[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-${i}`,
    name: `test-photo-${i}.jpg`,
    ext: 'jpg',
    size: Math.floor(Math.random() * 5000000) + 1000000, // 1-5MB
    width: 1920,
    height: 1080,
    mtime: Date.now() - Math.random() * 10000000000,
    date_time: new Date().toISOString(),
    type: 'image',
    tags: [],
    folders: [],
  }));
};

export const PreloadingTest: React.FC = () => {
  const [testPhotos] = useState(() => generateTestPhotos(100));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState(imagePreloadingService.getStats());

  const preloading = useSimplePreloading(testPhotos, currentIndex);

  // Update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(imagePreloadingService.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleIndexChange = (newIndex: number) => {
    setCurrentIndex(Math.max(0, Math.min(testPhotos.length - 1, newIndex)));
  };

  const handleClearCache = () => {
    imagePreloadingService.clearPreloadedImages();
    setStats(imagePreloadingService.getStats());
  };

  const handleTestPreloading = () => {
    console.log('🧪 Testing preloading for current photo...');
    const currentPhoto = testPhotos[currentIndex];
    if (currentPhoto) {
      console.log('📸 Current photo:', currentPhoto);
      console.log('🔍 Is preloaded?', imagePreloadingService.isPreloaded(currentPhoto.id));
      console.log('🖼️ Preloaded image:', imagePreloadingService.getPreloadedImage(currentPhoto.id));
      console.log('🔗 Preloaded URL:', imagePreloadingService.getPreloadedImageUrl(currentPhoto.id));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Preloading Test</h1>
      
      {/* Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Current Index:</label>
          <input
            type="number"
            value={currentIndex}
            onChange={(e) => handleIndexChange(parseInt(e.target.value) || 0)}
            className="border border-gray-300 rounded px-2 py-1 w-20"
            min="0"
            max={testPhotos.length - 1}
          />
          <span className="text-sm text-gray-600">
            of {testPhotos.length - 1}
          </span>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleIndexChange(currentIndex - 10)}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            -10
          </button>
          <button
            onClick={() => handleIndexChange(currentIndex - 1)}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            -1
          </button>
          <button
            onClick={() => handleIndexChange(currentIndex + 1)}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            +1
          </button>
          <button
            onClick={() => handleIndexChange(currentIndex + 10)}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            +10
          </button>
          <button
            onClick={handleClearCache}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
          >
            Clear Cache
          </button>
          <button
            onClick={() => testPreloading()}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm"
          >
            Test Preloading
          </button>
          <button
            onClick={handleTestPreloading}
            className="px-3 py-1 bg-purple-500 text-white rounded text-sm"
          >
            Debug Current
          </button>
          <button
            onClick={() => testThumbnailEndpoint('LZW92N3NHKYFZ', '0a593caee41d9fccfaf9ddfec4d2a1a0')}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            Test Thumbnail
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-100 p-3 rounded">
          <div className="text-sm text-gray-600">Preloaded</div>
          <div className="text-xl font-bold text-green-600">{stats.totalPreloaded}</div>
        </div>
        <div className="bg-gray-100 p-3 rounded">
          <div className="text-sm text-gray-600">Queue</div>
          <div className="text-xl font-bold text-blue-600">{stats.queueSize}</div>
        </div>
        <div className="bg-gray-100 p-3 rounded">
          <div className="text-sm text-gray-600">Failed</div>
          <div className="text-xl font-bold text-red-600">{stats.totalFailed}</div>
        </div>
        <div className="bg-gray-100 p-3 rounded">
          <div className="text-sm text-gray-600">Active</div>
          <div className="text-xl font-bold text-purple-600">{stats.currentlyPreloading}</div>
        </div>
      </div>

      {/* Current Photo Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <h3 className="font-medium mb-2">Current Photo</h3>
        <div className="text-sm space-y-1">
          <div>ID: {testPhotos[currentIndex]?.id}</div>
          <div>Name: {testPhotos[currentIndex]?.name}</div>
          <div>Preloaded: {preloading.isImagePreloaded(testPhotos[currentIndex]?.id) ? 'Yes' : 'No'}</div>
          <div>Preloading: {preloading.isPreloading ? 'Yes' : 'No'}</div>
        </div>
      </div>

      {/* Photo List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {testPhotos.slice(Math.max(0, currentIndex - 5), currentIndex + 6).map((photo, index) => {
          const actualIndex = Math.max(0, currentIndex - 5) + index;
          const isCurrent = actualIndex === currentIndex;
          const isPreloaded = preloading.isImagePreloaded(photo.id);
          
          return (
            <div
              key={photo.id}
              className={`p-2 rounded border ${
                isCurrent 
                  ? 'bg-blue-100 border-blue-300' 
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{actualIndex}</span>
                  <span className="text-sm">{photo.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isPreloaded && <span className="text-green-600 text-xs">⚡ Preloaded</span>}
                  {isCurrent && <span className="text-blue-600 text-xs">📍 Current</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};