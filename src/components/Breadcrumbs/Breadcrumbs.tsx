import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/store';
import { findFolderById, getFolderBreadcrumbs } from '@/utils/folderUrls';
import { getTagBreadcrumb } from '@/utils/tagUrls';
import { getAccentText, getAccentHex } from '@/utils/accentColors';

export const Breadcrumbs: React.FC = () => {
  const {
    currentFolder,
    currentTag,
    folderTree,
    setCurrentFolder,
    setCurrentTag,
    accentColor,
    enableColorIntegration,
  } = useAppStore(
    useShallow((state) => ({
      currentFolder: state.currentFolder,
      currentTag: state.currentTag,
      folderTree: state.folderTree,
      setCurrentFolder: state.setCurrentFolder,
      setCurrentTag: state.setCurrentTag,
      accentColor: state.accentColor,
      enableColorIntegration: state.enableColorIntegration,
    })),
  );
  const navigate = useNavigate();

  // Handle tag breadcrumbs
  if (currentTag) {
    const tagBreadcrumb = getTagBreadcrumb(currentTag);
    return (
      <div
        className="flex items-center gap-1 border-b border-gray-200 bg-white px-4 py-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400"
        style={enableColorIntegration ? { borderBottomColor: `${getAccentHex(accentColor)}40` } : undefined}
      >
        <button
          onClick={() => {
            setCurrentFolder(null);
            setCurrentTag(null);
            navigate('/');
          }}
          className="flex items-center gap-1 font-medium transition-colors hover:text-gray-900 dark:hover:text-gray-100"
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>

        <ChevronRight
          className="w-4 h-4"
          style={{ color: enableColorIntegration ? `${getAccentHex(accentColor)}80` : undefined }}
        />
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

  // Find the current folder (O(1) via the cached tree index)
  const currentFolderNode = findFolderById(folderTree, currentFolder);
  if (!currentFolderNode) {
    return null;
  }

  const breadcrumbs = getFolderBreadcrumbs(currentFolderNode, folderTree);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-1 border-b border-gray-200 bg-white px-4 py-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400"
      style={enableColorIntegration ? { borderBottomColor: `${getAccentHex(accentColor)}40` } : undefined}
    >
      <button
        onClick={() => {
          setCurrentFolder(null);
          setCurrentTag(null);
          navigate('/');
        }}
        className="flex items-center gap-1 font-medium transition-colors hover:text-gray-900 dark:hover:text-gray-100"
      >
        <Home className="w-4 h-4" />
        <span>Home</span>
      </button>

      {breadcrumbs.map((breadcrumb, index) => (
        <React.Fragment key={breadcrumb.id}>
          <ChevronRight
            className="w-4 h-4"
            style={{ color: enableColorIntegration ? `${getAccentHex(accentColor)}80` : undefined }}
          />
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
