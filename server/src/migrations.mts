import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { logger } from './logger.mjs';

interface Migration {
  version: number;
  name: string;
  run(database: Database.Database): void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'establish_schema_version',
    run(database) {
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_photos_random_identity ON photos(id);
        CREATE INDEX IF NOT EXISTS idx_tags_tag_photo_id_v2 ON tags(tag, photo_id);
        CREATE INDEX IF NOT EXISTS idx_photo_folders_folder_photo_v2 ON photo_folders(folder_id, photo_id);
      `);
    },
  },
];

export async function backupBeforeFirstMigration(databasePath: string): Promise<string | null> {
  try {
    const databaseStats = await stat(databasePath);
    if (databaseStats.size === 0) return null;
    const database = new Database(databasePath, { readonly: true });
    try {
      const hasMigrationTable = Boolean(
        database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get(),
      );
      if (hasMigrationTable) return null;

      const backupPath = `${databasePath}.pre-v2-backup`;
      await mkdir(path.dirname(backupPath), { recursive: true });
      await database.backup(backupPath);
      logger.info({ backupPath }, 'Created pre-migration database backup');
      return backupPath;
    } finally {
      database.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export function applyMigrations(databasePath: string): void {
  const database = new Database(databasePath);
  try {
    database.pragma('foreign_keys = ON');
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const applied = new Set(
      database
        .prepare('SELECT version FROM schema_migrations')
        .all()
        .map((row) => (row as { version: number }).version),
    );
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      database.transaction(() => {
        migration.run(database);
        database
          .prepare('INSERT INTO schema_migrations(version, name) VALUES (?, ?)')
          .run(migration.version, migration.name);
      })();
      logger.info({ version: migration.version, name: migration.name }, 'Applied database migration');
    }
  } finally {
    database.close();
  }
}
