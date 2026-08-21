import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigRepository, getDataRoot, validateLibraryPath } from '../src/config-repository.mjs';
import { AppError } from '../src/errors.mjs';
import { createApplication } from '../src/app.mjs';
import { parseInput } from '../src/validation.mjs';
import { z } from 'zod';
import { LibraryContextManager } from '../src/library-context.mjs';

let temporaryDirectory: string | null = null;
const originalConfigPath = process.env.CONFIG_PATH;
const originalLibraryRoots = process.env.KIWI_LIBRARY_ROOTS;
const originalDataRoot = process.env.KIWI_DATA_DIR;

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = null;
  if (originalConfigPath === undefined) delete process.env.CONFIG_PATH;
  else process.env.CONFIG_PATH = originalConfigPath;
  if (originalLibraryRoots === undefined) delete process.env.KIWI_LIBRARY_ROOTS;
  else process.env.KIWI_LIBRARY_ROOTS = originalLibraryRoots;
  if (originalDataRoot === undefined) delete process.env.KIWI_DATA_DIR;
  else process.env.KIWI_DATA_DIR = originalDataRoot;
});

async function configFile(contents: Record<string, unknown>): Promise<string> {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'kiwi-config-'));
  const target = path.join(temporaryDirectory, 'config.json');
  await writeFile(target, JSON.stringify(contents), 'utf8');
  process.env.CONFIG_PATH = target;
  return target;
}

