import { createRequire } from 'node:module';
import path from 'node:path';
import type { KiwiConfig } from '@kiwi/contracts';
import { AppError, errorMessage } from './errors.mjs';
import { ConfigRepository, validateLibraryPath } from './config-repository.mjs';
import { applyMigrations, backupBeforeFirstMigration } from './migrations.mjs';
import { logger } from './logger.mjs';
import type { LegacyDatabase, LegacyDatabaseConstructor, WatcherStatus } from './legacy-types.mjs';

const require = createRequire(import.meta.url);
const PhotoLibraryDatabase = require('../database.cjs') as LegacyDatabaseConstructor;
interface WatcherManager {
  startWatcher(libraryPath: string, database: LegacyDatabase): Promise<void>;
  stopWatcher(): Promise<void>;
  getWatcherStatus(): WatcherStatus;
  setLastReconcileTime(value: string): void;
}
const watcherModule = require('../watcher.cjs') as { createWatcherManager(): WatcherManager };
const sync = require('../librarySync.cjs') as {
  reconcileLibrary(
    database: LegacyDatabase,
    libraryPath: string,
  ): Promise<{ upserted: number; deleted: number }>;
};
const regeneration = require('../regenerateFromLibrary.cjs') as {
  generateDatabaseFromLibrary(options: { libraryPath: string; db: LegacyDatabase }): Promise<unknown>;
};
const tagNetwork = require('../tagNetwork.cjs') as { invalidateTagNetworkCache(): void };

export interface ActiveLibrary {
  path: string;
  databasePath: string;
  database: LegacyDatabase;
}

export class LibraryContextManager {
  private active: ActiveLibrary | null = null;
  private readonly watcher = watcherModule.createWatcherManager();
  private generation = 0;
  private syncTask: Promise<void> | null = null;

  constructor(public readonly configRepository: ConfigRepository) {}

  get current(): ActiveLibrary | null {
    return this.active;
  }

  requireCurrent(): ActiveLibrary {
    if (!this.active) throw new AppError('Library not configured', 503, 'NOT_CONFIGURED');
    return this.active;
  }

  watcherStatus(): WatcherStatus {
    return this.watcher.getWatcherStatus();
  }

  private async prepare(libraryPath: string): Promise<ActiveLibrary> {
    const validation = await validateLibraryPath(libraryPath);
    if (!validation.valid)
      throw new AppError(validation.reason ?? 'Invalid library path', 400, 'VALIDATION_ERROR');
    const roots = await this.configRepository.browseRoots();
    const resolved = path.resolve(libraryPath);
    const isAllowed = roots.some((root) => {
      const relative = path.relative(path.resolve(root), resolved);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
    if (!isAllowed)
      throw new AppError('Library path is outside the configured mount roots', 400, 'VALIDATION_ERROR');

    const databasePath = await this.configRepository.databasePath(resolved);
    await backupBeforeFirstMigration(databasePath);
    const database = new PhotoLibraryDatabase(databasePath);
    try {
      await database.initialize();
      applyMigrations(databasePath);
      return { path: resolved, databasePath, database };
    } catch (error) {
      database.close();
      throw error;
    }
  }

  async initialize(): Promise<void> {
    try {
      const config = await this.configRepository.load();
      if (!config.libraryPath) return;
      this.active = await this.prepare(config.libraryPath);
      const current = this.active;
      const generation = ++this.generation;
      const task = this.syncLibrary(current, generation);
      this.syncTask = task;
      try {
        await task;
      } finally {
        if (this.syncTask === task) this.syncTask = null;
      }
    } catch (error) {
      await this.watcher.stopWatcher();
      this.active?.database.close();
      this.active = null;
      logger.warn(
        { err: error, reason: errorMessage(error) },
        'Configured library is unavailable; setup API remains active',
      );
    }
  }

  async updateConfig(updates: unknown): Promise<KiwiConfig & Record<string, unknown>> {
    const next = await this.configRepository.update(updates);
    const requestedPath = next.libraryPath;
    const pathChanged = requestedPath !== (this.active?.path ?? '');
    if (!pathChanged) {
      await this.configRepository.save(next);
      return next;
    }

    const previous = this.active;
    const prepared = requestedPath ? await this.prepare(requestedPath) : null;
    this.generation++;
    await this.watcher.stopWatcher();
    if (this.syncTask) await this.syncTask.catch(() => undefined);
    try {
      this.active = prepared;
      if (prepared) await this.syncLibrary(prepared, this.generation);
      await this.configRepository.save(next);
      previous?.database.close();
      tagNetwork.invalidateTagNetworkCache();
      return next;
    } catch (error) {
      await this.watcher.stopWatcher();
      prepared?.database.close();
      this.active = previous;
      if (previous) await this.watcher.startWatcher(previous.path, previous.database);
      throw new AppError(`Configuration was not changed: ${errorMessage(error)}`, 409, 'CONFLICT');
    }
  }

  private async syncLibrary(current: ActiveLibrary, generation: number): Promise<void> {
    const stats = await current.database.getStats();
    if (stats.totalPhotos === 0) {
      await regeneration.generateDatabaseFromLibrary({ libraryPath: current.path, db: current.database });
    } else {
      await sync.reconcileLibrary(current.database, current.path);
      this.watcher.setLastReconcileTime(new Date().toISOString());
    }
    if (generation === this.generation && this.active === current) {
      await this.watcher.stopWatcher();
      await this.watcher.startWatcher(current.path, current.database);
      tagNetwork.invalidateTagNetworkCache();
    }
  }

  async rebuild(): Promise<void> {
    this.generation++;
    if (this.syncTask) await this.syncTask.catch(() => undefined);
    const current = this.requireCurrent();
    await this.watcher.stopWatcher();
    try {
      await regeneration.generateDatabaseFromLibrary({ libraryPath: current.path, db: current.database });
      tagNetwork.invalidateTagNetworkCache();
    } finally {
      await this.watcher.startWatcher(current.path, current.database);
    }
  }

  async close(): Promise<void> {
    this.generation++;
    await this.watcher.stopWatcher();
    if (this.syncTask) await this.syncTask.catch(() => undefined);
    this.active?.database.close();
    this.active = null;
  }
}
