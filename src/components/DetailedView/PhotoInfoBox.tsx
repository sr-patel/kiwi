import React, { useEffect, useState } from 'react';
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
import { libraryService } from '@/services/libraryService';
import { getAccentColor, getAccentHover } from '@/utils/accentColors';
import { shouldUseFileCard, getFileTypeInfo } from '@/utils/fileTypes';
import { renderClickableUrl, linkifyText } from '@/utils/linkify';
import { FolderNode } from '@/types';

const COLLAPSED_TAG_COUNT = 4;

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

  useEffect(() => {
    setTagsExpanded(false);
  }, [photo.id]);

  const tags: string[] = photo.tags ?? [];
  const hiddenTagCount = Math.max(0, tags.length - COLLAPSED_TAG_COUNT);
  const visibleTags = tagsExpanded ? tags : tags.slice(0, COLLAPSED_TAG_COUNT);

  const renderTagPill = (tag: string) => {
    const tagCount = tagCounts[tag] || 0;
    return (
      <button
        key={tag}
        type="button"
        onClick={() => onTagClick(tag)}
        className="max-w-full truncate px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded-full transition-colors cursor-pointer"
        title={`View all ${tagCount} files with tag: ${tag}`}
      >
        <span className="truncate">{tag}</span>
        {tagCount > 0 && <span className="ml-1 text-gray-300">({tagCount})</span>}
      </button>
    );
  };

  return (
    <>
      {/* Subtle reveal control when hidden */}
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
        <ChevronUp className="h-3.5 w-3.5" />
      </button>

      {/* Info panel */}
      <div
        className={`absolute bottom-4 left-4 z-10 max-h-[70vh] origin-bottom-left overflow-hidden transition-[opacity,transform] duration-300 ease-out ${
          visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          maxWidth: `${Math.min(infoBoxSize * 0.25, 35)}%`,
          transform: visible
            ? `scale(${infoBoxSize / 100})`
            : `scale(${(infoBoxSize / 100) * 0.97}) translateY(12px)`,
          transformOrigin: 'bottom left',
        }}
        aria-hidden={!visible}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex max-h-[70vh] flex-col rounded-lg bg-black/30 text-white backdrop-blur-lg">
          {/* Header with hide control */}
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
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

          <div className="space-y-3 overflow-y-auto px-4 py-3">
            {/* File Info */}
            <div className="text-sm text-gray-300">
              <div className="mb-1 flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="font-medium text-white">File Info</span>
              </div>
              <div className="break-words pl-6">
                {shouldUseFileCard(photo.ext) ? (
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
                )}
              </div>
            </div>

            {/* Folders */}
            {photo.folders?.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Folder className="h-4 w-4" />
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
                        className={`px-2 py-1 text-xs ${getAccentColor(accentColor)} hover:${getAccentHover(accentColor)} rounded-full text-white transition-colors cursor-pointer`}
                        title={`Go to ${folderName}`}
                      >
                        {folderName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tags — collapsed by default for large lists */}
            {tags.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4" />
                  Tags
                  <span className="text-xs font-normal text-gray-400">({tags.length})</span>
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
                      className="inline-flex items-center gap-0.5 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                      title={`Show ${hiddenTagCount} more tags`}
                    >
                      +{hiddenTagCount}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  )}

                  {tagsExpanded && hiddenTagCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setTagsExpanded(false)}
                      className="inline-flex w-full items-center gap-1 px-1 py-1 text-xs text-gray-400 transition-colors hover:text-white"
                    >
                      Show less
                      <ChevronUp className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {!shouldUseFileCard(photo.ext) && photo.camera && (
              <div className="text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Camera className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Camera</span>
                </div>
                <div className="break-words pl-6">{photo.camera}</div>
              </div>
            )}

            {photo.dateTime && (
              <div className="text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Date/Time</span>
                </div>
                <div className="break-words pl-6">{new Date(photo.dateTime).toLocaleString()}</div>
              </div>
            )}

            {photo.btime && (
              <div className="text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Date Imported</span>
                </div>
                <div className="break-words pl-6">{new Date(photo.btime).toLocaleString()}</div>
              </div>
            )}

            {isExternalUrl(photo.url) && (
              <div className="text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span className="font-medium">URL</span>
                </div>
                <div className="break-all pl-6">
                  {renderClickableUrl(photo.url, undefined, 'text-blue-400 hover:text-blue-300 underline break-all')}
                </div>
              </div>
            )}

            {photo.annotation && (
              <div className="text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Notes</span>
                </div>
                <div className="break-words pl-6">
                  {linkifyText(photo.annotation, 'text-blue-400 hover:text-blue-300 underline break-words')}
                </div>
              </div>
            )}

            {!shouldUseFileCard(photo.ext) && photo.gps_latitude && photo.gps_longitude && (
              <div className="text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="font-medium">GPS Location</span>
                </div>
                <div className="break-words pl-6">
                  {photo.gps_latitude.toFixed(6)}, {photo.gps_longitude.toFixed(6)}
                  {photo.gps_altitude && <span> ({photo.gps_altitude}m)</span>}
                </div>
              </div>
            )}

            {!shouldUseFileCard(photo.ext) && photo.exif_data && (
              <div className="text-sm">
                <div className="mb-1 font-medium">EXIF Data</div>
                <div className="space-y-1 pl-6 text-gray-300">
                  {Object.entries(JSON.parse(photo.exif_data)).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1 sm:flex-row sm:justify-between">
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
