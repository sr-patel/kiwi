# Changelog

## 1.2.0 — 2026-08-21

Kiwi 1.2 modernizes the application while preserving existing Eagle libraries, configuration, SQLite
indexes, routes, media URLs, and workflows.

### Highlights

- Added shared runtime-validated contracts and a typed, cancellable frontend API client.
- Moved frontend server state to TanStack Query and fixed search, pagination, caching, and mobile
  navigation races.
- Added a TypeScript/ESM backend boundary with validated routes, atomic library switching, versioned
  SQLite migrations, migration backups, deterministic random ordering, and safer media resolution.
- Consolidated watcher, synchronization, cache invalidation, and media preloading behavior.
- Added accessible dialogs and controls, keyboard navigation, reduced-motion support, actionable error
  states, and lazy-loaded heavy features.
- Upgraded the Node 22 application stack and removed superseded cache, preload, HTTP, and card
  implementations.
- Hardened the separate frontend and backend containers. Nginx remains the only host-facing gateway on
  port 3000; the backend is internal-only.
- Added formatting, linting, type checking, coverage, integration, Playwright, accessibility, dependency
  audit, container-build, SBOM, and provenance gates.

### Compatibility

- Existing configuration and unknown legacy keys are preserved; only validated known fields affect
  runtime behavior.
- Existing databases migrate automatically and receive a pre-migration backup before the first schema
  upgrade.
- Existing API routes and media URLs remain available. Listing responses add `hasMore` and `totalSize`
  without removing legacy fields or count/size endpoints.
