export const queryKeys = {
  all: ['kiwi'] as const,
  config: () => [...queryKeys.all, 'config'] as const,
  configBrowse: (directory: string | null) => [...queryKeys.config(), 'browse', directory] as const,
  photos: () => [...queryKeys.all, 'photos'] as const,
  photo: (photoId: string | null) => [...queryKeys.photos(), 'detail', photoId] as const,
  photoPage: (folderId: string | null, sortField: string, direction: string, randomSeed?: number) =>
    [...queryKeys.photos(), 'page', folderId, sortField, direction, randomSeed ?? null] as const,
  tagPhotos: (tag: string | null, sortField: string, direction: string, randomSeed?: number) =>
    [...queryKeys.photos(), 'tag', tag, sortField, direction, randomSeed ?? null] as const,
  multiTagPhotos: (tags: readonly string[], sortField: string, direction: string, randomSeed?: number) =>
    [...queryKeys.photos(), 'tags', [...tags].sort(), sortField, direction, randomSeed ?? null] as const,
  search: (
    query: string,
    type: string | null,
    folderId: string | null,
    tag: string | null,
    sortField: string,
    direction: string,
    randomSeed?: number,
  ) =>
    [
      ...queryKeys.photos(),
      'search',
      query.trim(),
      type,
      folderId,
      tag,
      sortField,
      direction,
      randomSeed ?? null,
    ] as const,
  folderCounts: (recursive = false) => [...queryKeys.all, 'folder-counts', recursive] as const,
  folderThumbnail: (folderId: string) => [...queryKeys.all, 'folder-thumbnail', folderId] as const,
  tags: () => [...queryKeys.all, 'tags'] as const,
  tagCounts: () => [...queryKeys.tags(), 'counts'] as const,
  tagNetwork: (minTagCount?: number, maxNodes?: number, connectionStrength?: string) =>
    [
      ...queryKeys.tags(),
      'network',
      minTagCount ?? null,
      maxNodes ?? null,
      connectionStrength ?? null,
    ] as const,
  dashboard: () => [...queryKeys.all, 'dashboard'] as const,
  sync: () => [...queryKeys.all, 'sync'] as const,
};
