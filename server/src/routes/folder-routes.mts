import { Router } from 'express';
import { z } from 'zod';
import type { LibraryContextManager } from '../library-context.mjs';
import { readLibraryFolders } from '../library-metadata.mjs';
import { parseInput } from '../validation.mjs';
import { AppError } from '../errors.mjs';

const folderIdSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9._/-]+$/)
  .refine((value) => !value.includes('..'));

/** Upper bound on folders resolved per batched thumbnail request. */
const MAX_FOLDER_THUMBNAIL_BATCH = 200;

export function createFolderRouter(context: LibraryContextManager): Router {
  const router = Router();

  router.get('/counts', async (_request, response) => {
    response.json(await context.requireCurrent().database.getPhotoCountsByFolder());
  });

  router.get('/counts/recursive', async (_request, response) => {
    const current = context.requireCurrent();
    const folders = await readLibraryFolders(current.path);
    response.json(await current.database.getRecursiveFolderCounts(folders));
  });

  /**
   * Batched folder thumbnails.
   *
   * A folder view used to issue one request per visible subfolder. This returns
   * the same representative photo for every requested folder in a single round
   * trip. Order matters: this route is declared before the `/:folderId/...`
   * routes so `/thumbnails` is never parsed as a folder id.
   */
  router.get('/thumbnails', async (request, response) => {
    const query = parseInput(z.object({ ids: z.string().min(1).max(20_000) }), request.query);
    const ids = [
      ...new Set(
        query.ids
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ].slice(0, MAX_FOLDER_THUMBNAIL_BATCH);
    ids.forEach((folderId) => parseInput(folderIdSchema, folderId));

    const database = context.requireCurrent().database;
    const thumbnails: Record<string, { id: string; name: string; ext: string } | null> = {};
    for (const folderId of ids) {
      const photo = database.getFirstImageInFolder(folderId);
      thumbnails[folderId] = photo ? { id: photo.id, name: photo.name, ext: photo.ext } : null;
    }
    response.json(thumbnails);
  });

  router.get('/:folderId/count', async (request, response) => {
    const folderId = parseInput(folderIdSchema, request.params.folderId);
    const recursive =
      parseInput(z.enum(['true', 'false']).default('false'), request.query.recursive) === 'true';
    const database = context.requireCurrent().database;
    const count = recursive
      ? await database.getRecursivePhotoCountForFolder(folderId)
      : await database.getPhotoCountForFolder(folderId);
    response.json({ folderId, count, recursive });
  });

  router.get('/:folderId/thumbnail', async (request, response) => {
    const folderId = parseInput(folderIdSchema, request.params.folderId);
    const photo = context.requireCurrent().database.getFirstImageInFolder(folderId);
    if (!photo) throw new AppError('No images found in folder', 404, 'NOT_FOUND');
    response.json({ id: photo.id, name: photo.name, ext: photo.ext });
  });

  return router;
}
