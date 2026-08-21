import { randomUUID, createHash } from 'node:crypto';
import { constants, existsSync } from 'node:fs';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KiwiConfigSchema,
  KiwiConfigUpdateSchema,
  toValidationIssues,
  type KiwiConfig,
} from '@kiwi/contracts';
import { AppError } from './errors.mjs';

type StoredConfig = KiwiConfig & Record<string, unknown>;

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(moduleDirectory, '..');
const repositoryDirectory = path.resolve(serverDirectory, '..');

export function getDataRoot(): string {
  return path.resolve(process.env.KIWI_DATA_DIR ?? path.join(repositoryDirectory, 'data'));
}

function configCandidates(): string[] {
  if (process.env.CONFIG_PATH) return [path.resolve(process.env.CONFIG_PATH)];
  return [
    path.join(getDataRoot(), 'config.json'),
    path.join(repositoryDirectory, 'config.json'),
    path.join(serverDirectory, 'config.json'),
  ];
}

function defaultConfigPath(): string {
  return process.env.CONFIG_PATH
    ? path.resolve(process.env.CONFIG_PATH)
    : path.join(getDataRoot(), 'config.json');
}

function isInside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function writable(directory: string): Promise<boolean> {
  try {
    await access(directory, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export class ConfigRepository {
  private config: StoredConfig | null = null;
  private readPath = defaultConfigPath();

  async load(): Promise<StoredConfig> {
    if (this.config) return this.config;
    const candidate = configCandidates().find(existsSync);
    let raw: unknown = {};
    if (candidate) {
      try {
        raw = JSON.parse(await readFile(candidate, 'utf8'));
      } catch {
        throw new AppError('Configuration file is not valid JSON', 400, 'VALIDATION_ERROR');
      }
    }
    if (candidate) this.readPath = candidate;
    const parsed = KiwiConfigSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        'Configuration contains invalid values',
        400,
        'VALIDATION_ERROR',
        toValidationIssues(parsed.error),
      );
    }
    this.config = parsed.data as StoredConfig;
    return this.config;
  }

  async update(updates: unknown): Promise<StoredConfig> {
    const parsed = KiwiConfigUpdateSchema.safeParse(updates);
    if (!parsed.success) {
      throw new AppError(
        'Configuration contains invalid values',
        400,
        'VALIDATION_ERROR',
        toValidationIssues(parsed.error),
      );
    }
    const current = await this.load();
    return { ...current, ...parsed.data } as StoredConfig;
  }

  async save(config: StoredConfig): Promise<void> {
    const target = defaultConfigPath();
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, target);
    this.config = config;
    this.readPath = target;
  }

  async browseRoots(config?: StoredConfig): Promise<string[]> {
    const activeConfig = config ?? (await this.load());
    const configured = activeConfig.browseRoots.map((root) => path.resolve(root)).filter(existsSync);
    const environment = (process.env.KIWI_LIBRARY_ROOTS ?? '')
      .split(path.delimiter)
      .map((root) => root.trim())
      .filter(Boolean)
      .map((root) => path.resolve(root))
      .filter(existsSync);
    const dockerRoot = '/app/data/libraries';
    const localRoot = path.join(repositoryDirectory, 'example.library');
    const configuredParent = activeConfig.libraryPath
      ? path.dirname(path.resolve(activeConfig.libraryPath))
      : '';
    const developmentRoots = process.env.NODE_ENV === 'production' ? [] : [localRoot];
    const fallbacks = [dockerRoot, configuredParent, ...developmentRoots].filter(
      (root) => root && existsSync(root),
    );
    return [...new Set([...configured, ...environment, ...fallbacks])];
  }

  async resolveBrowsePath(candidate: string): Promise<string | null> {
    const resolved = path.resolve(candidate);
    const roots = await this.browseRoots();
    return roots.some((root) => isInside(resolved, root)) ? resolved : null;
  }

  async databasePath(libraryPath: string): Promise<string> {
    if (await writable(libraryPath)) return path.join(libraryPath, 'photo-library.db');
    const name = path.basename(libraryPath, '.library') || 'library';
    const hash = createHash('sha256').update(path.resolve(libraryPath)).digest('hex').slice(0, 8);
    return path.join(getDataRoot(), 'databases', `${name}-${hash}.db`);
  }
}

export async function validateLibraryPath(
  libraryPath: unknown,
): Promise<{ valid: boolean; reason?: string; hint?: string }> {
  if (typeof libraryPath !== 'string' || libraryPath.trim() === '') {
    return { valid: false, reason: 'Please choose or enter a library folder.' };
  }
  const resolved = path.resolve(libraryPath.trim());
  if (!existsSync(resolved)) return { valid: false, reason: 'We could not find that folder.' };
  if (!existsSync(path.join(resolved, 'metadata.json')) || !existsSync(path.join(resolved, 'images'))) {
    return { valid: false, reason: 'This folder does not look like a complete Eagle library.' };
  }
  return { valid: true };
}
