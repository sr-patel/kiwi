import type { FolderNode } from '@/types';

/**
 * Precomputed lookup tables for a folder tree.
 *
 * Every folder lookup used to be a fresh recursive scan of the whole tree.
 * Several call sites (`generateFolderUrl`, breadcrumbs, the info panel) run
 * during render, so on a large library that work repeated on every keystroke
 * and every store write. The index is cached on the tree's array identity:
 * the store replaces `folderTree` wholesale when it refreshes, so the cache
 * invalidates by itself.
 */
export interface FolderIndex {
  byId: Map<string, FolderNode>;
  parentById: Map<string, string | null>;
}

const indexCache = new WeakMap<FolderNode[], FolderIndex>();

export const buildFolderIndex = (folderTree: FolderNode[]): FolderIndex => {
  const byId = new Map<string, FolderNode>();
  const parentById = new Map<string, string | null>();
  const walk = (folders: FolderNode[], parentId: string | null): void => {
    for (const folder of folders) {
      byId.set(folder.id, folder);
      parentById.set(folder.id, parentId);
      if (folder.children.length) walk(folder.children, folder.id);
    }
  };
  walk(folderTree, null);
  return { byId, parentById };
};

/** Returns a cached index for `folderTree`, building it on first use. */
export const getFolderIndex = (folderTree: FolderNode[]): FolderIndex => {
  let index = indexCache.get(folderTree);
  if (!index) {
    index = buildFolderIndex(folderTree);
    indexCache.set(folderTree, index);
  }
  return index;
};

/** Finds a folder by id in O(1) using the cached index. */
export const findFolderById = (folderTree: FolderNode[], folderId: string): FolderNode | null =>
  getFolderIndex(folderTree).byId.get(folderId) ?? null;

const encodePathSegments = (segments: string[]): string =>
  segments.map((segment) => encodeURIComponent(encodeURIComponent(segment))).join('|');

/**
 * Generate a URL path for a folder based on its path in the folder tree
 */
export const generateFolderUrl = (folder: FolderNode, folderTree: FolderNode[]): string => {
  const path = getFolderPath(folder, folderTree);
  if (path.length === 0) return '/';

  // Use a different separator that won't conflict with folder names containing slashes
  // We'll use double-encode the path segments and join with a safe separator
  return `/folder/${encodePathSegments(path)}`;
};

/** Path segments of a folder, resolved from the cached parent links (O(depth)). */
export const getFolderPathById = (folderTree: FolderNode[], folderId: string): string[] => {
  const { byId, parentById } = getFolderIndex(folderTree);
  const segments: string[] = [];
  let current: string | null | undefined = folderId;
  const guard = byId.size + 1;
  while (current !== null && current !== undefined && segments.length < guard) {
    const node = byId.get(current);
    if (!node) return [];
    segments.push(node.name);
    current = parentById.get(current);
  }
  return segments.reverse();
};

/**
 * Get the full path of a folder from root to the folder
 */
export const getFolderPath = (folder: FolderNode, folderTree: FolderNode[]): string[] =>
  getFolderPathById(folderTree, folder.id);

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

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    // Malformed escape sequences must not throw while resolving a route.
    return value;
  }
};

/**
 * Parse folder path from URL and return folder ID
 */
export const parseFolderPathFromUrl = (folderPath: string, folderTree: FolderNode[]): string | null => {
  let pathSegments: string[] = [];

  // Check if it's the new format (with | separator)
  if (folderPath.includes('|')) {
    pathSegments = folderPath
      .split('|')
      .map((segment) => safeDecode(safeDecode(segment)))
      .filter(Boolean);
  } else {
    // Handle old format (with / separator) for backward compatibility
    // But first, check if this looks like a folder name with slashes that was decoded
    const decodedPath = safeDecode(folderPath);

    // If the decoded path contains slashes and matches a folder name, treat it as a single folder
    if (decodedPath.includes('/')) {
      // Check if this exact path exists as a folder name
      const folderExists = folderTree.some((folder) => folder.name === decodedPath);
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
 * Get breadcrumb navigation for a folder.
 *
 * Resolved from the cached index in O(depth); previously this walked the tree
 * once per path segment, which is O(depth^2 * nodes).
 */
export const getFolderBreadcrumbs = (
  folder: FolderNode,
  folderTree: FolderNode[],
): Array<{ name: string; url: string; id: string }> => {
  const { parentById } = getFolderIndex(folderTree);
  const path = getFolderPath(folder, folderTree);
  if (path.length === 0) return [];

  // Walk root -> folder collecting ids, so each crumb knows its own id.
  const ids: string[] = [];
  let current: string | null | undefined = folder.id;
  while (current !== null && current !== undefined) {
    ids.push(current);
    current = parentById.get(current);
  }
  ids.reverse();

  return ids.map((id, index) => ({
    name: path[index],
    url: `/folder/${encodePathSegments(path.slice(0, index + 1))}`,
    id,
  }));
};
