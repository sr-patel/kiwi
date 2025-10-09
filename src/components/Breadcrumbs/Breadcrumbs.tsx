import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useAppStore } from '@/store';
import { getFolderBreadcrumbs } from '@/utils/folderUrls';
import { getTagBreadcrumb } from '@/utils/tagUrls';
import { getAccentText, getAccentHex } from '@/utils/accentColors';

export const Breadcrumbs: React.FC = () => {
  const { currentFolder, currentTag, folderTree, setCurrentFolder, setCurrentTag, accentColor, enableColorIntegration } = useAppStore();
  const navigate = useNavigate();

  // Handle tag breadcrumbs
  if (currentTag) {
    const tagBreadcrumb = getTagBreadcrumb(currentTag);
    return (
      <div 
        className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 px-4 py-4 bg-white dark:bg-gray-950 border-b"
        style={{ borderBottomColor: enableColorIntegration ? `${getAccentHex(accentColor)}40` : undefined }}
      >
        <button
          onClick={() => {
            setCurrentFolder(null);
            setCurrentTag(null);
            navigate('/');
          }}
          className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-medium"
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>
        
        <ChevronRight className="w-4 h-4" style={{ color: enableColorIntegration ? `${getAccentHex(accentColor)}80` : undefined }} />
        <button
          onClick={() => navigate(tagBreadcrumb.url)}
          className={`font-medium text-gray-900 dark:text-gray-100 ${getAccentText(accentColor)}`}
        >
          {tagBreadcrumb.name}
        </button>
      </div>
    );
  }

  // Handle folder breadcrumbs
  if (!currentFolder || !folderTree) {
    return null;
  }

  // Find the current folder
  const findFolder = (folders: any[], folderId: string): any => {
    for (const folder of folders) {
      if (folder.id === folderId) {
        return folder;
      }
      const found = findFolder(folder.children, folderId);
      if (found) return found;
    }
    return null;
  };

  const currentFolderNode = findFolder(folderTree, currentFolder);
  if (!currentFolderNode) {
    return null;
  }

  const breadcrumbs = getFolderBreadcrumbs(currentFolderNode, folderTree);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div 
      className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 px-4 py-4 bg-white dark:bg-gray-950 border-b"
      style={{ borderBottomColor: enableColorIntegration ? `${getAccentHex(accentColor)}40` : undefined }}
    >
      <button
        onClick={() => {
          setCurrentFolder(null);
          setCurrentTag(null);
          navigate('/');
        }}
        className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-medium"
      >
        <Home className="w-4 h-4" />
        <span>Home</span>
      </button>
      
      {breadcrumbs.map((breadcrumb, index) => (
        <React.Fragment key={breadcrumb.id}>
          <ChevronRight className="w-4 h-4" style={{ color: enableColorIntegration ? `${getAccentHex(accentColor)}80` : undefined }} />
          <button
            onClick={() => navigate(breadcrumb.url)}
            className={`hover:text-gray-900 dark:hover:text-gray-100 transition-colors ${
              index === breadcrumbs.length - 1 
                ? `font-medium text-gray-900 dark:text-gray-100 ${getAccentText(accentColor)}`
                : ''
            }`}
          >
            {breadcrumb.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}; 