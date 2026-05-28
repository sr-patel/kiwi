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
    <div className="flex items-start gap-1.5 text-xs leading-snug text-gray-300">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/60" />
      <div className="min-w-0 flex-1">
        {label && <span className="font-medium text-white/90">{label}: </span>}
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

  const renderTagPill = (tag: string) => {
    const tagCount = tagCounts[tag] || 0;
    return (
      <button
        key={tag}
        type="button"
        onClick={() => onTagClick(tag)}
        className="max-w-full truncate rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] leading-tight transition-colors hover:bg-white/30 cursor-pointer"
        title={`View all ${tagCount} files with tag: ${tag}`}
      >
        <span className="truncate">{tag}</span>
        {tagCount > 0 && <span className="ml-0.5 text-gray-400">({tagCount})</span>}
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
        <ChevronUp className="h-3.5 w-3.5" />
      </button>

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
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-3 py-1.5">
            <h3 className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug">
              {photo.name}
            </h3>
            <button
              type="button"
              onClick={() => onVisibleChange(false)}
              className="shrink-0 rounded-md p-0.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title="Hide info (I)"
              aria-label="Hide photo info"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 overflow-y-auto px-3 py-2">
            <InfoRow icon={FileText}>{fileInfoLine}</InfoRow>

            {photo.folders?.length > 0 && (
              <div className="flex items-start gap-1.5">
                <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/60" />
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {getFolderNames(folderTree, photo.folders).map((folderName, index) => {
                    const folderId = photo.folders[index];
                    return (
                      <button
                        key={folderId}
                        type="button"
                        onClick={() => onFolderClick(folderId)}
                        className={`rounded-full px-1.5 py-0.5 text-[11px] leading-tight text-white transition-colors cursor-pointer ${getAccentColor(accentColor)} hover:${getAccentHover(accentColor)}`}
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
              <div className="flex items-start gap-1.5">
                <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/60" />
                <div className="min-w-0 flex-1">
                  <div
                    className={`flex flex-wrap gap-1 transition-all duration-200 ease-out ${
                      tagsExpanded ? 'max-h-40 overflow-y-auto' : ''
                    }`}
                  >
                    <span className="self-center text-[11px] font-medium text-white/90">
                      Tags ({tags.length})
                    </span>
                    {visibleTags.map(renderTagPill)}

                    {!tagsExpanded && hiddenTagCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setTagsExpanded(true)}
                        className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] transition-colors hover:bg-white/20"
                        title={`Show ${hiddenTagCount} more tags`}
                      >
                        +{hiddenTagCount}
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>
                    )}

                    {tagsExpanded && hiddenTagCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setTagsExpanded(false)}
                        className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] text-gray-400 transition-colors hover:bg-white/20 hover:text-white"
                      >
                        less
                        <ChevronUp className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
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
              <div className="text-xs leading-snug text-gray-300">
                <div className="mb-0.5 font-medium text-white/90">EXIF</div>
                <div className="space-y-0.5 pl-5">
                  {Object.entries(JSON.parse(photo.exif_data)).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
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
