import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { kiwiApi } from '@/services/kiwiApi';

export type FolderThumbnail = { id: string; name: string; ext: string };

/**
 * Representative photo for each folder, fetched in one request.
 *
 * This used to be one query (and one HTTP request) per visible subfolder. The
 * ids are joined into a sorted, de-duplicated key so the query identity stays
 * stable no matter how the caller's array is built.
 */
export function useFolderThumbnails(folderIds: readonly string[], enabled: boolean) {
  const key = [...new Set(folderIds)].sort().join(',');

  const query = useQuery({
    queryKey: queryKeys.folderThumbnails(key),
    queryFn: ({ signal }) => kiwiApi.folders.thumbnails(key.length > 0 ? key.split(',') : [], signal),
    enabled: enabled && key.length > 0,
    staleTime: 10 * 60_000,
  });

  return {
    thumbnails: query.data ?? {},
    loading: query.isLoading,
  };
}
