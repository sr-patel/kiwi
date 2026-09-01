# Kiwi Photo Library

<div align="center">
  <img src="public/kiwi.png" alt="Kiwi Photo Library" width="160"/>
  <p>A simple web app to browse your <strong>Eagle</strong> photo library.</p>
</div>

---

## What is Kiwi?

Kiwi lets you browse folders, tags, and photos from an existing **Eagle** library (a `.library` folder) in your web browser.

---

## What you need

- **[Docker](https://docs.docker.com/get-docker/)** with **Docker Compose** — the recommended way to run Kiwi (Windows, Mac, or Linux)
- An **Eagle library** already created in Eagle (a folder ending in `.library`)
- Eagle can stay installed on your computer; Kiwi reads the same files

---

## Quick start (Docker)

### 1. Install Docker

Install Docker for your system:

- **Windows / Mac:** [Docker Desktop](https://docs.docker.com/get-docker/) is the usual installer
- **Linux:** Docker Engine + Compose plugin ([install guide](https://docs.docker.com/engine/install/))

Make sure Docker is running before you continue.

### 2. Get Kiwi

Download or clone this project to a folder on your computer.

### 3. Point Kiwi at your Eagle library

Open `docker-compose.yml` and edit the library volume to your `.library` folder.

**Windows** (use forward slashes):

```yaml
volumes:
  - ./data:/app/data:rw
  - C:/Users/YourName/Pictures/MyPhotos.library:/app/data/libraries/MyPhotos.library:ro
```

**Mac:**

```yaml
volumes:
  - ./data:/app/data:rw
  - /Users/YourName/Pictures/MyPhotos.library:/app/data/libraries/MyPhotos.library:ro
```

**Linux:**

```yaml
volumes:
  - ./data:/app/data:rw
  - /home/yourname/Pictures/MyPhotos.library:/app/data/libraries/MyPhotos.library:ro
```

`./data` holds your settings (`config.json`) and photo index. The Eagle library stays a separate read-only mount under `data/libraries/`.

To find your library path in Eagle: **Library → Manage library** — the folder shown there is what you need.

### 4. Start Kiwi

Kiwi runs from pre-built images on [GitHub Container Registry](https://github.com/sr-patel/kiwi/pkgs/container/kiwi-backend) (`ghcr.io/sr-patel/kiwi-backend` and `kiwi-frontend`). No local build is required.

**Windows:** double-click **`docker-start.bat`**

**Mac / Linux:** from the Kiwi folder:

```bash
docker compose pull
docker compose up -d
```

### 5. Open the app

Go to **http://localhost:3000** and follow the setup wizard.

Port 3000 is the only host port. The API listens on port 3001 only inside the Compose network and is reached through nginx at the same origin.

---

## First-time setup in the browser

1. The setup wizard opens automatically.
2. Choose your Eagle library folder (use **Browse** — it appears under the libraries path you mounted in Docker).
3. Wait while Kiwi indexes your photos (a progress message is shown).
4. When finished, browse folders in the sidebar on the left.

**Important:** In the wizard, pick the path **inside the container** (for example `/app/data/libraries/MyPhotos.library`), not your host path like `C:\...` or `/Users/...`.

---

## Help & troubleshooting

**The page will not load**

- Is Docker running? (`docker info` should succeed)
- Did you start Kiwi? (`docker-start.bat` or `docker compose up -d`)
- Try http://localhost:3000 after waiting 30 seconds

**I cannot find my library in the setup wizard**

- In Eagle: **Library → Manage library** to see where your `.library` folder lives
- Make sure that folder is mounted in `docker-compose.yml`
- Restart containers after editing `docker-compose.yml`

**Photos are missing or out of date**

- Kiwi syncs changes from Eagle automatically
- For a full refresh: open **Dashboard → Database Maintenance → Run Full Rebuild**

**I changed the library path in Docker**

- Update the volume in `docker-compose.yml`
- Restart: `docker compose down` then start again

**`docker compose pull` fails or image not found**

- Images are published when changes land on the `main` branch (see [Packages](https://github.com/sr-patel/kiwi/pkgs/container/kiwi-backend))

**Database error: "unable to open database file"**

- Ensure `./data` exists and is writable (`docker-start.bat` creates it automatically)
- Restart: `docker compose down` then `docker compose up -d`
- Pull the latest backend image if you recently updated Kiwi

---

## Features

- Browse photos by **folders** and **tags**
- **Search** across your library
- **Full-screen** photo view with metadata
- **Dashboard** with library stats and sync activity
- **Tag Atlas** with fast, stable relationship communities and searchable navigation
- **Dark mode** and customizable accent colors
- Works on desktop and mobile browsers

---

## Development

Kiwi requires Node.js 22. From a clean checkout:

```bash
npm ci
npm run dev
```

The frontend runs at `http://127.0.0.1:3000`; the development API binds to `127.0.0.1:3001`. Useful quality gates are:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:e2e
```

The repository is an npm workspace: the frontend remains at the root, `server/` contains the TypeScript/ESM API boundary, and `packages/contracts/` contains the shared runtime schemas.

## Operations and compatibility

- [Operations, backup, migration, and troubleshooting](docs/OPERATIONS.md)
- [API compatibility reference](docs/API.md)
- [LAN security guidance](docs/SECURITY.md)

Existing configuration and SQLite indexes are opened in place. Before the first schema-version migration, Kiwi creates a sibling `*.pre-v2-backup` file. Eagle library mounts are never modified by migrations.

---

## Screenshots

<div align="center">

| Grid view                                                    | Detail view                                                          | Tags                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| <img src="sample/gridView.png" alt="Grid View" width="280"/> | <img src="sample/detailedView.png" alt="Detailed View" width="280"/> | <img src="sample/tagMetadata.png" alt="Tags" width="280"/> |

</div>

---

### Project layout:

```text
kiwi/
├── data/                    Your settings + index (config.json, databases/)
├── src/                     React frontend
├── server/                  TypeScript/ESM API + SQLite sync
├── packages/contracts/      Shared Zod contracts and inferred types
├── e2e/                     Playwright accessibility/workflow tests
├── docs/                    API, operations, backup, and security guides
├── public/                  Static assets (logo, icons)
├── scripts/                 Dev helpers (start.js, dev-start.bat)
├── config.json              Default settings template (copied to data/ on first Docker run)
├── docker-compose.yml       Run Kiwi (pulls images from GHCR)
└── docker-compose.build.yml   Optional local image build override
```

---

## License

MIT License — see [LICENSE](LICENSE).
