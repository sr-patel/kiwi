import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

interface CacheEntry {
  mtimeMs: number;
  folders: unknown[];
}

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 8;

/**
 * Reads the `folders` array out of an Eagle `metadata.json`.
 *
 * Several endpoints need this file (recursive folder counts, dashboard stats,
 * tag name resolution). Each one used to re-read and re-parse it from disk on
 * every request, which on a large library means re-parsing a multi-megabyte
 * document repeatedly. The cache is keyed on the file's mtime so it refreshes
 * as soon as Eagle rewrites it.
 */
export async function readLibraryFolders(libraryPath: string): Promise<unknown[]> {
  const filePath = path.join(libraryPath, 'metadata.json');
  const info = await stat(filePath);

  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === info.mtimeMs) return cached.folders;

  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as { folders?: unknown };
  const folders = Array.isArray(parsed.folders) ? parsed.folders : [];

  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(filePath, { mtimeMs: info.mtimeMs, folders });
  return folders;
}
