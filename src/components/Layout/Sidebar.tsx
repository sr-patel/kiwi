import React, { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/store';
import { FolderTree } from '@/components/FolderTree/FolderTree';
import { getAccentColor } from '@/utils/accentColors';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 600;

const clampWidth = (value: number): number => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));

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
  } = useAppStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
      sidebarWidth: state.sidebarWidth,
      setSidebarWidth: state.setSidebarWidth,
      folderTree: state.folderTree,
      currentFolder: state.currentFolder,
      setCurrentFolder: state.setCurrentFolder,
      currentTag: state.currentTag,
      setCurrentTag: state.setCurrentTag,
      isMobile: state.isMobile,
      accentColor: state.accentColor,
      isMiniPlayer: state.isMiniPlayer,
    })),
  );

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

  // Resize functionality. Width updates are throttled to one per animation
  // frame: this used to write to the store on every mousemove event.
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    let frame = 0;
    let pendingWidth = sidebarWidth;

    const flush = () => {
      frame = 0;
      setSidebarWidth(pendingWidth);
    };

    const handleMouseMove = (e: MouseEvent) => {
      pendingWidth = clampWidth(e.clientX);
      if (frame) return;
      frame = requestAnimationFrame(flush);
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (frame) cancelAnimationFrame(frame);
      setSidebarWidth(pendingWidth);
    };
  }, [isResizing, setSidebarWidth, sidebarWidth]);

  if (!sidebarOpen) return null;

  return (
    <div
      className="fixed inset-y-0 left-0 z-50 flex h-full flex-col bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out px-4 ${
          isMiniPlayer ? 'h-24' : 'py-4'
        }`}
      >
        <div className="flex items-center gap-2">
          <img src="/kiwi.png" alt="Kiwi" className="w-8 h-8" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kiwi</h2>
        </div>
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Folder Tree */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden p-2">
        {folderTree ? (
          <FolderTree
            folders={folderTree}
            currentFolderId={currentFolder}
            currentTag={currentTag}
            onFolderSelect={handleFolderSelect}
            onTagSelect={handleTagSelect}
          />
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400 px-4">
            <div className="text-center space-y-2">
              <div
                className={`animate-spin rounded-full h-8 w-8 border-b-2 ${getAccentColor(accentColor)} mx-auto`}
              />
              <p className="text-sm">Loading your library…</p>
              <p className="text-xs text-gray-400">Large libraries can take a moment on first open</p>
            </div>
          </div>
        )}
      </div>

      {/* Resize Handle */}
      {!isMobile && (
        <div
          ref={resizeRef}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize navigation"
          aria-valuenow={sidebarWidth}
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          tabIndex={0}
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors ${getAccentColor(accentColor)} opacity-0 hover:opacity-100 focus-visible:opacity-100 active:opacity-100`}
          onMouseDown={handleMouseDown}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setSidebarWidth(clampWidth(sidebarWidth - 16));
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              setSidebarWidth(clampWidth(sidebarWidth + 16));
            }
          }}
        />
      )}
    </div>
  );
};
