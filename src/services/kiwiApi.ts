import {
  BrowseResponseSchema,
  ConfigResponseSchema,
  ConfigUpdateResponseSchema,
  ConfigValidationSchema,
  CountResponseSchema,
  DatabaseStatusSchema,
  CountMapSchema,
  DashboardStatsSchema,
  FolderThumbnailSchema,
  LibraryMetadataSchema,
  PhotoSchema,
  SuccessResponseSchema,
  SyncStatusSchema,
  TagNetworkGraphSchema,
  TagsSchema,
  type KiwiConfig,
} from '@kiwi/contracts';
import { apiRequest } from './apiClient';

function jsonBody(value: unknown): Pick<RequestInit, 'body'> {
  return { body: JSON.stringify(value) };
}

export const kiwiApi = {
  config: {
    get: (signal?: AbortSignal) => apiRequest('/api/config', { schema: ConfigResponseSchema, signal }),
    update: (updates: Partial<KiwiConfig>, signal?: AbortSignal) =>
      apiRequest('/api/config', {
        method: 'PUT',
        ...jsonBody(updates),
        schema: ConfigUpdateResponseSchema,
        signal,
      }),
    validate: (libraryPath: string, signal?: AbortSignal) =>
      apiRequest('/api/config/validate', {
        method: 'POST',
        ...jsonBody({ libraryPath }),
        schema: ConfigValidationSchema,
        signal,
      }),
    browse: (directory?: string, signal?: AbortSignal) =>
      apiRequest(
        directory ? `/api/config/browse?path=${encodeURIComponent(directory)}` : '/api/config/browse',
        { schema: BrowseResponseSchema, signal },
      ),
  },
  library: {
    metadata: (signal?: AbortSignal) =>
      apiRequest('/api/library/metadata', { schema: LibraryMetadataSchema, signal }),
  },
  folders: {
    counts: (recursive = false, signal?: AbortSignal) =>
      apiRequest(recursive ? '/api/folders/counts/recursive' : '/api/folders/counts', {
        schema: CountMapSchema,
        signal,
      }),
    thumbnail: (folderId: string, signal?: AbortSignal) =>
      apiRequest(`/api/folders/${encodeURIComponent(folderId)}/thumbnail`, {
        schema: FolderThumbnailSchema,
        signal,
      }),
  },
  tags: {
    list: (signal?: AbortSignal) => apiRequest('/api/tags', { schema: TagsSchema, signal }),
    counts: (signal?: AbortSignal) => apiRequest('/api/tags/counts', { schema: CountMapSchema, signal }),
    network: (parameters: URLSearchParams, signal?: AbortSignal) =>
      apiRequest(`/api/tags/network?${parameters}`, {
        schema: TagNetworkGraphSchema,
        signal,
        timeoutMs: 30_000,
      }),
  },
  system: {
    stats: (signal?: AbortSignal) =>
      apiRequest('/api/database/stats', { schema: DashboardStatsSchema, signal }),
    syncStatus: (signal?: AbortSignal) =>
      apiRequest('/api/sync/status', { schema: SyncStatusSchema, signal }),
    databaseStatus: (signal?: AbortSignal) =>
      apiRequest('/api/database/status', { schema: DatabaseStatusSchema, signal }),
    rebuild: (signal?: AbortSignal) =>
      apiRequest('/api/database/refresh', {
        method: 'POST',
        ...jsonBody({ source: 'library' }),
        schema: SuccessResponseSchema,
        signal,
        timeoutMs: 5 * 60_000,
      }),
  },
  photos: {
    count: (signal?: AbortSignal) => apiRequest('/api/photos/count', { schema: CountResponseSchema, signal }),
    metadata: (photoId: string, signal?: AbortSignal) =>
      apiRequest(`/api/photos/${encodeURIComponent(photoId)}/metadata`, { schema: PhotoSchema, signal }),
  },
};
