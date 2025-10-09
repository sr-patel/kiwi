import { FolderNode } from '@/types';

/**
 * Generate a URL path for a folder based on its path in the folder tree
 */
export const generateFolderUrl = (folder: FolderNode, folderTree: FolderNode[]): string => {
  const path = getFolderPath(folder, folderTree);
  if (path.length === 0) return '/';
  
  // Use a different separator that won't conflict with folder names containing slashes
  // We'll use double-encode the path segments and join with a safe separator
  const encodedPath = path.map(segment => encodeURIComponent(encodeURIComponent(segment))).join('|');
  return `/folder/${encodedPath}`;
};

/**
 * Get the full path of a folder from root to the folder
 */
export const getFolderPath = (folder: FolderNode, folderTree: FolderNode[]): string[] => {
  const findPath = (folders: FolderNode[], targetId: string, currentPath: string[] = []): string[] | null => {
    for (const f of folders) {
      const newPath = [...currentPath, f.name];
      
      if (f.id === targetId) {
        return newPath;
      }
      
      const result = findPath(f.children, targetId, newPath);
      if (result) return result;
    }
    return null;
  };
  
  return findPath(folderTree, folder.id) || [];
};

/**
 * Find a folder by its path segments
 */
export const findFolderByPath = (folderTree: FolderNode[], pathSegments: string[]): FolderNode | null => {
  if (pathSegments.length === 0) return null;
  
  for (const folder of folderTree) {
    if (folder.name === pathSegments[0]) {
      if (pathSegments.length === 1) {
        return folder;
      } else {
        const childResult = findFolderByPath(folder.children, pathSegments.slice(1));
        if (childResult) return childResult;
      }
    }
  }
  return null;
};

/**
 * Parse folder path from URL and return folder ID
 */
export const parseFolderPathFromUrl = (folderPath: string, folderTree: FolderNode[]): string | null => {
  let pathSegments: string[] = [];
  
  // Check if it's the new format (with | separator)
  if (folderPath.includes('|')) {
    pathSegments = folderPath.split('|').map(segment => {
      try {
        return decodeURIComponent(decodeURIComponent(segment));
      } catch (e) {
        return segment;
      }
    }).filter(Boolean);
  } else {
    // Handle old format (with / separator) for backward compatibility
    // But first, check if this looks like a folder name with slashes that was decoded
    const decodedPath = decodeURIComponent(folderPath);
    
    // If the decoded path contains slashes and matches a folder name, treat it as a single folder
    if (decodedPath.includes('/')) {
      // Check if this exact path exists as a folder name
      const folderExists = folderTree.some(folder => folder.name === decodedPath);
      if (folderExists) {
        pathSegments = [decodedPath];
      } else {
        // Fall back to splitting by /
        pathSegments = decodedPath.split('/').filter(Boolean);
      }
    } else {
      pathSegments = decodedPath.split('/').filter(Boolean);
    }
  }
  
  const folder = findFolderByPath(folderTree, pathSegments);
  return folder ? folder.id : null;
};

/**
 * Get breadcrumb navigation for a folder
 */
export const getFolderBreadcrumbs = (folder: FolderNode, folderTree: FolderNode[]): Array<{ name: string; url: string; id: string }> => {
  const path = getFolderPath(folder, folderTree);
  const breadcrumbs = [];
  
  let currentPath: string[] = [];
  for (let i = 0; i < path.length; i++) {
    currentPath.push(path[i]);
    const encodedPath = currentPath.map(segment => encodeURIComponent(encodeURIComponent(segment))).join('|');
    const url = `/folder/${encodedPath}`;
    
    // Find the folder at this path level
    const folderAtPath = findFolderByPath(folderTree, currentPath);
    if (folderAtPath) {
      breadcrumbs.push({
        name: path[i],
        url,
        id: folderAtPath.id
      });
    }
  }
  
  return breadcrumbs;
}; 