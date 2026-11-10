import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  renderThumbnail,
  snapThumbnailWidth,
  THUMBNAIL_WIDTHS,
  thumbnailCacheDir,
} from '../src/thumbnail-cache.mjs';

let workspace: string;

const libraryPath = (): string => path.join(workspace, 'Photos.library');
const dataRoot = (): string => path.join(workspace, 'data');

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'kiwi-thumbs-'));
  process.env.KIWI_DATA_DIR = dataRoot();
});

afterEach(async () => {
  delete process.env.KIWI_DATA_DIR;
  // Windows can still hold the encoded file briefly; retry rather than fail.
  await rm(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }).catch(
    () => undefined,
  );
});

async function makeSource(width = 1000, height = 800): Promise<string> {
  const filePath = path.join(workspace, 'thumb.png');
  await sharp({ create: { width, height, channels: 3, background: '#8E466D' } })
    .png()
    .toFile(filePath);
  return filePath;
}

describe('snapThumbnailWidth', () => {
  it('returns null when no usable width is requested', () => {
    expect(snapThumbnailWidth(undefined)).toBeNull();
    expect(snapThumbnailWidth(Number.NaN)).toBeNull();
    expect(snapThumbnailWidth(0)).toBeNull();
    expect(snapThumbnailWidth(-100)).toBeNull();
  });

  it('snaps to the nearest supported step', () => {
    expect(snapThumbnailWidth(300)).toBe(300);
    expect(snapThumbnailWidth(312)).toBe(300);
    expect(snapThumbnailWidth(360)).toBe(400);
  });

  it('clamps out-of-range requests to the first and last step', () => {
    expect(snapThumbnailWidth(5)).toBe(THUMBNAIL_WIDTHS[0]);
    expect(snapThumbnailWidth(99_999)).toBe(THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1]);
  });
});

describe('renderThumbnail', () => {
  it('writes a WebP at the requested width', async () => {
    const sourcePath = await makeSource();
    const output = await renderThumbnail({
      sourcePath,
      photoId: 'abc',
      width: 300,
      libraryPath: libraryPath(),
    });

    expect(output).not.toBeNull();
    const metadata = await sharp(await readFile(output as string)).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(300);
  });

  it('reuses the cached file for a repeated request', async () => {
    const sourcePath = await makeSource();
    const request = { sourcePath, photoId: 'abc', width: 300, libraryPath: libraryPath() };

    const first = await renderThumbnail(request);
    const firstStat = await stat(first as string);
    const second = await renderThumbnail(request);
    const secondStat = await stat(second as string);

    expect(second).toBe(first);
    expect(secondStat.mtimeMs).toBe(firstStat.mtimeMs);
  });

  it('keeps separate entries per width and per photo', async () => {
    const sourcePath = await makeSource();
    const base = { sourcePath, libraryPath: libraryPath() };

    const small = await renderThumbnail({ ...base, photoId: 'a', width: 300 });
    const large = await renderThumbnail({ ...base, photoId: 'a', width: 600 });
    const other = await renderThumbnail({ ...base, photoId: 'b', width: 300 });

    expect(new Set([small, large, other]).size).toBe(3);
  });

  it('does not enlarge a source narrower than the requested width', async () => {
    const sourcePath = await makeSource(160, 120);
    const output = await renderThumbnail({
      sourcePath,
      photoId: 'small',
      width: 600,
      libraryPath: libraryPath(),
    });

    expect(output).not.toBeNull();
    const metadata = await sharp(await readFile(output as string)).metadata();
    expect(metadata.width).toBe(160);
  });

  it('returns null instead of throwing when the source cannot be decoded', async () => {
    const sourcePath = path.join(workspace, 'broken.png');
    await writeFile(sourcePath, 'this is not an image');

    const output = await renderThumbnail({
      sourcePath,
      photoId: 'broken',
      width: 300,
      libraryPath: libraryPath(),
    });

    expect(output).toBeNull();
  });

  it('returns null when the source is missing', async () => {
    const output = await renderThumbnail({
      sourcePath: path.join(workspace, 'nope.png'),
      photoId: 'missing',
      width: 300,
      libraryPath: libraryPath(),
    });

    expect(output).toBeNull();
  });
});

describe('thumbnailCacheDir', () => {
  it('lives under the configured data root', () => {
    const directory = thumbnailCacheDir(libraryPath());
    expect(directory.startsWith(dataRoot())).toBe(true);
    expect(directory).toContain(path.join('cache', 'thumbnails'));
  });

  it('is stable for the same library and distinct across libraries', () => {
    expect(thumbnailCacheDir(libraryPath())).toBe(thumbnailCacheDir(libraryPath()));
    expect(thumbnailCacheDir(libraryPath())).not.toBe(
      thumbnailCacheDir(path.join(workspace, 'Other.library')),
    );
  });
});
