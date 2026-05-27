# Kiwi Photo Library

<div align="center">
  <img src="kiwi.png" alt="Kiwi Photo Library" width="200"/>
</div>

<div align="center">
A modern web client for browsing and managing Eagle photo libraries, built with React and TypeScript.
</div>

## 

<div align="center">

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

## Screenshots

<div align="center" style="display: flex; justify-content: center; align-items: center; gap: 40px; flex-wrap: wrap;">

<div style="text-align: center; max-width: 500px;">
  <img src="sample/gridView.png" alt="Grid View" width="320"/><br>
  <span style="font-weight: normal;">Grid View</span><br>
  <em>Browse photos in a clean, organized grid layout.</em>
</div>

<div style="text-align: center; max-width: 500px;">
  <img src="sample/detailedView.png" alt="Detailed View" width="320"/><br>
  <span style="font-weight: normal;">Detailed View</span><br>
  <em>Full-screen photo viewing with metadata and controls.</em>
</div>

<div style="text-align: center; max-width: 200px;">
  <img src="sample/tagMetadata.png" alt="Tag Management" width="320"/><br>
  <span style="font-weight: normal;">Tag Management</span><br>
  <em>Organize and filter photos using tags and metadata.</em>
</div>

</div>

## Features

### Modern UI and User Experience

- **Responsive design**: Optimized for both desktop and mobile devices.
- **Progressive Web App (PWA)**: Install as a native-like app with offline capabilities.
- **Intuitive navigation**: Sidebar with folder tree and breadcrumb navigation.

### Photo Management

- **Folder organization**: Navigate your photo library using a familiar folder structure.
- **Tag-based filtering**: Browse photos by tags and metadata.
- **Detailed photo modal**: Full-screen photo viewing with metadata and playback controls.

### Advanced Capabilities

- **Fast search**: Quickly search through large photo collections.
- **Caching system**: Intelligent caching for improved performance.
- **Image preloading**: Predictive loading for smooth browsing.
- **Audio player**: Built-in audio playback for supported formats.

### Performance and Scalability

- **Incremental updates**: Efficient database updates without full rebuilds.
- **Memory optimization**: Smart memory management for smooth operation on large libraries.
- **Background processing**: Non-blocking operations for a responsive UI.

## Quick Start

### Prerequisites

- **Node.js** v16 or higher.
- An **Eagle Photo Library** (or a compatible photo library structure).

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd kiwi
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`.

## Database Management

### Initial Setup

On first run, Kiwi automatically detects an empty database and builds it from your Eagle library. No manual CLI commands are required.

You can also trigger a full rebuild or incremental update from the **Admin** page (`/admin`) in the web UI.

### Updating the Database

For subsequent updates when you have added new photos or modified your library:

```bash
cd server
node incrementalUpdateDatabase.js
```

### Database Maintenance Guidelines

- **Performance impact**: The full rebuild process can take significant time for large libraries (for example, hours for 300k+ photos).
- **Resource usage**: Monitor system resources during database operations, especially for large libraries.
- **Backups**: Consider backing up your database before running update scripts.

## Docker Deployment

Docker provides an easy way to run Kiwi Photo Library without installing Node.js or other dependencies directly on your system.

### Quick Start with Docker

1. **Install Docker Desktop**
   - **Windows/macOS**: Download from `https://www.docker.com/products/docker-desktop`.
   - **Linux**: Install via your distribution, for example:

     ```bash
     sudo apt-get install docker.io docker-compose
     ```

2. **Configure your photo library** in `docker-compose.yml`:

   ```yaml
   volumes:
     - /path/to/your/photo/library:/app/data/libraries:rw  # Change this path
   ```

3. **Start the application**

   ```bash
   docker-compose up -d
   ```

4. **Access your library**
   - **Web interface**: `http://localhost` (port 3000).
   - **Stop containers**: `docker-compose down`.

### Container Architecture

The Docker setup uses two containers:

- **Backend**: Processes photos and exposes the API (port 3001).
- **Frontend**: Serves the web interface (port 3000).

## Architecture

### Frontend (React/TypeScript)

- **Framework**: React 18 with TypeScript.
- **Styling**: Tailwind CSS with dark mode support.
- **State management**: Zustand for global state.
- **Routing**: React Router v6.
- **Virtual scrolling**: React Window for high-performance grid rendering.
- **PWA**: Vite PWA plugin with Workbox.

### Backend (Node.js/Express)

- **Runtime**: Node.js with Express.
- **Database**: SQLite with `better-sqlite3`.
- **Media processing**: `sharp` for image operations.
- **Metadata**: EXIF reader for photo metadata extraction.
- **File system**: `fs-extra` for enhanced file operations.

## Project Structure

```text
kiwi/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   │   ├── AudioPlayer/    # Audio playback functionality
│   │   ├── PhotoGrid/      # Photo grid and virtual scrolling
│   │   ├── DetailedView/   # Photo detail modal
│   │   └── ...
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API and utility services
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── server/                # Backend server code
│   ├── database.js        # Database operations
│   ├── index.js           # Express server
│   └── mediaMetadata.js   # Media file processing
├── public/                # Static assets
├── dist/                  # Production build output
└── sample/                # Example screenshots
```

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
