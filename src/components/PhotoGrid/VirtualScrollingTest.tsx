import React, { useState, useMemo } from 'react';
import { ReactWindowPhotoGrid } from './ReactWindowPhotoGrid';
import { useVirtualScrollingDecision } from '@/hooks/useVirtualScrollingDecision';
import { PhotoMetadata } from '@/types';

interface VirtualScrollingTestProps {
  photos: PhotoMetadata[];
  isMobile?: boolean;
}

// Test component to validate virtual scrolling performance
export const VirtualScrollingTest: React.FC<VirtualScrollingTestProps> = ({ 
  photos, 
  isMobile = false 
}) => {
  const [currentView, setCurrentView] = useState({
    type: 'grid' as 'grid' | 'list',
    thumbnailSize: 'medium' as 'small' | 'medium' | 'large',
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [forceVirtualScrolling, setForceVirtualScrolling] = useState(false);

  // Determine if we should use virtual scrolling
  const virtualScrollingDecision = useVirtualScrollingDecision({
    itemCount: photos.length,
    isMobile,
    currentView,
    forceVirtualScrolling,
  });

  const handleSelect = (photoId: string) => {
    setSelectedItems(prev => 
      prev.includes(photoId) 
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  };

  const handleDoubleClick = (photo: PhotoMetadata) => {
    console.log('Double clicked photo:', photo.name);
  };

  const handleViewChange = (type: 'grid' | 'list') => {
    setCurrentView(prev => ({ ...prev, type }));
  };

  const handleSizeChange = (size: 'small' | 'medium' | 'large') => {
    setCurrentView(prev => ({ ...prev, thumbnailSize: size }));
  };

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    const startTime = performance.now();
    const endTime = performance.now();
    return {
      renderTime: endTime - startTime,
      itemCount: photos.length,
      shouldUseVirtualScrolling: virtualScrollingDecision.shouldUseVirtualScrolling,
      threshold: virtualScrollingDecision.threshold,
    };
  }, [photos.length, virtualScrollingDecision]);

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Virtual Scrolling Test</h2>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => handleViewChange('grid')}
              className={`px-3 py-1 rounded ${currentView.type === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Grid
            </button>
            <button
              onClick={() => handleViewChange('list')}
              className={`px-3 py-1 rounded ${currentView.type === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              List
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleSizeChange('small')}
              className={`px-3 py-1 rounded ${currentView.thumbnailSize === 'small' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Small
            </button>
            <button
              onClick={() => handleSizeChange('medium')}
              className={`px-3 py-1 rounded ${currentView.thumbnailSize === 'medium' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Medium
            </button>
            <button
              onClick={() => handleSizeChange('large')}
              className={`px-3 py-1 rounded ${currentView.thumbnailSize === 'large' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Large
            </button>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={forceVirtualScrolling}
              onChange={(e) => setForceVirtualScrolling(e.target.checked)}
            />
            Force Virtual Scrolling
          </label>
        </div>

        {/* Performance Info */}
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-4">
          <h3 className="font-semibold mb-2">Performance Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Item Count:</strong> {performanceMetrics.itemCount.toLocaleString()}
            </div>
            <div>
              <strong>Using Virtual Scrolling:</strong> {performanceMetrics.shouldUseVirtualScrolling ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Threshold:</strong> {performanceMetrics.threshold.toLocaleString()}
            </div>
            <div>
              <strong>Reason:</strong> {virtualScrollingDecision.reason}
            </div>
          </div>
        </div>

        {/* Selected Items */}
        {selectedItems.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
            <strong>Selected Items:</strong> {selectedItems.length} items selected
          </div>
        )}
      </div>

      {/* Virtual Scrolling Grid */}
      <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
        <ReactWindowPhotoGrid
          photos={photos}
          isMobile={isMobile}
          currentView={currentView}
          selectedItems={selectedItems}
          onSelect={handleSelect}
          onDoubleClick={handleDoubleClick}
          isFetchingNextPage={false}
          accentColor="bg-blue-500"
          hasNextPage={false}
        />
      </div>
    </div>
  );
};