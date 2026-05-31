import React, { useState } from 'react';
import {
  Camera,
  MapPin,
  Calendar,
  FileText,
  Tag,
  BookOpen,
  Folder,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { libraryService } from '@/services/libraryService';
import { getAccentColor, getAccentHover } from '@/utils/accentColors';
import { shouldUseFileCard, getFileTypeInfo } from '@/utils/fileTypes';
import { renderClickableUrl, linkifyText } from '@/utils/linkify';
import { FolderNode } from '@/types';

const COLLAPSED_TAG_COUNT = 8;

function isExternalUrl(value: string | undefined | null) {
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return true;
  if (value.startsWith('/api/')) return false;
  return false;
}

function getFolderNames(folderTree: FolderNode[] | null, folderIds: string[]): string[] {
  if (!folderTree || !folderIds.length) return [];

  const findFolderName = (folders: FolderNode[], folderId: string): string | null => {
    for (const folder of folders) {
      if (folder.id === folderId) return folder.name;
      if (folder.children?.length) {
        const found = findFolderName(folder.children, folderId);
        if (found) return found;
      }
    }
    return null;
  };

  return folderIds
    .map((id) => findFolderName(folderTree, id))
    .filter((name): name is string => name !== null);
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm leading-snug text-gray-300">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
      <div className="min-w-0 flex-1">
        {label && <span className="font-medium text-white">{label}: </span>}
        {children}
      </div>
    </div>
  );
}

interface PhotoInfoBoxProps {
  photo: Record<string, any>;
  infoBoxSize: number;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  tagCounts: Record<string, number>;
  accentColor: string;
  folderTree: FolderNode[] | null;
  onFolderClick: (folderId: string) => void;
  onTagClick: (tag: string) => void;
}

