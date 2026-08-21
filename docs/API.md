# Kiwi API compatibility

All browser requests use the same origin and `/api` prefix. Errors have a stable JSON shape:

```json
{
  "error": "Invalid request",
  "message": "Invalid request",
  "code": "VALIDATION_ERROR",
  "requestId": "…",
  "issues": [{ "path": "limit", "message": "…" }]
}
```

## Configuration and health

- `GET /api/health`
- `GET /api/config`
- `PUT /api/config`
- `POST /api/config/validate`
- `GET /api/config/browse`
- `GET /api/config/browse-roots`
- `GET /api/sync/status`

Known configuration values are validated. Unknown legacy fields are returned and preserved but cannot establish database or library paths. Browse and selection paths must stay inside configured or mounted roots.

## Library and photos

- `GET /api/library/metadata`, `/mtime`, `/tags`
- `GET /api/photos`
- `GET /api/photos/count`
- `GET /api/photos/:id` and `/metadata`
- `GET /api/photos/:id/file`, `/thumbnail`, `/preview`
- `GET /api/folders/counts`, `/counts/recursive`
- `GET /api/folders/:folderId/count`, `/thumbnail`

Listing endpoints return:

```json
{ "photos": [], "total": 0, "totalSize": 0, "hasMore": false }
```

Existing fields remain. Pagination accepts `limit`, `offset`, `orderBy`, `orderDirection`, and optional `randomSeed`; numeric complexity is clamped to safe bounds. Seeded random order is deterministic in SQLite, so later pages remain stable.

Media query parameters remain accepted for URL compatibility, but the server resolves the actual filename and extension from trusted database metadata. Byte range and long-lived cache behavior remain available. Raw library, database-debug, and test routes are disabled in production.

## Search, tags, and database

- `GET /api/search/photos`, `/count`, `/size`
- `GET /api/tags`, `/counts`, `/network`, `/co-occurrences`
- `GET /api/tags/photos`
- `GET /api/tags/:tag/photos`
- `POST /api/database/refresh` with `{ "source": "library" }`
- `GET /api/database/status`, `/stats`, `/analyze`

Search photo listings use the common listing envelope. The legacy count and size endpoints remain supported.
