import React, { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/store';
import { FolderTree } from '@/components/FolderTree/FolderTree';
import { X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { IconButton } from '@/components/ui/IconButton';

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
      className="fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-border bg-card shadow-[1px_0_0_0_color-mix(in_oklab,var(--border)_60%,transparent)]"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b border-border/70 px-3 transition-[height] duration-300 ease-out-soft ${
          isMiniPlayer ? 'h-24' : 'h-16'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">Library</h2>
        </div>
        <IconButton label="Close navigation" size="sm" onClick={() => setSidebarOpen(false)}>
          <X className="size-4" />
        </IconButton>
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
          <div className="flex h-32 items-center justify-center px-4 text-muted-foreground">
            <div className="space-y-2 text-center">
              <div className="mx-auto size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
              <p className="text-sm">Loading your library…</p>
              <p className="text-xs text-muted-foreground/70">
                Large libraries can take a moment on first open
              </p>
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
          className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-primary opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 active:opacity-100"
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
