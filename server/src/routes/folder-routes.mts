import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { LibraryContextManager } from '../library-context.mjs';
import { parseInput } from '../validation.mjs';
import { AppError } from '../errors.mjs';

const folderIdSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9._/-]+$/)
  .refine((value) => !value.includes('..'));

export function createFolderRouter(context: LibraryContextManager): Router {
  const router = Router();

  router.get('/counts', async (_request, response) => {
    response.json(await context.requireCurrent().database.getPhotoCountsByFolder());
  });

  router.get('/counts/recursive', async (_request, response) => {
    const current = context.requireCurrent();
    const metadata = JSON.parse(await readFile(path.join(current.path, 'metadata.json'), 'utf8')) as {
      folders?: unknown[];
    };
    response.json(await current.database.getRecursiveFolderCounts(metadata.folders ?? []));
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
