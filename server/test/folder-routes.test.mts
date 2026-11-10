import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { LibraryContextManager } from '../src/library-context.mjs';
import { createFolderRouter } from '../src/routes/folder-routes.mjs';

type ThumbnailRow = { id: string; name: string; ext: string };

function createApp(getFirstImageInFolder: (folderId: string) => ThumbnailRow | null) {
  const context = {
    requireCurrent: () => ({ path: '/library', database: { getFirstImageInFolder } }),
  } as unknown as LibraryContextManager;

  return express().use('/api/folders', createFolderRouter(context));
}

describe('GET /api/folders/thumbnails', () => {
  it('resolves a representative photo for every requested folder in one response', async () => {
    const lookup: Record<string, ThumbnailRow> = {
      alpha: { id: 'p1', name: 'one', ext: 'jpg' },
      beta: { id: 'p2', name: 'two', ext: 'png' },
    };
    const app = createApp((folderId) => lookup[folderId] ?? null);

    const response = await request(app)
      .get('/api/folders/thumbnails?ids=alpha,beta,missing,alpha')
      .expect(200);

    expect(response.body).toEqual({
      alpha: { id: 'p1', name: 'one', ext: 'jpg' },
      beta: { id: 'p2', name: 'two', ext: 'png' },
      missing: null,
    });
  });

  it('looks up each folder once even when ids repeat', async () => {
    const calls: string[] = [];
    const app = createApp((folderId) => {
      calls.push(folderId);
      return null;
    });

    await request(app).get('/api/folders/thumbnails?ids=repeat,repeat,repeat').expect(200);

    expect(calls).toEqual(['repeat']);
  });

  it('rejects folder ids that try to escape the library', async () => {
    const app = createApp(() => null);
    await request(app).get('/api/folders/thumbnails?ids=..%2Fsecret').expect(400);
  });

  it('is not shadowed by the per-folder routes', async () => {
    const calls: string[] = [];
    const app = createApp((folderId) => {
      calls.push(folderId);
      return null;
    });

    await request(app).get('/api/folders/thumbnails?ids=real').expect(200);

    expect(calls).toEqual(['real']);
  });

  it('requires the ids parameter', async () => {
    const app = createApp(() => null);
    await request(app).get('/api/folders/thumbnails').expect(400);
  });
});
