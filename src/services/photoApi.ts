import { PhotosPageSchema } from '@kiwi/contracts';
import type { PaginatedPhotosResponse, PhotoMetadata } from '@/types';
import { apiRequest } from '@/services/apiClient';

interface PhotoPageRequest {
  limit: number;
  offset: number;
  orderBy: string;
  orderDirection: string;
  randomSeed?: number;
  signal?: AbortSignal;
}

function normalizePage(payload: unknown, limit: number, offset: number): PaginatedPhotosResponse {
  if (Array.isArray(payload)) {
    const photos = payload as PhotoMetadata[];
    return { photos, total: offset + photos.length, totalSize: 0, hasMore: photos.length === limit };
  }

  const candidate = payload as Partial<PaginatedPhotosResponse>;
  return PhotosPageSchema.parse({
    ...candidate,
    photos: candidate.photos ?? [],
    total: candidate.total ?? 0,
    totalSize: candidate.totalSize ?? 0,
    hasMore: candidate.hasMore ?? offset + (candidate.photos?.length ?? 0) < (candidate.total ?? 0),
  }) as PaginatedPhotosResponse;
}

async function requestPage(path: string, request: PhotoPageRequest): Promise<PaginatedPhotosResponse> {
  const params = new URLSearchParams({
    limit: String(request.limit),
    offset: String(request.offset),
    orderBy: request.orderBy,
    orderDirection: request.orderDirection,
  });
  if (request.randomSeed !== undefined) params.set('randomSeed', String(request.randomSeed));
  const payload = await apiRequest<unknown>(`${path}${path.includes('?') ? '' : '?'}${params}`, {
    signal: request.signal,
  });
  return normalizePage(payload, request.limit, request.offset);
}

export const photoApi = {
  list(folderId: string | null, request: PhotoPageRequest) {
    const path = folderId ? `/api/photos?folderId=${encodeURIComponent(folderId)}&` : '/api/photos?';
    return requestPage(path, request);
  },

  byTag(tag: string, request: PhotoPageRequest) {
    return requestPage(`/api/tags/${encodeURIComponent(tag)}/photos`, request);
  },

  byTags(tags: readonly string[], request: PhotoPageRequest) {
    return requestPage(`/api/tags/photos?tags=${encodeURIComponent(tags.join(','))}&`, request);
  },

  search(
    query: string,
    filters: { type?: string | null; folderId?: string | null; tag?: string | null },
    request: PhotoPageRequest,
  ) {
    const params = new URLSearchParams({ q: query.trim() });
    if (filters.type) params.set('type', filters.type);
    if (filters.folderId) params.set('folderId', filters.folderId);
    if (filters.tag) params.set('tag', filters.tag);
    return requestPage(`/api/search/photos?${params}&`, request);
  },
};