describe('configuration and setup API', () => {
  it('preserves unknown legacy keys during atomic writes', async () => {
    const target = await configFile({ libraryPath: '', requestPageSize: 50, legacyKey: 'preserved' });
    const repository = new ConfigRepository();
    const next = await repository.update({ defaultTheme: 'light' });
    await repository.save(next);
    expect(JSON.parse(await readFile(target, 'utf8'))).toMatchObject({
      defaultTheme: 'light',
      legacyKey: 'preserved',
    });
    await expect(repository.update({ requestPageSize: 2 })).rejects.toBeInstanceOf(AppError);
    expect(await repository.load()).toBe(await repository.load());
  });

  it('validates files, roots, browse paths, and database locations', async () => {
    const target = await configFile({ libraryPath: '', browseRoots: [] });
    const root = path.dirname(target);
    const library = path.join(root, 'Birds.library');
    await mkdir(path.join(library, 'images'), { recursive: true });
    await writeFile(path.join(library, 'metadata.json'), '{}', 'utf8');
    process.env.KIWI_LIBRARY_ROOTS = root;
    process.env.KIWI_DATA_DIR = path.join(root, 'data-root');

    const repository = new ConfigRepository();
    expect(await repository.browseRoots()).toContain(root);
    expect(await repository.resolveBrowsePath(library)).toBe(library);
    expect(await repository.resolveBrowsePath(path.resolve(root, '..'))).toBeNull();
    expect(await repository.databasePath(library)).toBe(path.join(library, 'photo-library.db'));
    expect(await repository.databasePath(path.join(root, 'missing.library'))).toContain(
      path.join('data-root', 'databases'),
    );
    expect(getDataRoot()).toBe(path.resolve(root, 'data-root'));

    await expect(validateLibraryPath('')).resolves.toMatchObject({ valid: false });
    await expect(validateLibraryPath(path.join(root, 'missing'))).resolves.toMatchObject({ valid: false });
    const incomplete = path.join(root, 'Incomplete.library');
    await mkdir(incomplete);
    await expect(validateLibraryPath(incomplete)).resolves.toMatchObject({ valid: false });
    await expect(validateLibraryPath(library)).resolves.toEqual({ valid: true });
  });

  it('maps malformed stored values and request inputs to validation errors', async () => {
    await configFile({ requestPageSize: 1 });
    await expect(new ConfigRepository().load()).rejects.toBeInstanceOf(AppError);
    expect(parseInput(z.coerce.number(), '4')).toBe(4);
    expect(() => parseInput(z.string().min(2), 'x')).toThrow(AppError);
  });

  it('keeps setup available for malformed JSON and accepts legacy BOM encodings', async () => {
    const target = await configFile({ libraryPath: '' });
    await writeFile(target, '{bad json', 'utf8');
    await expect(new ConfigRepository().load()).resolves.toMatchObject({ libraryPath: '' });

    const utf8Config = `\uFEFF${JSON.stringify({ libraryPath: '', legacyKey: 'utf8-bom' })}`;
    await writeFile(target, utf8Config, 'utf8');
    await expect(new ConfigRepository().load()).resolves.toMatchObject({ legacyKey: 'utf8-bom' });

    const utf16Config = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(JSON.stringify({ libraryPath: '', legacyKey: 'utf16' }), 'utf16le'),
    ]);
    await writeFile(target, utf16Config);
    await expect(new ConfigRepository().load()).resolves.toMatchObject({ legacyKey: 'utf16' });
  });

  it('keeps health and setup routes available without a library', async () => {
    await configFile({ libraryPath: '' });
    const { app, context } = await createApplication();
    await request(app).get('/api/health').expect(200).expect('X-Request-ID', /.+/);
    await request(app)
      .get('/api/config')
      .expect(200)
      .expect((response) => {
        expect(response.body._configured).toBe(false);
      });
    await request(app)
      .get('/api/photos')
      .expect(503)
      .expect((response) => {
        expect(response.body).toMatchObject({ code: 'NOT_CONFIGURED', setup: true });
      });
    await request(app)
      .put('/api/config')
      .send({ requestPageSize: 2 })
      .expect(400)
      .expect((response) => {
        expect(response.body.code).toBe('VALIDATION_ERROR');
      });
    await context.close();
  });

  it('switches library contexts atomically and keeps the previous context on validation failure', async () => {
    const target = await configFile({ libraryPath: '', browseRoots: [], legacyKey: 'preserved' });
    const root = path.dirname(target);
    const library = path.join(root, 'Existing.library');
    await mkdir(path.join(library, 'images'), { recursive: true });
    await writeFile(path.join(library, 'metadata.json'), JSON.stringify({ folders: [] }), 'utf8');
    await writeFile(path.join(library, 'mtime.json'), '{}', 'utf8');
    await writeFile(path.join(library, 'tags.json'), '[]', 'utf8');
    process.env.KIWI_LIBRARY_ROOTS = root;

    const repository = new ConfigRepository();
    const context = new LibraryContextManager(repository);
    await context.initialize();
    expect(() => context.requireCurrent()).toThrow(AppError);

    try {
      await context.updateConfig({ libraryPath: library });
      expect(context.requireCurrent()).toMatchObject({ path: library });
      expect(context.watcherStatus()).toMatchObject({ running: true, libraryPath: library });
      await context.rebuild();
      await expect(
        context.updateConfig({ libraryPath: path.join(root, 'missing.library') }),
      ).rejects.toBeInstanceOf(AppError);
      expect(context.requireCurrent().path).toBe(library);
      expect(await repository.load()).toMatchObject({ libraryPath: library, legacyKey: 'preserved' });
      await context.updateConfig({ libraryPath: '' });
      expect(context.current).toBeNull();
    } finally {
      await context.close();
    }
  });

  it('initializes an existing library and lets non-path settings update without a context swap', async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'kiwi-existing-'));
    const library = path.join(temporaryDirectory, 'Ready.library');
    await mkdir(path.join(library, 'images'), { recursive: true });
    await writeFile(path.join(library, 'metadata.json'), JSON.stringify({ folders: [] }), 'utf8');
    await writeFile(path.join(library, 'mtime.json'), '{}', 'utf8');
    await writeFile(path.join(library, 'tags.json'), '[]', 'utf8');
    const target = path.join(temporaryDirectory, 'config.json');
    await writeFile(target, JSON.stringify({ libraryPath: library }), 'utf8');
    process.env.CONFIG_PATH = target;
    process.env.KIWI_LIBRARY_ROOTS = temporaryDirectory;

    const repository = new ConfigRepository();
    const context = new LibraryContextManager(repository);
    await context.initialize();
    try {
      for (let attempt = 0; attempt < 100 && !context.watcherStatus().running; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(context.watcherStatus()).toMatchObject({ running: true, libraryPath: library });
      const current = context.requireCurrent();
      await context.updateConfig({ defaultTheme: 'light' });
      expect(context.requireCurrent()).toBe(current);
      expect(await repository.load()).toMatchObject({ defaultTheme: 'light' });
    } finally {
      await context.close();
    }
  });
});
