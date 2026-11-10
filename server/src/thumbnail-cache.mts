import { createHash } from 'node:crypto';
import { mkdir, readdir, rename, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getDataRoot } from './config-repository.mjs';
import { logger } from './logger.mjs';

/**
 * Widths a client may request.
 *
 * Requests are snapped to this set, which bounds the number of cache entries a
 * single photo can ever produce and keeps `srcset` URLs predictable.
 */
export const THUMBNAIL_WIDTHS = [200, 300, 400, 600, 800, 1200] as const;

const WEBP_QUALITY = 82;
const PRUNE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

let lastPruneAt = 0;

/** Snaps a requested width to the nearest supported step, or null if absent. */
export function snapThumbnailWidth(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return null;
  return THUMBNAIL_WIDTHS.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
  );
}

export function thumbnailCacheDir(libraryPath: string): string {
  const hash = createHash('sha256').update(path.resolve(libraryPath)).digest('hex').slice(0, 16);
  return path.join(getDataRoot(), 'cache', 'thumbnails', hash);
}

const inFlight = new Map<string, Promise<string | null>>();

/**
 * Renders (or reuses) a resized WebP for a photo thumbnail.
 *
 * Returns the cached file path, or null when resizing is unavailable — a
 * read-only data directory or an undecodable source both fall back to serving
 * the original thumbnail so the grid never breaks.
 */
export async function renderThumbnail(options: {
  sourcePath: string;
  photoId: string;
  width: number;
  libraryPath: string;
}): Promise<string | null> {
  const directory = thumbnailCacheDir(options.libraryPath);
  const target = path.join(directory, `${options.photoId}-${options.width}.webp`);

  const pending = inFlight.get(target);
  if (pending) return pending;

  const task = (async (): Promise<string | null> => {
    try {
      const sourceInfo = await stat(options.sourcePath);
      const targetInfo = await stat(target).catch(() => null);
      // Eagle stamps the thumbnail file when it regenerates it, so mtime is a
      // cheap and reliable freshness check.
      if (targetInfo && targetInfo.mtimeMs >= sourceInfo.mtimeMs) return target;

      await mkdir(directory, { recursive: true });
      const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
      try {
        await sharp(options.sourcePath, { failOn: 'none' })
          .rotate()
          .resize({ width: options.width, withoutEnlargement: true, fit: 'inside' })
          .webp({ quality: WEBP_QUALITY, effort: 3 })
          .toFile(temporary);
        await rename(temporary, target);
      } finally {
        // A failed encode can leave a partial file behind.
        await rm(temporary, { force: true }).catch(() => undefined);
      }
      return target;
    } catch (error) {
      logger.warn(
        { err: error, photoId: options.photoId, width: options.width },
        'Thumbnail resize failed; serving the original thumbnail',
      );
      return null;
    } finally {
      inFlight.delete(target);
    }
  })();

  inFlight.set(target, task);
  return task;
}

/** Opportunistic cleanup of stale cache entries; runs at most once an hour. */
export async function pruneThumbnailCache(libraryPath: string): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;

  const directory = thumbnailCacheDir(libraryPath);
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return; // Cache has not been written yet.
  }

  const cutoff = now - PRUNE_MAX_AGE_MS;
  await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry);
      try {
        const info = await stat(filePath);
        if (info.mtimeMs < cutoff) await unlink(filePath);
      } catch {
        // A concurrent request may have replaced or removed it.
      }
    }),
  );
}
