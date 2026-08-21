import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { applyMigrations, backupBeforeFirstMigration } from '../src/migrations.mjs';

let temporaryDirectory: string | null = null;
afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = null;
});

describe('SQLite migrations', () => {
  it('backs up legacy data and applies each migration once', async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'kiwi-migration-'));
    const databasePath = path.join(temporaryDirectory, 'library.db');
    const database = new Database(databasePath);
    database.exec(`
      CREATE TABLE photos(id TEXT PRIMARY KEY);
      CREATE TABLE tags(photo_id TEXT, tag TEXT);
      CREATE TABLE photo_folders(photo_id TEXT, folder_id TEXT);
      INSERT INTO photos(id) VALUES ('kept');
    `);
    database.close();

    const backupPath = await backupBeforeFirstMigration(databasePath);
    expect(backupPath).toBe(`${databasePath}.pre-v2-backup`);
    await expect(stat(backupPath!)).resolves.toMatchObject({ size: expect.any(Number) });

    applyMigrations(databasePath);
    applyMigrations(databasePath);
    await expect(backupBeforeFirstMigration(databasePath)).resolves.toBeNull();
    await expect(backupBeforeFirstMigration(path.join(temporaryDirectory, 'missing.db'))).resolves.toBeNull();
    const emptyPath = path.join(temporaryDirectory, 'empty.db');
    await writeFile(emptyPath, '');
    await expect(backupBeforeFirstMigration(emptyPath)).resolves.toBeNull();
    const migrated = new Database(databasePath, { readonly: true });
    expect(migrated.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({ count: 1 });
    expect(migrated.prepare('SELECT id FROM photos').get()).toEqual({ id: 'kept' });
    migrated.close();
  });
});