export const PhotoInfoBox: React.FC<PhotoInfoBoxProps> = ({
  photo,
  infoBoxSize,
  visible,
  onVisibleChange,
  tagCounts,
  accentColor,
  folderTree,
  onFolderClick,
  onTagClick,
}) => {
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const tags: string[] = photo.tags ?? [];
  const hiddenTagCount = Math.max(0, tags.length - COLLAPSED_TAG_COUNT);
  const visibleTags = tagsExpanded ? tags : tags.slice(0, COLLAPSED_TAG_COUNT);

  // Narrow fixed width scaled by user preference — avoids a wide shallow strip on large screens.
  const panelWidthPx = Math.round(360 * (infoBoxSize / 100));

  const renderTagPill = (tag: string) => {
    const tagCount = tagCounts[tag] || 0;
    return (
      <button
        key={tag}
        type="button"
        onClick={() => onTagClick(tag)}
        className="max-w-full truncate rounded-full bg-white/20 px-2 py-1 text-sm transition-colors hover:bg-white/30 cursor-pointer"
        title={`View all ${tagCount} files with tag: ${tag}`}
      >
        <span className="truncate">{tag}</span>
        {tagCount > 0 && <span className="ml-1 text-gray-300">({tagCount})</span>}
      </button>
    );
  };

  const fileInfoLine = shouldUseFileCard(photo.ext) ? (
    <>
      {getFileTypeInfo(photo.ext).displayName} • {libraryService.formatFileSize(photo.size)} •{' '}
      {photo.ext.toUpperCase()}
      {getFileTypeInfo(photo.ext).category === 'video' && photo.duration && (
        <> • {Math.round(photo.duration)}s</>
      )}
    </>
  ) : (
    <>
      {photo.width}×{photo.height} • {libraryService.formatFileSize(photo.size)} •{' '}
      {photo.ext.toUpperCase()}
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onVisibleChange(true);
        }}
        className={`absolute bottom-4 left-4 z-10 flex items-center justify-center rounded-md bg-black/25 p-1.5 text-white/70 backdrop-blur-sm transition-all duration-300 ease-out hover:bg-black/40 hover:text-white ${
          visible
            ? 'pointer-events-none scale-75 opacity-0'
            : 'pointer-events-auto scale-100 opacity-100'
        }`}
        title="Show info (I)"
        aria-label="Show photo info"
        aria-hidden={visible}
        tabIndex={visible ? -1 : 0}
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      <div
        className={`absolute bottom-4 left-4 z-10 flex max-h-[70vh] flex-col origin-bottom-left overflow-hidden transition-[opacity,transform] duration-300 ease-out ${
          visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          width: `min(${panelWidthPx}px, 42vh, calc(100vw - 2rem))`,
          transform: visible ? undefined : 'translateY(12px)',
          transformOrigin: 'bottom left',
        }}
        aria-hidden={!visible}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 max-h-[70vh] w-full flex-1 flex-col rounded-lg bg-black/30 text-white backdrop-blur-lg">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
            <h3 className="min-w-0 flex-1 break-words text-base font-semibold leading-snug">
              {photo.name}
            </h3>
            <button
              type="button"
              onClick={() => onVisibleChange(false)}
              className="shrink-0 rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title="Hide info (I)"
              aria-label="Hide photo info"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div data-info-box-scroll className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2.5">
            <InfoRow icon={FileText}>{fileInfoLine}</InfoRow>

            {photo.folders?.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-white">
                  <Folder className="h-4 w-4 shrink-0 text-white/70" />
                  Folders
                </div>
                <div className="flex flex-wrap gap-1 pl-6">
                  {getFolderNames(folderTree, photo.folders).map((folderName, index) => {
                    const folderId = photo.folders[index];
                    return (
                      <button
                        key={folderId}
                        type="button"
                        onClick={() => onFolderClick(folderId)}
                        className={`rounded-full px-2 py-1 text-sm text-white transition-colors cursor-pointer ${getAccentColor(accentColor)} hover:${getAccentHover(accentColor)}`}
                        title={`Go to ${folderName}`}
                      >
                        {folderName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tags.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-white">
                  <Tag className="h-4 w-4 shrink-0 text-white/70" />
                  Tags ({tags.length})
                </div>
                <div
                  className={`flex flex-wrap gap-1 pl-6 transition-all duration-200 ease-out ${
                    tagsExpanded ? 'max-h-48 overflow-y-auto' : ''
                  }`}
                >
                  {visibleTags.map(renderTagPill)}

                  {!tagsExpanded && hiddenTagCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setTagsExpanded(true)}
                      className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-2 py-1 text-sm transition-colors hover:bg-white/20"
                      title={`Show ${hiddenTagCount} more tags`}
                    >
                      +{hiddenTagCount}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {tagsExpanded && hiddenTagCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setTagsExpanded(false)}
                      className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-2 py-1 text-sm text-gray-400 transition-colors hover:bg-white/20 hover:text-white"
                    >
                      less
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {!shouldUseFileCard(photo.ext) && photo.camera && (
              <InfoRow icon={Camera} label="Camera">
                {photo.camera}
              </InfoRow>
            )}

            {photo.dateTime && (
              <InfoRow icon={Calendar} label="Taken">
                {new Date(photo.dateTime).toLocaleString()}
              </InfoRow>
            )}

            {photo.btime && (
              <InfoRow icon={Calendar} label="Imported">
                {new Date(photo.btime).toLocaleString()}
              </InfoRow>
            )}

            {isExternalUrl(photo.url) && (
              <InfoRow icon={BookOpen} label="URL">
                {renderClickableUrl(photo.url, undefined, 'text-blue-400 hover:text-blue-300 underline break-all')}
              </InfoRow>
            )}

            {photo.annotation && (
              <InfoRow icon={FileText} label="Notes">
                {linkifyText(photo.annotation, 'text-blue-400 hover:text-blue-300 underline break-words')}
              </InfoRow>
            )}

            {!shouldUseFileCard(photo.ext) && photo.gps_latitude && photo.gps_longitude && (
              <InfoRow icon={MapPin}>
                {photo.gps_latitude.toFixed(6)}, {photo.gps_longitude.toFixed(6)}
                {photo.gps_altitude && <span> ({photo.gps_altitude}m)</span>}
              </InfoRow>
            )}

            {!shouldUseFileCard(photo.ext) && photo.exif_data && (
              <div className="text-sm leading-snug text-gray-300">
                <div className="mb-1 font-medium text-white">EXIF</div>
                <div className="space-y-1 pl-6">
                  {Object.entries(JSON.parse(photo.exif_data)).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <span className="shrink-0 text-gray-400">{key}:</span>
                      <span className="break-words">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PhotoInfoBox;
