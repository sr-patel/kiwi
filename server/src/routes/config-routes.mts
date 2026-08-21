import { Router } from 'express';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { parseInput } from '../validation.mjs';
import { validateLibraryPath } from '../config-repository.mjs';
import type { LibraryContextManager } from '../library-context.mjs';
import { AppError } from '../errors.mjs';

export function createConfigRouter(context: LibraryContextManager): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    const config = await context.configRepository.load();
    const validation = await validateLibraryPath(config.libraryPath);
    response.json({ ...config, _configured: validation.valid, _validation: validation });
  });

  router.put('/', async (request, response) => {
    const config = await context.updateConfig(request.body);
    response.json({ success: true, config });
  });

  router.post('/validate', async (request, response) => {
    const body = parseInput(z.object({ libraryPath: z.string().max(4_096) }), request.body);
    const resolved = await context.configRepository.resolveBrowsePath(body.libraryPath);
    if (!resolved) {
      response.json({ valid: false, reason: 'Library path is outside the configured mount roots.' });
      return;
    }
    response.json(await validateLibraryPath(resolved));
  });

  router.get('/browse-roots', async (_request, response) => {
    response.json({ roots: await context.configRepository.browseRoots() });
  });

  router.get('/browse', async (request, response) => {
    const query = parseInput(z.object({ path: z.string().max(4_096).optional() }), request.query);
    const roots = await context.configRepository.browseRoots();
    if (!query.path) {
      const entries = await Promise.all(
        roots.map(async (root) => ({
          name: path.basename(root) || root,
          path: root,
          isLibrary: root.endsWith('.library'),
          libraryValid: (await validateLibraryPath(root)).valid,
        })),
      );
      response.json({ path: null, parent: null, entries });
      return;
    }

    const target = await context.configRepository.resolveBrowsePath(query.path);
    if (!target) throw new AppError('Path is not accessible', 400, 'VALIDATION_ERROR');
    const targetStats = await stat(target);
    if (!targetStats.isDirectory()) throw new AppError('Path is not a folder', 400, 'VALIDATION_ERROR');
    const parentCandidate = path.dirname(target);
    const parent = await context.configRepository.resolveBrowsePath(parentCandidate);
    const directoryEntries = await readdir(target, { withFileTypes: true });
    const visible = directoryEntries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));
    const entries = await Promise.all(
      visible.map(async (entry) => {
        const entryPath = path.join(target, entry.name);
        const libraryValid = (await validateLibraryPath(entryPath)).valid;
        return {
          name: entry.name,
          path: entryPath,
          isLibrary: entry.name.endsWith('.library') || libraryValid,
          libraryValid,
        };
      }),
    );
    entries.sort(
      (left, right) =>
        Number(right.libraryValid) - Number(left.libraryValid) || left.name.localeCompare(right.name),
    );
    response.json({ path: target, parent: parent && parent !== target ? parent : null, entries });
  });

  return router;
}
