# Kiwi Photo Library

<div align="center">
  <img src="kiwi.png" alt="Kiwi Photo Library" width="200"/>
</div>


<div align="center">
A modern web client for browsing and managing Eagle photo libraries. Built with React and TypeScript.
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
   cd kiwo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your library**
   Edit `config.json` to point to your photo library:
   ```json
   {
     "libraryPath": "/path/to/your/photo/library",
     "requestPageSize": 50,
     "defaultTheme": "dark",
     "defaultAccentColor": "kiwi"
   }
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`

## 🗄️ Database Management

### Initial Setup
When first setting up your photo library, you need to build the initial database:

```bash
cd server
node fullRebuildDatabase.js
```

This script will:
- Scan your entire photo library
- Extract metadata from all photos
- Build the complete database structure
- Create necessary indexes for optimal performance

### Updating the Database
For subsequent updates when you've added new photos or modified your library:

```bash
cd server
node incrementalUpdateDatabase.js
```

This script will:
- Detect new or modified files
- Update only the changed content
- Maintain existing database structure

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
