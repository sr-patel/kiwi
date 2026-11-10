import React, { useCallback } from 'react';
import { Calendar, HardDrive, Play, BookOpen, FileText, Download, Headphones } from 'lucide-react';
import { PhotoMetadata } from '@/types';
import { libraryService } from '@/services/libraryService';
import { useAppStore } from '@/store';
import { getAccentColor, getAccentRing, getAccentHex } from '@/utils/accentColors';
import { getFileTypeInfo, type FileCategory } from '@/utils/fileTypes';

interface FileCardProps {
  file: PhotoMetadata;
  size: 'small' | 'medium' | 'large';
  onOpen: (file: PhotoMetadata) => void;
  isMobile?: boolean;
  index?: number;
  /** Roving tabindex: only the grid's active card is in the tab order. */
  tabIndex?: number;
}

/** Action affordance per category, resolved once instead of two switch chains. */
const ACTIONS: Record<FileCategory, { label: string; Icon: typeof Play }> = {
  audio: { label: 'Play', Icon: Play },
  ebook: { label: 'Read', Icon: BookOpen },
  document: { label: 'Open', Icon: FileText },
  video: { label: 'Play', Icon: Play },
  image: { label: 'Download', Icon: Download },
  other: { label: 'Download', Icon: Download },
};

const formatResumeTime = (time: number): string => {
  const minutes = Math.round(time / 60);
  if (minutes < 1) return 'Just started';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const sizeClasses = {
  small: 'w-32 h-40',
  large: 'w-64 h-80',
  medium: 'w-48 h-60',
} as const;

const iconClasses = {
  small: 'text-2xl',
  large: 'text-4xl',
  medium: 'text-3xl',
} as const;

const FileCardImpl: React.FC<FileCardProps> = ({
  file,
  size,
  onOpen,
  isMobile = false,
  index = 0,
  tabIndex = 0,
}) => {
  const accentColor = useAppStore((state) => state.accentColor);
  const podcastEnabled = useAppStore((state) => state.podcastMode.enabled);
  const savedTime = useAppStore((state) =>
    state.podcastMode.enabled ? (state.podcastMode.audioTimeTracking?.[file.id] ?? 0) : 0,
  );
  const openAudioPlayer = useAppStore((state) => state.openAudioPlayer);
  const saveScrollPosition = useAppStore((state) => state.saveScrollPosition);
  const setDetailedPhoto = useAppStore((state) => state.setDetailedPhoto);
  const detailedPhoto = useAppStore((state) => state.detailedPhoto);

  const fileTypeInfo = getFileTypeInfo(file.ext);
  const action = ACTIONS[fileTypeInfo.category] ?? ACTIONS.other;
  const isAudio = fileTypeInfo.category === 'audio';
  const hasSavedPosition = isAudio && podcastEnabled && savedTime > 0;
  const audioDuration = file.duration || 0;
  const progressPercentage = audioDuration > 0 ? (savedTime / audioDuration) * 100 : 0;
  const isActive = detailedPhoto === file.id;

  const accentHex = getAccentHex(accentColor);

  /**
   * Single activation path for pointer and keyboard. Previously the keydown
   * handler bypassed this logic, so keyboard users could not play audio or
   * download non-previewable files.
   */
  const activate = useCallback(() => {
    if (isAudio) {
      openAudioPlayer(file);
      return;
    }
    if (fileTypeInfo.canPreview) {
      saveScrollPosition(window.scrollY);
      setDetailedPhoto(file.id);
      return;
    }
    const link = document.createElement('a');
    link.href = libraryService.getPhotoFileUrl(file.id, file.ext, file.name);
    link.download = file.name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [file, fileTypeInfo.canPreview, isAudio, openAudioPlayer, saveScrollPosition, setDetailedPhoto]);

  const cardClasses = `relative group cursor-pointer overflow-hidden rounded-lg transition-shadow duration-200
      bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900
      border border-gray-200 dark:border-gray-700 w-full hover:shadow-md
      ${isMobile ? 'h-48' : sizeClasses[size]}
      ${isActive ? `${getAccentRing(accentColor)} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900` : ''}`;

  const ActionIcon = action.Icon;

  return (
    <div
      className={cardClasses}
      role="button"
      tabIndex={tabIndex}
      data-grid-index={index}
      aria-label={`${action.label} ${file.name}`}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      }}
    >
      <div className="relative z-10 flex h-full flex-col items-center justify-center p-4">
        {isAudio && podcastEnabled && (
          <div className="absolute left-2 right-2 top-2 space-y-1">
            {audioDuration > 0 && (
              <div className="h-1.5 w-full rounded-full bg-gray-600/30 dark:bg-gray-700/50">
                <div
                  className="h-1.5 rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min(progressPercentage, 100)}%`,
                    background: `linear-gradient(to right, ${accentHex}, ${accentHex}CC)`,
                  }}
                />
              </div>
            )}

            {hasSavedPosition && (
              <div className="flex items-center justify-center gap-1">
                <Headphones className="h-3 w-3" style={{ color: accentHex }} />
                <span className="text-xs font-medium" style={{ color: accentHex }}>
                  {progressPercentage > 0 ? `Resume from ${formatResumeTime(savedTime)}` : 'Just started'}
                </span>
              </div>
            )}
          </div>
        )}

        <div className={`${iconClasses[size]} mb-2 opacity-80`}>{fileTypeInfo.icon}</div>

        <h3 className="mb-1 line-clamp-3 px-1 text-center text-sm font-medium text-gray-800 dark:text-gray-200">
          {file.name}
        </h3>

        <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">{fileTypeInfo.displayName}</p>

        <span
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white ${getAccentColor(accentColor)}`}
        >
          <ActionIcon className="h-4 w-4" />
          {action.label}
        </span>
      </div>

      {/* Info overlay on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-200 ${
          isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
        }`}
      >
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-300">
            <HardDrive className="h-3 w-3" />
            <span>{libraryService.formatFileSize(file.size)}</span>
            <span aria-hidden>•</span>
            <Calendar className="h-3 w-3" />
            <span>{libraryService.formatDate(file.mtime)}</span>
          </div>

          {file.tags && file.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {file.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="rounded-full bg-black/50 px-2 py-1 text-xs text-white"
                >
                  {tag}
                </span>
              ))}
              {file.tags.length > 3 && (
                <span className="rounded-full bg-black/50 px-2 py-1 text-xs text-white">
                  +{file.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const FileCard = React.memo(FileCardImpl);
FileCard.displayName = 'FileCard';
