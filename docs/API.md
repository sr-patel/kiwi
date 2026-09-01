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

### Tag Atlas

`GET /api/tags/network` returns a deterministic, pre-positioned graph. Existing node, link, cluster,
and stats fields remain available. Additive fields expose normalized association scores, node rank and
strength, cluster size, graph version, generation time, candidate-link count, and model build time.

The endpoint accepts the existing `minTagCount`, `minWeight`, `maxNodes`, `megaTagPct`, `pmiThreshold`,
and `maxDegree` parameters. `minScore` (0–1, default `0.12`) controls the blended association threshold.
The score combines normalized PMI, cosine similarity, overlap, and repeated support so rare coincidences
do not dominate communities.

Tag counts and co-occurrences are cached separately from rendered graph presets. Concurrent requests share
one source-data load, derived results use a bounded cache, and library watcher changes invalidate both layers.
