import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { LibraryContextManager } from '../library-context.mjs';
import { parseInput } from '../validation.mjs';

function flattenFolderNames(folders: unknown[], map: Record<string, string> = {}): Record<string, string> {
  for (const item of folders) {
    if (!item || typeof item !== 'object') continue;
    const folder = item as { id?: unknown; name?: unknown; children?: unknown };
    if (typeof folder.id === 'string')
      map[folder.id] = typeof folder.name === 'string' ? folder.name : folder.id;
    if (Array.isArray(folder.children)) flattenFolderNames(folder.children, map);
  }
  return map;
}

async function databaseStats(context: LibraryContextManager): Promise<Record<string, unknown>> {
  const current = context.requireCurrent();
  const [stats, analytics, lastRefresh] = await Promise.all([
    current.database.getStats(),
    current.database.getDashboardAnalytics(),
    current.database.getCacheInfo('last_refresh'),
  ]);
  let folderNames: Record<string, string> = {};
  try {
    const metadata = JSON.parse(await readFile(path.join(current.path, 'metadata.json'), 'utf8')) as {
      folders?: unknown[];
    };
    folderNames = flattenFolderNames(metadata.folders ?? []);
  } catch {
    // Dashboard remains available when optional folder metadata is malformed.
  }
  const topFolders = analytics.topFolders.map((row) => ({
    ...row,
    name: folderNames[row.folderId] ?? row.folderId,
  }));
  const fileTypes = Object.fromEntries((stats.typeStats ?? []).map((row) => [row.type, row.count]));
  return { ...stats, lastRefresh, fileTypes, analytics: { ...analytics, topFolders } };
}

export function createSystemRouter(context: LibraryContextManager): Router {
  const router = Router();

  router.get('/health', (_request, response) => {
    response.json({ status: 'ok', timestamp: new Date().toISOString(), sync: context.watcherStatus() });
  });

  router.get('/sync/status', (_request, response) => {
    context.requireCurrent();
    response.json(context.watcherStatus());
  });

  router.post('/database/refresh', async (request, response) => {
    context.requireCurrent();
    const body = parseInput(z.object({ source: z.literal('library').default('library') }), request.body);
    await context.rebuild();
    response.json({
      success: true,
      message: 'Database regenerated successfully from library files',
      source: body.source,
    });
  });

  router.get('/database/status', async (_request, response) => {
    const current = context.requireCurrent();
    const stats = await current.database.getStats();
    response.json({
      exists: true,
      totalPhotos: stats.totalPhotos,
      dbSize: stats.dbSize,
      lastRefresh: await current.database.getCacheInfo('last_refresh'),
      source: 'library_files',
      message: 'Database is ready',
    });
  });

  router.get('/database/stats', async (_request, response) => response.json(await databaseStats(context)));
  router.get('/database/analyze', async (_request, response) => {
    const stats = await databaseStats(context);
    const totalPhotos = Number(stats.totalPhotos ?? 0);
    response.json({
      database: stats,
      stats,
      recommendations: [
        {
          type: totalPhotos > 0 ? 'success' : 'warning',
          message:
            totalPhotos > 0
              ? `Database is healthy with ${totalPhotos.toLocaleString()} photos`
              : 'Database has no photos',
          action: totalPhotos > 0 ? 'Database is ready for use' : 'Run a full rebuild from Settings',
        },
      ],
    });
  });

  router.get('/metadata', async (_request, response) => {
    response.json(await context.requireCurrent().database.getPhotos());
  });

  if (process.env.NODE_ENV !== 'production') {
    router.get('/debug/database', async (_request, response) => {
      const database = context.requireCurrent().database;
      response.json({
        stats: await database.getStats(),
        samplePhotos: await database.getPhotos({ limit: 5 }),
      });
    });
  }

  return router;
}
