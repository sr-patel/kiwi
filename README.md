# Kiwi Photo Library

<div align="center">
  <img src="kiwi.png" alt="Kiwi Photo Library" width="200"/>
</div>


<div align="center">
A modern web client for browsing and managing Eagle photo libraries. Built with React and TypeScript.
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








## 
<div align="center" style="display: flex; justify-content: center; align-items: center; gap: 40px; flex-wrap: wrap;">

<div style="text-align: center; max-width: 500px#;">
  <img src="sample/gridView.png" alt="Grid View" width="320"/><br>
  <span style="font-weight: normal;">Grid View</span><br>
  <em>Browse photos in a clean, organized grid layout</em>
</div>

<div style="text-align: center; max-width: 500px;">
  <img src="sample/detailedView.png" alt="Detailed View" width="320"/><br>
  <span style="font-weight: normal;">Detailed View</span><br>
  <em>Full-screen photo viewing with metadata and controls</em>
</div>

<div style="text-align: center; max-width: 200px
;">
  <img src="sample/tagMetadata.png" alt="Tag Metadata" width="320"/><br>
  <span style="font-weight: normal;">Tag Management</span><br>
  <em>Organize and filter photos using tags and metadata</em>
</div>

</div>


## ✨ Features

### 🎨 **Modern UI & Experience**

- **Responsive Design** - Optimized for desktop and mobile devices
- **Progressive Web App (PWA)** - Install as a native app with offline capabilities
- **Intuitive Navigation** - Sidebar with folder tree and breadcrumb navigation

### 📸 **Photo Management**
- **Folder Organization** - Navigate through your photo library using folder structure
- **Tag-Based Filtering** - Browse photos by tags and metadata
- **Detailed Photo Modal** - Full-screen photo viewing with metadata and controls

### 🔍 **Advanced Features**
- **Fast Search** - Quick search through your photo collection
- **Caching System** - Intelligent caching for improved performance
- **Image Preloading** - Predictive loading for smooth browsing experience
- **Audio Player** - Built-in audio playback for supported formats

### ⚡ **Performance & Scalability**
- **Incremental Updates** - Efficient database updates without full rebuilds
- **Memory Optimization** - Smart memory management for smooth operation
- **Background Processing** - Non-blocking operations for responsive UI

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **Eagle Photo Library** or compatible photo library structure

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

The application will be available at `http://localhost:5173`

## 🗄️ Database Management

### Initial Setup
On first run, Kiwi automatically detects an empty database and builds it from your Eagle library. No manual CLI commands are required.

You can also trigger a full rebuild or incremental update from the **Admin** page (`/admin`) in the web UI.

### Updating the Database
For subsequent updates when you've added new photos or modified your library:

```bash
cd server
node incrementalUpdateDatabase.js
```

### Database Maintenance Notes

- **Performance Impact**: The full rebuild process can take significant time for large libraries (hours for 300k+ photos)
- **Resource Usage**: Monitor system resources during database operations, especially for large libraries
- **Backup Recommended**: Consider backing up your database before running update scripts

## 🐳 Docker Deployment

Docker makes it easy to run Kiwi Photo Library without installing Node.js or other dependencies directly on your system.

### Quick Start with Docker

1. **Install Docker Desktop:**
   - **Windows/macOS**: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
   - **Linux**: `sudo apt-get install docker.io docker-compose`

2. **Configure your photo library** in `docker-compose.yml`:
   ```yaml
   volumes:
     - /path/to/your/photo/library:/app/data/libraries:rw  # Change this path!
   ```

3. **Start the application:**
   ```bash
   docker-compose up -d
   ```

4. **Access your library:**
   - **Web Interface**: http://localhost (port 3000)
   - **Stop later**: `docker-compose down`

### How Docker Works Here

**Two Containers:**
- **Backend**: Processes your photos and provides the API (port 3001)
- **Frontend**: Serves the web interface (port 3000)



## 🏗️ Architecture

### Frontend (React/TypeScript)
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with dark mode support
- **State Management**: Zustand for global state
- **Routing**: React Router v6
- **Virtual Scrolling**: React Window for performance
- **PWA**: Vite PWA plugin with Workbox

### Backend (Node.js/Express)
- **Runtime**: Node.js with Express server
- **Database**: SQLite with better-sqlite3
- **Media Processing**: Sharp for image operations
- **Metadata**: EXIF reader for photo metadata
- **File System**: fs-extra for enhanced file operations

## 📁 Project Structure

```
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
│   ├── index.js          # Express server
│   └── mediaMetadata.js   # Media file processing
├── public/               # Static assets
├── dist/                # Production build output
└── sample/              # Example screenshots
```


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
