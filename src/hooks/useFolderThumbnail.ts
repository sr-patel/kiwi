import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { kiwiApi } from '@/services/kiwiApi';
import { HttpError, toUserMessage } from '@/services/apiClient';

export function useFolderThumbnail(folderId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: queryKeys.folderThumbnail(folderId),
    queryFn: ({ signal }) => kiwiApi.folders.thumbnail(folderId, signal),
    enabled: enabled && Boolean(folderId),
    staleTime: 10 * 60_000,
  });
  const missing = query.error instanceof HttpError && query.error.status === 404;
  return {
    thumbnail: missing ? null : (query.data ?? null),
    loading: query.isLoading,
    error: query.error && !missing ? toUserMessage(query.error) : null,
  };
}
