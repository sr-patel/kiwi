import React from 'react';
import { useFolderThumbnail } from '@/hooks/useFolderThumbnail';
import { libraryService } from '@/services/libraryService';
import { FolderNode } from '@/types';

interface FolderCardProps {
  subfolder: FolderNode;
  useFolderThumbnails: boolean;
  getTotalPhotoCount: (folder: FolderNode) => number;
  onClick: () => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  subfolder,
  useFolderThumbnails,
  getTotalPhotoCount,
  onClick
}) => {
  const { thumbnail } = useFolderThumbnail(subfolder.id, useFolderThumbnails);

  return (
    <button
      onClick={onClick}
      className="group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all duration-200 text-left flex flex-col h-full"
    >
      {/* Thumbnail area - takes most of the space */}
      <div className="flex-1 relative mb-3 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors min-h-[120px]">
        {thumbnail ? (
          <img 
            src={libraryService.getPhotoThumbnailUrl(thumbnail.id, thumbnail.name)} 
            alt={thumbnail.name} 
            className="w-full h-full object-contain" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Text area - compact at bottom */}
      <div className="text-center flex-shrink-0">
        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
          {subfolder.name}
        </h4>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {getTotalPhotoCount(subfolder)} files
        </div>
      </div>
    </button>
  );
};