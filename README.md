# Kiwi Photo Library

<div align="center">
  <img src="kiwi.png" alt="Kiwi Photo Library" width="160"/>
  <p>A simple web app to browse your <strong>Eagle</strong> photo library.</p>
</div>

---

## What is Kiwi?

Kiwi lets you browse folders, tags, and photos from an existing **Eagle** library (a `.library` folder) in your web browser. After the first setup, you do not need to use the command line for everyday use.

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

### 3. Copy the config file (first time only)

**Windows:**
```text
copy config.example.json config.json
```

**Mac / Linux:**
```bash
cp config.example.json config.json
```

### 4. Point Kiwi at your Eagle library

Open `docker-compose.yml` and edit the library volume to your `.library` folder.

**Windows** (use forward slashes):

```yaml
volumes:
  - C:/Users/YourName/Pictures/MyPhotos.library:/app/data/libraries/MyPhotos.library:ro
  - ./config.json:/app/config.json:rw
```

**Mac:**

```yaml
volumes:
  - /Users/YourName/Pictures/MyPhotos.library:/app/data/libraries/MyPhotos.library:ro
  - ./config.json:/app/config.json:rw
```

**Linux:**

```yaml
volumes:
  - /home/yourname/Pictures/MyPhotos.library:/app/data/libraries/MyPhotos.library:ro
  - ./config.json:/app/config.json:rw
```

To find your library path in Eagle: **Library → Manage library** — the folder shown there is what you need.

### 5. Start Kiwi

**Windows:** double-click **`docker-start.bat`**

**Mac / Linux:** from the Kiwi folder:

```bash
docker compose up -d --build
```

### 6. Open the app

Go to **http://localhost:3000** and follow the setup wizard.

---

## First-time setup in the browser

1. The setup wizard opens automatically.
2. Choose your Eagle library folder (use **Browse** — it appears under the libraries path you mounted in Docker).
3. Wait while Kiwi indexes your photos (a progress message is shown).
4. When finished, browse folders in the sidebar on the left.

**Important:** In the wizard, pick the path **inside the container** (for example `/app/data/libraries/MyPhotos.library`), not your host path like `C:\...` or `/Users/...`.

---

## Daily use

| Action | What to do |
|--------|------------|
| **Start Kiwi** | Ensure Docker is running, then `docker-start.bat` (Windows) or `docker compose up -d` |
| **Browse photos** | Open http://localhost:3000 |
| **Stop Kiwi** | `docker compose down` in the Kiwi folder |

Kiwi keeps your library in sync automatically when you add or change photos in Eagle.

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

---

## Features

- Browse photos by **folders** and **tags**
- **Search** across your library
- **Full-screen** photo view with metadata
- **Dashboard** with library stats and sync activity
- **Dark mode** and customizable accent colors
- Works on desktop and mobile browsers

---

## Screenshots

<div align="center">

| Grid view | Detail view | Tags |
|-----------|-------------|------|
| <img src="sample/gridView.png" alt="Grid View" width="280"/> | <img src="sample/detailedView.png" alt="Detailed View" width="280"/> | <img src="sample/tagMetadata.png" alt="Tags" width="280"/> |

</div>

---

## For developers

If you want to hack on Kiwi locally without Docker:

**Requirements:** Node.js 18+

```bash
npm install
cd server && npm install && cd ..
npm start
```

Open http://localhost:3000. The backend runs on port 3001; Vite proxies API requests.

**Project layout:**

```text
kiwi/
├── src/           React frontend
├── server/        Express API + SQLite sync
├── config.json    Library path and preferences
└── docker-compose.yml
```

---

## License

MIT License — see [LICENSE](LICENSE).
