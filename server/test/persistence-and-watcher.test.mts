import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { LegacyDatabase } from '../src/legacy-types.mjs';

const require = createRequire(import.meta.url);
const PhotoLibraryDatabase = require('../database.cjs') as new (databasePath: string) => LegacyDatabase & {
  initialize(): Promise<boolean>;
  deletePhoto(id: string): Promise<boolean>;
};
const { createWatcherManager } = require('../watcher.cjs') as {
  createWatcherManager(): {
    startWatcher(libraryPath: string, database: LegacyDatabase): Promise<void>;
    stopWatcher(): Promise<void>;
    getWatcherStatus(): { running?: boolean; libraryPath?: string | null };
  };
};

let temporaryDirectory: string | null = null;
let database: InstanceType<typeof PhotoLibraryDatabase> | null = null;

afterEach(async () => {
  database?.close();
  database = null;
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = null;
});

function photo(id: string): Record<string, unknown> {
  return {
    id,
    name: `Photo ${id}`,
    ext: 'jpg',
    size: 100,
    mtime: id,
    type: 'image',
  };
}

describe('legacy persistence adapter', () => {
  it('keeps seeded random pagination deterministic across listing modes', async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'kiwi-persistence-'));
    database = new PhotoLibraryDatabase(path.join(temporaryDirectory, 'library.db'));
    await database.initialize();
    for (let index = 0; index < 30; index++) {
      database.syncPhoto(
        photo(`photo-${index.toString().padStart(2, '0')}`),
        ['folder'],
        ['shared', 'second'],
      );
    }

    const request = { limit: 10, offset: 0, orderBy: 'random', orderDirection: 'ASC', randomSeed: 41 };
    const first = await database.getPhotosPaginated(request);
    const repeated = await database.getPhotosPaginated(request);
    const second = await database.getPhotosPaginated({ ...request, offset: 10 });
    const anotherSeed = await database.getPhotosPaginated({ ...request, randomSeed: 42 });
    const tagged = await database.getPhotosByTagPaginated({ ...request, tag: 'shared' });
    const multiTagged = await database.getPhotosByTagsPaginated({ ...request, tags: ['shared', 'second'] });
    const searched = await database.searchPhotos({ ...request, query: 'Photo' });

    expect(first.photos.map(({ id }) => id)).toEqual(repeated.photos.map(({ id }) => id));
    expect(first.photos.map(({ id }) => id)).toEqual(tagged.photos.map(({ id }) => id));
    expect(first.photos.map(({ id }) => id)).toEqual(multiTagged.photos.map(({ id }) => id));
    expect(first.photos.map(({ id }) => id)).toEqual(searched.map(({ id }) => id));
    expect(first.photos.map(({ id }) => id)).not.toEqual(anotherSeed.photos.map(({ id }) => id));
    expect(new Set([...first.photos, ...second.photos].map(({ id }) => id)).size).toBe(20);
    expect(first).toMatchObject({ total: 30, totalSize: 3_000, hasMore: true });
  });

  it('rolls back photo and relationship changes together and cascades deletes', async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'kiwi-transaction-'));
    database = new PhotoLibraryDatabase(path.join(temporaryDirectory, 'library.db'));
    await database.initialize();
    database.syncPhoto(photo('kept'), ['folder'], ['tag']);
    expect(() => database!.syncPhoto(photo('rolled-back'), [null as unknown as string], [])).toThrow();
    expect(await database.getPhotoById('rolled-back')).toBeNull();
    await database.deletePhoto('kept');
    expect(await database.getFoldersForPhoto('kept')).toEqual([]);
    expect(await database.getPhotosByTagPaginated({ tag: 'tag' })).toMatchObject({ total: 0, photos: [] });
  });
});

describe('watcher manager lifecycle', () => {
  it('keeps queues and lifecycle state isolated per library context', async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'kiwi-watcher-'));
    await mkdir(path.join(temporaryDirectory, 'images'), { recursive: true });
    await writeFile(path.join(temporaryDirectory, 'mtime.json'), '{}', 'utf8');
    const first = createWatcherManager();
    const second = createWatcherManager();
    const inertDatabase = {} as LegacyDatabase;

    await first.startWatcher(temporaryDirectory, inertDatabase);
    expect(first.getWatcherStatus()).toMatchObject({ running: true, libraryPath: temporaryDirectory });
    expect(second.getWatcherStatus()).toMatchObject({ running: false, libraryPath: null });
    await first.stopWatcher();
    await second.stopWatcher();
  });
});
