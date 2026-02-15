import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import { FolderTree } from '@/components/FolderTree/FolderTree';
import { getAccentColor } from '@/utils/accentColors';

export const Sidebar = () => {
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    folderTree,
    currentFolder,
    setCurrentFolder,
    currentTag,
    setCurrentTag,
    isMobile,
    accentColor,
    isMiniPlayer,
  } = useAppStore();

  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const handleFolderSelect = (folderId: string | null) => {
    setCurrentFolder(folderId);
    setCurrentTag(null);
    if (isMobile) setSidebarOpen(false);
  };

  const handleTagSelect = (tag: string | null) => {
    setCurrentTag(tag);
    setCurrentFolder(null);
    if (isMobile) setSidebarOpen(false);
  };

  // Resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  if (!sidebarOpen) return null;

  return (
    <div
      className="fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between border-b border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out px-4 ${
        isMiniPlayer ? 'h-24' : 'py-4'
      }`}>
        <div className="flex items-center gap-2">
          <img src="/kiwi.png" alt="Kiwi" className="w-8 h-8" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kiwi</h2>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {folderTree ? (
          <FolderTree
            folders={folderTree}
            currentFolderId={currentFolder}
            currentTag={currentTag}
            onFolderSelect={handleFolderSelect}
            onTagSelect={handleTagSelect}
          />
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${getAccentColor(accentColor)} mx-auto mb-2`}></div>
              <p className="text-sm">Loading folders...</p>
            </div>
          </div>
        )}
      </div>

      {/* Resize Handle */}
      {!isMobile && (
        <div
          ref={resizeRef}
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors ${getAccentColor(accentColor)} opacity-0 hover:opacity-100 active:opacity-100`}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
};
