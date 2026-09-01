import express from 'express';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { LibraryContextManager } from '../src/library-context.mjs';
import type { PhotoRecord } from '../src/legacy-types.mjs';
import { createPhotoRouter } from '../src/routes/photo-routes.mjs';

let temporaryDirectory: string | null = null;

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = null;
});

describe('photo media routes', () => {
  it('serves a browser-renderable original when Eagle has no thumbnail', async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'kiwi-media-'));
    const photo = {
      id: 'photo-1',
      name: 'original',
      ext: 'jpg',
    } as PhotoRecord;
    const photoDirectory = path.join(temporaryDirectory, 'images', `${photo.id}.info`);
    await mkdir(photoDirectory, { recursive: true });
    const contents = Buffer.from('browser-image');
    await writeFile(path.join(photoDirectory, `${photo.name}.${photo.ext}`), contents);

    const context = {
      requireCurrent: () => ({
        path: temporaryDirectory,
        database: { getPhotoById: async () => photo },
      }),
    } as unknown as LibraryContextManager;
    const app = express().use('/api/photos', createPhotoRouter(context));

    const response = await request(app).get(`/api/photos/${photo.id}/thumbnail?name=untrusted`).expect(200);
    expect(response.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(response.body).toEqual(contents);
  });
});
