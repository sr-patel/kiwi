import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Image, Video, Music, FileText, LayoutDashboard } from 'lucide-react';
import { FolderNode } from '@/types';
import { useAppStore } from '@/store';
import { getAccentText, getAccentSelected, getAccentHover, getAccentBorder } from '@/utils/accentColors';
import { useRecursiveFolderCounts, useTotalPhotoCount } from '@/hooks/useInfinitePhotos';
import { useTags } from '@/hooks/useTags';
import { useTagCounts } from '@/hooks/useTagCounts';
import { generateFolderUrl } from '@/utils/folderUrls';
import { generateTagUrl } from '@/utils/tagUrls';

interface FolderTreeProps {
  folders: FolderNode[];
  currentFolderId: string | null;
  currentTag: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onTagSelect: (tag: string | null) => void;
}

interface FolderItemProps {
  folder: FolderNode;
  level: number;
  currentFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  folderCounts: { [folderId: string]: number };
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, level, currentFolderId, onFolderSelect, folderCounts }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { accentColor, folderTree } = useAppStore();
  const navigate = useNavigate();
  const isSelected = currentFolderId === folder.id;
  const hasChildren = folder.children.length > 0;
  const photoCount = folderCounts[folder.id] || 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSelect = () => {
    console.log('FolderTree: Folder clicked:', folder.name, folder.id);
    if (folderTree) {
      const folderUrl = generateFolderUrl(folder, folderTree);
      navigate(folderUrl);
    }
    onFolderSelect(folder.id);
  };

  const getFolderIcon = () => {
    if (folder.icon) {
      switch (folder.icon) {
        case 'book':
          return <FileText className="w-4 h-4" />;
        case 'video':
          return <Video className="w-4 h-4" />;
        case 'music':
          return <Music className="w-4 h-4" />;
        default:
          return <Image className="w-4 h-4" />;
      }
    }
    return isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />;
  };

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 px-3 py-2 text-sm cursor-pointer rounded-md transition-colors
          ${isSelected 
            ? `${getAccentSelected(accentColor)} border ${getAccentBorder(accentColor)}` 
            : `hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-200`
          }
        `}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={handleSelect}
      >
        {hasChildren && (
          <button
            onClick={handleToggle}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-5" />}
        
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`
            ${isSelected 
              ? getAccentText(accentColor)
              : 'text-gray-500 dark:text-gray-400'
            }
          `}>
            {getFolderIcon()}
          </div>
          <span className="truncate font-medium">{folder.name}</span>
          {photoCount > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
              {photoCount}
            </span>
          )}
        </div>
      </div>
      
      {isExpanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              currentFolderId={currentFolderId}
              onFolderSelect={onFolderSelect}
              folderCounts={folderCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FolderTree: React.FC<FolderTreeProps> = ({ folders, currentFolderId, currentTag, onFolderSelect, onTagSelect }) => {
  const { accentColor, setCurrentFolder, setCurrentTag, defaultLandingPage } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isAllFiles = location.pathname === '/all' || (location.pathname === '/' && defaultLandingPage !== 'dashboard') || (currentFolderId === null && !currentTag && !isDashboard);

  const { data: folderCounts = {}, isLoading: isLoadingCounts } = useRecursiveFolderCounts();
  const { data: totalPhotoCount = 0, isLoading: isLoadingTotalCount } = useTotalPhotoCount();
  const { data: tags = [], isLoading: isLoadingTags } = useTags();
  const { data: tagCounts = {}, isLoading: isLoadingTagCounts } = useTagCounts();
  
  return (
    <div className="w-full">
      {/* Folders group */}
      <div className="mb-2">
        <div className="px-3 py-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Navigation</div>

        {/* Dashboard */}
        <div
          className={`
            flex items-center gap-2 px-3 py-2 text-sm cursor-pointer rounded-md transition-colors mb-1
            ${isDashboard
              ? `${getAccentSelected(accentColor)} border ${getAccentBorder(accentColor)}`
              : 'hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-200'
            }
          `}
          onClick={() => {
            console.log('FolderTree: Dashboard clicked');
            setCurrentFolder(null);
            setCurrentTag(null);
            navigate('/dashboard');
            onFolderSelect(null);
            onTagSelect(null);
          }}
        >
          <LayoutDashboard className={`w-4 h-4 ${
            isDashboard
              ? getAccentText(accentColor)
              : 'text-gray-500 dark:text-gray-400'
          }`} />
          <span className="font-medium">Dashboard</span>
        </div>

        {/* Root folder / All Files */}
        <div
          className={`
            flex items-center gap-2 px-3 py-2 text-sm cursor-pointer rounded-md transition-colors mb-4
            ${isAllFiles
              ? `${getAccentSelected(accentColor)} border ${getAccentBorder(accentColor)}`
              : 'hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-200'
            }
          `}
          onClick={() => { 
            console.log('FolderTree: All Files clicked');
            setCurrentFolder(null);
            setCurrentTag(null);
            navigate('/all');
            onFolderSelect(null); 
            onTagSelect(null); 
          }}
        >
          <Folder className={`w-4 h-4 ${
            isAllFiles
              ? getAccentText(accentColor)
              : 'text-gray-500 dark:text-gray-400'
          }`} />
          <span className="font-medium">All Files</span>
          {!isLoadingTotalCount && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
              {totalPhotoCount}
            </span>
          )}
        </div>

        <div className="px-3 py-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Folders</div>
        {/* Folder tree */}
        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            level={0}
            currentFolderId={currentFolderId}
            onFolderSelect={id => { 
              console.log('FolderTree: Folder selected:', id);
              onFolderSelect(id); 
            }}
            folderCounts={folderCounts}
          />
        ))}
      </div>
      {/* Tags group */}
      <div>
        <div className="px-3 py-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Tags</div>
        {isLoadingTags ? (
          <div className="px-3 py-2 text-sm text-gray-400">Loading...</div>
        ) : tags.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-400">No tags</div>
        ) : tags.map(tag => (
          <div
            key={tag}
            className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer rounded-md transition-colors
              ${currentTag === tag
                ? `${getAccentSelected(accentColor)} border ${getAccentBorder(accentColor)}`
                : 'hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-200'
              }
            `}
            onClick={(e) => { 
              e.stopPropagation();
              console.log('FolderTree: Tag clicked:', tag);
              setCurrentTag(tag);
              setCurrentFolder(null);
              const tagUrl = generateTagUrl(tag);
              navigate(tagUrl);
              onTagSelect(tag); 
            }}
          >
            <span className={`w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold ${currentTag === tag ? getAccentText(accentColor) : 'text-gray-500 dark:text-gray-400'}`}>#</span>
            <span className="truncate font-medium">{tag}</span>
            {!isLoadingTagCounts && tagCounts[tag] > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                {tagCounts[tag]}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};