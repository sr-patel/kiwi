import { Router, type Response } from 'express';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { PaginationQuerySchema, SearchQuerySchema } from '@kiwi/contracts';
import type { LibraryContextManager } from '../library-context.mjs';
import type { LegacyDatabase, PhotoRecord, PhotosPageRecord } from '../legacy-types.mjs';
import { parseInput } from '../validation.mjs';
import { AppError } from '../errors.mjs';

const idSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9._+-]+$/)
  .refine((value) => !value.includes('..'));

const mimeTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  avif: 'image/avif',
  jxl: 'image/jxl',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  m4a: 'audio/mp4',
  wma: 'audio/x-ms-wma',
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  mobi: 'application/x-mobipocket-ebook',
};

const browserRenderableImageTypes = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'svg']);

function normalizePage(
  page: PhotosPageRecord,
  offset: number,
): PhotosPageRecord & { totalSize: number; hasMore: boolean } {
  return {
    ...page,
    totalSize: page.totalSize ?? 0,
    hasMore: page.hasMore ?? offset + page.photos.length < page.total,
  };
}

async function resolvePhoto(database: LegacyDatabase, idInput: unknown): Promise<PhotoRecord> {
  const id = parseInput(idSchema, idInput);
  const photo = await database.getPhotoById(id);
  if (!photo) throw new AppError('Photo not found', 404, 'NOT_FOUND');
  return photo;
}

function trustedMediaPath(
  libraryPath: string,
  photo: PhotoRecord,
  kind: 'file' | 'thumbnail' | 'preview',
): string {
  const directory = path.resolve(libraryPath, 'images', `${photo.id}.info`);
  const previewOnly = kind === 'preview' && ['jxl', 'heic', 'heif'].includes(photo.ext.toLowerCase());
  const filename =
    kind === 'thumbnail' || previewOnly ? `${photo.name}_thumbnail.png` : `${photo.name}.${photo.ext}`;
  const resolved = path.resolve(directory, filename);
  if (!resolved.startsWith(`${directory}${path.sep}`))
    throw new AppError('Unsafe media metadata', 400, 'VALIDATION_ERROR');
  return resolved;
}

function sendMedia(response: Response, filePath: string, contentType: string): void {
  response.type(contentType);
  response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  response.setHeader('Accept-Ranges', 'bytes');
  response.sendFile(filePath, (error) => {
    if (!error || response.headersSent) return;
    response
      .status((error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 500)
      .json({ error: 'Media file not found' });
  });
}

export function createPhotoRouter(context: LibraryContextManager): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    const current = context.requireCurrent();
    const query = parseInput(
      PaginationQuerySchema.extend({ folderId: z.string().max(255).optional() }),
      request.query,
    );
    const page = await current.database.getPhotosPaginated({
      folderId: query.folderId ?? null,
      limit: query.limit,
      offset: query.offset,
      orderBy: query.orderBy,
      orderDirection: query.orderDirection,
      randomSeed: query.randomSeed,
    });
    response.json(normalizePage(page, query.offset));
  });

  router.get('/metadata', async (_request, response) => {
    response.json(await context.requireCurrent().database.getPhotos());
  });

  router.get('/count', async (_request, response) => {
    response.json({ count: await context.requireCurrent().database.getPhotoCount() });
  });

  router.get('/:id', async (request, response) => {
    const current = context.requireCurrent();
    const photo = await resolvePhoto(current.database, request.params.id);
    const folders = await current.database.getFoldersForPhoto(photo.id);
    response.json({
      ...photo,
      folders,
      url: `/api/photos/${encodeURIComponent(photo.id)}/file?ext=${encodeURIComponent(photo.ext)}&name=${encodeURIComponent(photo.name)}`,
      thumbnailUrl: `/api/photos/${encodeURIComponent(photo.id)}/thumbnail?name=${encodeURIComponent(photo.name)}`,
    });
  });

  router.get('/:id/metadata', async (request, response) => {
    const current = context.requireCurrent();
    const photo = await resolvePhoto(current.database, request.params.id);
    response.json({ ...photo, folders: await current.database.getFoldersForPhoto(photo.id) });
  });

  router.get('/:id/file', async (request, response) => {
    const current = context.requireCurrent();
    const photo = await resolvePhoto(current.database, request.params.id);
    sendMedia(
      response,
      trustedMediaPath(current.path, photo, 'file'),
      mimeTypes[photo.ext.toLowerCase()] ?? 'application/octet-stream',
    );
  });

  router.get('/:id/thumbnail', async (request, response) => {
    const current = context.requireCurrent();
    const photo = await resolvePhoto(current.database, request.params.id);
    const thumbnailPath = trustedMediaPath(current.path, photo, 'thumbnail');
    try {
      await access(thumbnailPath);
      sendMedia(response, thumbnailPath, 'image/png');
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }

    // Some valid Eagle items do not contain a generated thumbnail. Serve the
    // trusted original for formats browsers can render so grids remain usable.
    const extension = photo.ext.toLowerCase();
    if (!browserRenderableImageTypes.has(extension)) {
      throw new AppError('Thumbnail not found', 404, 'NOT_FOUND');
    }
    sendMedia(
      response,
      trustedMediaPath(current.path, photo, 'file'),
      mimeTypes[extension] ?? 'application/octet-stream',
    );
  });

  router.get('/:id/preview', async (request, response) => {
    const current = context.requireCurrent();
    const photo = await resolvePhoto(current.database, request.params.id);
    const preview = ['jxl', 'heic', 'heif'].includes(photo.ext.toLowerCase());
    sendMedia(
      response,
      trustedMediaPath(current.path, photo, 'preview'),
      preview ? 'image/png' : (mimeTypes[photo.ext.toLowerCase()] ?? 'application/octet-stream'),
    );
  });

  return router;
}

export function createSearchRouter(context: LibraryContextManager): Router {
  const router = Router();
  const options = (query: z.infer<typeof SearchQuerySchema>) => ({
    query: query.q,
    type: query.type ?? null,
    limit: query.limit,
    offset: query.offset,
    orderBy: query.orderBy,
    orderDirection: query.orderDirection,
    randomSeed: query.randomSeed,
    folderId: query.folderId ?? null,
    tagContext: query.tag ?? null,
  });

  router.get('/photos', async (request, response) => {
    const query = parseInput(SearchQuerySchema, request.query);
    const database = context.requireCurrent().database;
    const searchOptions = options(query);
    const [photos, total, totalSize] = await Promise.all([
      database.searchPhotos(searchOptions),
      database.getSearchCount(searchOptions),
      database.getSearchTotalSize(searchOptions),
    ]);
    response.json({ photos, total, totalSize, hasMore: query.offset + photos.length < total });
  });

  router.get('/count', async (request, response) => {
    const query = parseInput(SearchQuerySchema, request.query);
    response.json({ count: await context.requireCurrent().database.getSearchCount(options(query)) });
  });

  router.get('/size', async (request, response) => {
    const query = parseInput(SearchQuerySchema, request.query);
    response.json({ totalSize: await context.requireCurrent().database.getSearchTotalSize(options(query)) });
  });
  return router;
}

export function createLibraryRouter(context: LibraryContextManager): Router {
  const router = Router();
  const sendLibraryJson = (filename: string) => async (_request: unknown, response: Response) => {
    const data = await readFile(path.join(context.requireCurrent().path, filename), 'utf8');
    response.json(JSON.parse(data));
  };
  router.get('/metadata', sendLibraryJson('metadata.json'));
  router.get('/mtime', sendLibraryJson('mtime.json'));
  router.get('/tags', sendLibraryJson('tags.json'));
  return router;
}
