# Kiwi operations guide

## Data and migration

Kiwi supports Node.js 22. Configuration is read from `KIWI_DATA_DIR/config.json` (Docker: `/app/data/config.json`) with legacy root/server locations accepted for upgrades. Subsequent writes are atomic and go to the data directory. Unknown legacy keys are preserved, while only validated known keys influence runtime behavior.

The SQLite index remains `photo-library.db` beside a writable local Eagle library. For read-only Docker mounts, it is stored under `/app/data/databases/` using a stable library name and path hash. Migrations are versioned and idempotent. Before the first v2 migration of a non-empty database, Kiwi creates `<database>.pre-v2-backup`. The mounted Eagle library is not migrated or written.

## Backup and restore

Stop Kiwi before copying a live index:

```bash
docker compose stop
```

Back up the complete host `data/` directory. It contains configuration, SQLite databases, WAL files, and pre-migration backups. Back up the Eagle library separately using Eagle’s normal backup process. To restore, keep Kiwi stopped, replace `data/` from the backup, confirm the Eagle mount path, then run `docker compose up -d`.

If an automatic migration must be rolled back, stop Kiwi and replace the database with its `.pre-v2-backup` sibling. Keep the backup until the upgraded library has been checked.

## Local development

```bash
npm ci
npm run dev
```

Set `CONFIG_PATH` to isolate a development configuration, `KIWI_DATA_DIR` to relocate writable state, and `KIWI_LIBRARY_ROOTS` (OS path-delimiter separated) to define selectable library roots. Development CORS accepts only `http://localhost:3000` and `http://127.0.0.1:3000` by default; override with `CORS_ORIGINS`.

## Docker

Only nginx is published at host port 3000. The backend is exposed solely to the private Compose network. Application filesystems are read-only, `/tmp` is a bounded tmpfs, `/app/data` is writable, and every Eagle volume must be mounted read-only.

Validate the deployment:

```bash
docker compose config
docker compose up -d
docker compose ps
curl http://localhost:3000/api/health
```

`docker compose ps` should show no host binding for port 3001.

## Troubleshooting

- **Setup cannot see a library:** ensure its volume target is below `/app/data/libraries`, restart Compose, and use the container path in the setup wizard.
- **Database cannot be opened:** verify the host `data/` directory is writable. Do not make the Eagle mount writable as a workaround.
- **Photos are stale:** check `/api/sync/status`; use Settings → Database maintenance only after confirming the mount is available.
- **Configuration is rejected:** the JSON response includes `VALIDATION_ERROR` plus field issues. Correct the known field; unrelated legacy keys can remain.
- **Upgrade fails:** retain logs and the `.pre-v2-backup`; restore as described above before retrying.
- **Frontend loads but API fails:** access the app through port 3000. Port 3001 is intentionally not published.
