const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const PhotoLibraryDatabase = require('./database');
const {
  loadConfig,
  isConfigured,
  updateConfig,
  validateLibraryPath,
  getBrowseRoots,
  browseDirectories,
  getLibraryPath,
  getDatabasePath,
  reloadConfig,
} = require('./config-loader');
const { reconcileLibrary } = require('./librarySync');
const { startWatcher, stopWatcher, getWatcherStatus, setLastReconcileTime } = require('./watcher');
const { generateDatabaseFromLibrary } = require('./regenerateFromLibrary');

const app = express();
const PORT = process.env.PORT || 3001;

// Lazy-initialized: null until a valid library is configured
let LIBRARY_PATH = getLibraryPath();
let db = null;

function getDb() {
  if (!db) {
    const dbPath = getDatabasePath();
    if (dbPath) {
      db = new PhotoLibraryDatabase(dbPath);
    }
  }
  return db;
}

/**
 * Middleware that blocks library-dependent routes when not configured.
 */
function requireLibrary(req, res, next) {
  if (!LIBRARY_PATH || !isConfigured()) {
    return res.status(503).json({
      error: 'Library not configured',
      setup: true,
      message: 'Please configure your library path via the setup wizard.',
    });
  }
  if (!getDb()) {
    return res.status(503).json({
      error: 'Database not available',
      setup: true,
      message: 'Database is initializing. Please wait.',
    });
  }
  next();
}

// Security middleware
app.use(cors({
  // Allow web frontend, mobile apps, and LAN clients (React Native has no fixed origin)
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting (basic) - very lenient for local development
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10000;

// Periodic cleanup of expired rate-limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap) {
    if (now > data.resetTime) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  } else {
    const clientData = rateLimitMap.get(clientIP);
    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
      clientData.count++;
      if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({ error: 'Too many requests' });
      }
    }
  }
  
  next();
});

// Input validation middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Serve static files from the library directory (dynamic – path may change)
app.use('/library', (req, res, next) => {
  if (!LIBRARY_PATH) {
    return res.status(503).json({ error: 'Library not configured' });
  }
  express.static(LIBRARY_PATH)(req, res, next);
});

/**
 * Initialize the database (only if library is configured)
 */
async function initializeDatabase() {
  const database = getDb();
  if (!database) {
    console.log('⚠️  No library configured – skipping database init');
    return false;
  }

  try {
    console.log('🗄️  Initializing database...');
    await database.initialize();
    
    const stats = await database.getStats();
    if (stats.totalPhotos === 0) {
      console.log('⚠️  Database is empty – will build on first run');
    } else {
      console.log(`✅ Database initialized with ${stats.totalPhotos} photos`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    throw error;
  }
}

/**
 * Full rebuild from library files
 */
async function generateDatabase() {
  const database = getDb();
  if (!database) throw new Error('Database not available');
  return generateDatabaseFromLibrary({ libraryPath: LIBRARY_PATH, db: database });
}

/**
 * Reconcile library, then start the file watcher
 */
async function startLibrarySync() {
  const database = getDb();
  if (!database || !LIBRARY_PATH) return;

  const status = await checkDatabaseStatus();
  if (!status.exists || status.totalPhotos === 0) {
    console.log('🔄 Database is empty, starting full regeneration...');
    await generateDatabase();
  } else {
    console.log('🔄 Reconciling library with database...');
    const result = await reconcileLibrary(database, LIBRARY_PATH);
    setLastReconcileTime(new Date().toISOString());
    console.log(`✅ Reconcile complete — upserted: ${result.upserted}, deleted: ${result.deleted}`);
  }

  await stopWatcher();
  await startWatcher(LIBRARY_PATH, database);
}

/**
 * Get photos from database with optional filtering
 */
async function getPhotosFromDatabase(options = {}) {
  const database = getDb();
  if (!database) throw new Error('Database not available');
  return await database.getPhotos(options);
}

/**
 * Flatten Eagle folder tree into id -> name map
 */
function flattenFolderNames(folders, map = {}) {
  if (!Array.isArray(folders)) return map;
  for (const folder of folders) {
    if (folder?.id) {
      map[folder.id] = folder.name || folder.id;
    }
    if (folder?.children?.length) {
      flattenFolderNames(folder.children, map);
    }
  }
  return map;
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  const database = getDb();
  if (!database) throw new Error('Database not available');

  const [stats, analytics] = await Promise.all([
    database.getStats(),
    database.getDashboardAnalytics(),
  ]);

  const fileTypes = {};
  if (stats.typeStats) {
    stats.typeStats.forEach(typeStat => {
      fileTypes[typeStat.type] = typeStat.count;
    });
  }

  let folderNameMap = {};
  if (LIBRARY_PATH) {
    try {
      const metadataPath = path.join(LIBRARY_PATH, 'metadata.json');
      const metadataData = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataData);
      folderNameMap = flattenFolderNames(metadata.folders || []);
    } catch (error) {
      console.warn('⚠️  Could not read folder names for dashboard stats:', error.message);
    }
  }

  const topFolders = analytics.topFolders.map((row) => ({
    folderId: row.folderId,
    name: folderNameMap[row.folderId] || row.folderId,
    count: row.count,
  }));

  const lastRefresh = await database.getCacheInfo('last_refresh');
  return {
    totalPhotos: stats.totalPhotos,
    totalFolders: stats.totalFolders,
    totalTags: stats.totalTags,
    dbSize: stats.dbSize,
    totalSize: stats.totalSize,
    lastRefresh,
    fileTypes,
    typeStats: stats.typeStats,
    extensionStats: stats.extensionStats,
    analytics: {
      ...analytics,
      topFolders,
    },
  };
}

/**
 * Check database status
 */
async function checkDatabaseStatus() {
  const database = getDb();
  if (!database) {
    return { exists: false, totalPhotos: 0, dbSize: 0, lastRefresh: null };
  }
  try {
    const stats = await database.getStats();
    return {
      exists: true,
      totalPhotos: stats.totalPhotos,
      dbSize: stats.dbSize,
      lastRefresh: await database.getCacheInfo('last_refresh'),
    };
  } catch (error) {
    return { exists: false, totalPhotos: 0, dbSize: 0, lastRefresh: null };
  }
}

// ─── Config API (always available, even in setup mode) ───

/** GET /api/config – return current config + setup status */
app.get('/api/config', (req, res) => {
  const config = loadConfig();
  const configured = isConfigured();
  const validation = configured
    ? { valid: true }
    : validateLibraryPath(config.libraryPath);

  res.json({ ...config, _configured: configured, _validation: validation });
});

/** PUT /api/config – update config and optionally re-initialize */
app.put('/api/config', async (req, res) => {
  try {
    const updates = req.body;
    const merged = updateConfig(updates);

    // If libraryPath changed, re-initialize
    if (updates.libraryPath) {
      LIBRARY_PATH = merged.libraryPath;
      db = null; // reset so getDb() rebuilds it

      if (isConfigured()) {
        try {
          await stopWatcher();
          await initializeDatabase();
          startLibrarySync().catch((err) => {
            console.error('❌ Failed to start library sync after config change:', err);
          });
        } catch (err) {
          console.error('Re-init failed after config change:', err.message);
        }
      }
    }

    res.json({ success: true, config: merged });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

/** POST /api/config/validate – check if a library path is valid */
app.post('/api/config/validate', (req, res) => {
  const { libraryPath } = req.body;
  const result = validateLibraryPath(libraryPath);
  res.json(result);
});

/** GET /api/config/browse – list directories for setup folder picker */
app.get('/api/config/browse', (req, res) => {
  try {
    const requestedPath = req.query.path || null;
    const result = browseDirectories(requestedPath);
    res.json(result);
  } catch (error) {
    console.error('Error browsing directories:', error);
    res.status(500).json({ error: 'Failed to browse directories' });
  }
});

/** GET /api/config/browse-roots – available browse entry points */
app.get('/api/config/browse-roots', (req, res) => {
  res.json({ roots: getBrowseRoots() });
});

// ─── Library-dependent routes (guarded) ───

// Test endpoint to verify file paths
app.get('/api/test/files/:photoId', requireLibrary, async (req, res) => {
  try {
    const { photoId } = req.params;

    // Validate photo ID to prevent path traversal
    if (!validatePhotoId(photoId)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }

    const safePhotoId = path.basename(photoId);
    const photoDir = path.join(LIBRARY_PATH, 'images', `${safePhotoId}.info`);
    
    // Check if directory exists
    const dirExists = await fs.access(photoDir).then(() => true).catch(() => false);
    if (!dirExists) {
      return res.status(404).json({ error: 'Photo directory not found' });
    }
    
    // List files in directory
    const files = await fs.readdir(photoDir);
    
    // Read metadata to get photo name
    const metadataPath = path.join(photoDir, 'metadata.json');
    const metadataData = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(metadataData);
    
    res.json({
      photoId,
      photoName: metadata.name,
      files,
      thumbnailUrl: `/library/images/${photoId}.info/${metadata.name}_thumbnail.png`,
      fullUrl: `/library/images/${photoId}.info/${metadata.name}.${metadata.ext}`
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Validate Eagle photo IDs (alphanumeric, no path separators).
 * @param {string} component
 * @returns {boolean}
 */
function validatePhotoId(component) {
  if (!component || typeof component !== 'string') {
    return false;
  }
  return /^[a-zA-Z0-9._\-+]+$/.test(component) && !component.includes('..');
}

/**
 * Validate file name / extension query params. Eagle filenames may contain
 * spaces, parentheses, tildes, etc. — block path traversal only.
 * @param {string} component
 * @returns {boolean}
 */
function validateFileNameComponent(component) {
  if (!component || typeof component !== 'string') {
    return false;
  }
  if (component.includes('..') || component.includes('/') || component.includes('\\')) {
    return false;
  }
  if (component.includes('\0') || component.length > 255) {
    return false;
  }
  return true;
}

function validateFolderId(folderId) {
  if (!folderId || typeof folderId !== 'string') {
    return false;
  }
  // Allow alphanumeric characters and common separators
  return /^[a-zA-Z0-9._/-]+$/.test(folderId);
}

// API Routes
app.get('/api/library/metadata', requireLibrary, async (req, res) => {
  try {
    const metadataPath = path.join(LIBRARY_PATH, 'metadata.json');
    const data = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(data);
    res.json(metadata);
  } catch (error) {
    console.error('Error reading metadata:', error);
    res.status(500).json({ error: 'Failed to load metadata' });
  }
});

app.get('/api/library/mtime', requireLibrary, async (req, res) => {
  try {
    const mtimePath = path.join(LIBRARY_PATH, 'mtime.json');
    const data = await fs.readFile(mtimePath, 'utf8');
    const mtimeData = JSON.parse(data);
    res.json(mtimeData);
  } catch (error) {
    console.error('Error reading mtime data:', error);
    res.status(500).json({ error: 'Failed to load mtime data' });
  }
});

app.get('/api/library/tags', requireLibrary, async (req, res) => {
  try {
    const tagsPath = path.join(LIBRARY_PATH, 'tags.json');
    const data = await fs.readFile(tagsPath, 'utf8');
    const tags = JSON.parse(data);
    res.json(tags);
  } catch (error) {
    console.error('Error reading tags:', error);
    res.status(500).json({ error: 'Failed to load tags' });
  }
});

app.get('/api/photos/metadata', requireLibrary, async (req, res) => {
  try {
    console.log('🔄 Getting metadata cache...');
    const metadata = await getPhotosFromDatabase();
    console.log(`📦 Returning ${metadata.length} metadata entries from cache`);
    res.json(metadata);
  } catch (error) {
    console.error('❌ Error getting metadata cache:', error);
    res.status(500).json({ error: 'Failed to load metadata cache' });
  }
});

app.get('/api/metadata', requireLibrary, async (req, res) => {
  try {
    console.log('🔄 Getting metadata from database...');
    const metadata = await getPhotosFromDatabase();
    console.log(`📦 Returning ${metadata.length} metadata entries from database`);
    res.json(metadata);
  } catch (error) {
    console.error('❌ Error getting metadata:', error);
    res.status(500).json({ error: 'Failed to get metadata' });
  }
});

app.get('/api/photos/count', requireLibrary, async (req, res) => {
  try {
    const count = await getDb().getPhotoCount();
    res.json({ count });
  } catch (error) {
    console.error('❌ Error getting total photo count:', error);
    res.status(500).json({ error: 'Failed to get total photo count' });
  }
});

app.get('/api/folders/counts', requireLibrary, async (req, res) => {
  try {
    const counts = await getDb().getPhotoCountsByFolder();
    res.json(counts);
  } catch (error) {
    console.error('❌ Error getting folder counts:', error);
    res.status(500).json({ error: 'Failed to get folder counts' });
  }
});

app.get('/api/folders/:folderId/count', requireLibrary, async (req, res) => {
  try {
    const { folderId } = req.params;
    const { recursive = 'false' } = req.query;
    
    let count;
    if (recursive === 'true') {
      // Get recursive count including subfolders
      count = await getDb().getRecursivePhotoCountForFolder(folderId);
    } else {
      count = await getDb().getPhotoCountForFolder(folderId);
    }
    
    res.json({ folderId, count, recursive: recursive === 'true' });
  } catch (error) {
    console.error('❌ Error getting folder count:', error);
    res.status(500).json({ error: 'Failed to get folder count' });
  }
});

app.get('/api/folders/counts/recursive', requireLibrary, async (req, res) => {
  try {
    // First get the folder tree structure
    const metadataPath = path.join(LIBRARY_PATH, 'metadata.json');
    let folderTree = null;
    
    try {
      const metadataData = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataData);
      folderTree = metadata.folders || [];
    } catch (error) {
      console.warn('⚠️  Could not read folder tree from metadata.json:', error.message);
    }
    
    const database = getDb();
    // Use optimized recursive counting that avoids N+1 queries
    const counts = await database.getRecursiveFolderCounts(folderTree);
    
    res.json(counts);
  } catch (error) {
    console.error('❌ Error getting recursive folder counts:', error);
    res.status(500).json({ error: 'Failed to get recursive folder counts' });
  }
});

app.get('/api/folders/:folderId/thumbnail', requireLibrary, async (req, res) => {
  try {
    const { folderId } = req.params;
    const firstImage = getDb().getFirstImageInFolder(folderId);
    
    if (!firstImage) {
      return res.status(404).json({ error: 'No images found in folder' });
    }
    
    res.json({
      id: firstImage.id,
      name: firstImage.name,
      ext: firstImage.ext
    });
  } catch (error) {
    console.error('❌ Error getting folder thumbnail:', error);
    res.status(500).json({ error: 'Failed to get folder thumbnail' });
  }
});

app.get('/api/photos', requireLibrary, async (req, res) => {
  try {
    const folderId = req.query.folderId || null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const orderBy = req.query.orderBy || 'mtime';
    const orderDirection = req.query.orderDirection || 'DESC';
    const randomSeed = req.query.randomSeed ? parseInt(req.query.randomSeed, 10) : undefined;
    const result = await getDb().getPhotosPaginated({ folderId, limit, offset, orderBy, orderDirection, randomSeed });
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting paginated photos:', error);
    res.status(500).json({ error: 'Failed to get paginated photos' });
  }
});

app.get('/api/search/photos', requireLibrary, async (req, res) => {
  try {
    const query = req.query.q || '';
    const type = req.query.type || null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const orderBy = req.query.orderBy || 'mtime';
    const orderDirection = req.query.orderDirection || 'DESC';
    const folderId = req.query.folderId || null;
    const tag = req.query.tag || null;
    
    console.log(`🔍 Searching for: "${query}" (type: ${type}, limit: ${limit}, offset: ${offset}, folderId: ${folderId}, tagCtx: ${tag})`);
    
    const photos = await getDb().searchPhotos({ 
      query, type, limit, offset, orderBy, orderDirection, folderId, tagContext: tag 
    });
    
    console.log(`✅ Found ${photos.length} results for search: "${query}"`);
    const total = await getDb().getSearchCount({ query, type, folderId, tagContext: tag });
    res.json({ photos, total });
  } catch (error) {
    console.error('❌ Error searching photos:', error);
    res.status(500).json({ error: 'Failed to search photos' });
  }
});

app.get('/api/search/count', requireLibrary, async (req, res) => {
  try {
    const query = req.query.q || '';
    const type = req.query.type || null;
    const folderId = req.query.folderId || null;
    const tag = req.query.tag || null;
    
    const count = await getDb().getSearchCount({ query, type, folderId, tagContext: tag });
    res.json({ count });
  } catch (error) {
    console.error('❌ Error getting search count:', error);
    res.status(500).json({ error: 'Failed to get search count' });
  }
});

app.get('/api/search/size', requireLibrary, async (req, res) => {
  try {
    const query = req.query.q || '';
    const type = req.query.type || null;
    const folderId = req.query.folderId || null;
    const tag = req.query.tag || null;
    
    const totalSize = await getDb().getSearchTotalSize({ query, type, folderId, tagContext: tag });
    res.json({ totalSize });
  } catch (error) {
    console.error('❌ Error getting search total size:', error);
    res.status(500).json({ error: 'Failed to get search total size' });
  }
});

app.get('/api/debug/database', requireLibrary, async (req, res) => {
  try {
    const database = getDb();
    const stats = await database.getStats();
    const samplePhotos = await database.getPhotos({ limit: 5 });
    const sampleTags = await database.getAllTags();
    
    res.json({
      stats,
      samplePhotos: samplePhotos.map(p => ({ id: p.id, name: p.name, type: p.type })),
      sampleTags: sampleTags.slice(0, 10),
      totalTags: sampleTags.length
    });
  } catch (error) {
    console.error('❌ Error getting debug info:', error);
    res.status(500).json({ error: 'Failed to get debug info' });
  }
});

app.get('/api/photos/:id', requireLibrary, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate photo ID
    if (!validatePhotoId(id)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }
    const safeId = path.basename(id);
    const photoDir = path.join(LIBRARY_PATH, 'images', `${safeId}.info`);
    const metadataPath = path.join(photoDir, 'metadata.json');
    
    try {
      const data = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(data);
      
      // Add URL fields if they don't exist
      const photoMetadata = {
        ...metadata,
        url: metadata.url || `/api/photos/${id}/file?ext=${metadata.ext}&name=${encodeURIComponent(metadata.name)}`,
        thumbnailUrl: metadata.thumbnailUrl || `/api/photos/${id}/thumbnail?name=${encodeURIComponent(metadata.name)}`
      };
      
      res.json(photoMetadata);
    } catch (error) {
      console.warn(`Failed to read metadata for ${id}:`, error.message);
      
      // Try to get from database
      try {
        const database = getDb();
        const photo = await database.getPhotoById(id);
        if (photo) {
          const folders = await database.getFoldersForPhoto(id);
          const photoMetadata = {
            ...photo,
            folders,
            url: `/api/photos/${id}/file?ext=${photo.ext}&name=${encodeURIComponent(photo.name)}`,
            thumbnailUrl: `/api/photos/${id}/thumbnail?name=${encodeURIComponent(photo.name)}`
          };
          res.json(photoMetadata);
          return;
        }
      } catch (dbError) {
        console.warn(`Failed to get photo from database for ${id}:`, dbError.message);
      }
      
      res.status(404).json({ error: 'Photo not found' });
    }
  } catch (error) {
    console.error('Error reading photo metadata:', error);
    res.status(404).json({ error: 'Photo not found' });
  }
});

app.get('/api/photos/:id/metadata', requireLibrary, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!validatePhotoId(id)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }
    const safeId = path.basename(id);
    const photoDir = path.join(LIBRARY_PATH, 'images', `${safeId}.info`);
    const metadataPath = path.join(photoDir, 'metadata.json');
    
    try {
      const data = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(data);
      
      const photoMetadata = {
        ...metadata,
        id,
        folders: metadata.folders || [],
        tags: metadata.tags || [],
        isDeleted: metadata.isDeleted || false,
        url: metadata.url || `/api/photos/${id}/file?ext=${metadata.ext}&name=${encodeURIComponent(metadata.name)}`,
        thumbnailUrl: metadata.thumbnailUrl || `/api/photos/${id}/thumbnail?name=${encodeURIComponent(metadata.name)}`
      };
      
      res.json(photoMetadata);
    } catch (error) {
      console.warn(`Failed to read metadata for ${id}:`, error.message);
      
      try {
        const database = getDb();
        const photo = await database.getPhotoById(id);
        if (photo) {
          const folders = await database.getFoldersForPhoto(id);
          const photoMetadata = {
            ...photo,
            id,
            folders,
            tags: [],
            isDeleted: false,
            url: `/api/photos/${id}/file?ext=${photo.ext}&name=${encodeURIComponent(photo.name)}`,
            thumbnailUrl: `/api/photos/${id}/thumbnail?name=${encodeURIComponent(photo.name)}`
          };
          res.json(photoMetadata);
          return;
        }
      } catch (dbError) {
        console.warn(`Failed to get photo from database for ${id}:`, dbError.message);
      }
      
      // No fallback metadata generation - return 404
      console.error(`Photo metadata not found for ${id}`);
      res.status(404).json({ error: 'Photo not found' });
    }
  } catch (error) {
    console.error('Error reading photo metadata:', error);
    res.status(404).json({ error: 'Photo metadata not found' });
  }
});

app.get('/api/photos/:id/file', requireLibrary, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate photo ID
    if (!validatePhotoId(id)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }

    const { ext, name } = req.query;
    
    console.log('File request debug:', { id, ext, name });
    
    if (!ext || !name) {
      console.log('Missing parameters:', { ext, name });
      return res.status(400).json({ error: 'Missing ext or name parameter' });
    }

    // Validate parameters to prevent path traversal
    if (!validateFileNameComponent(name) || !validateFileNameComponent(ext)) {
      return res.status(400).json({ error: 'Invalid file name or extension' });
    }
    
    // Security: Sanitize input to prevent path traversal
    const safeId = path.basename(id);
    const safeName = path.basename(name);
    const safeExt = path.basename(ext);

    if (!safeName || !safeExt) {
      return res.status(400).json({ error: 'Invalid name or extension' });
    }

    const filePath = path.join(LIBRARY_PATH, 'images', `${safeId}.info`, `${safeName}.${safeExt}`);
    console.log('Constructed file path:', filePath);
    
    // Check if file exists
    try {
      await fs.access(filePath);
      console.log('File exists:', filePath);
    } catch (error) {
      console.log('File not found:', filePath, error.message);
      return res.status(404).json({ error: 'Photo file not found' });
    }
    
    // Set proper MIME type based on file extension
    const mimeTypes = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff',
      'avif': 'image/avif',
      'jxl': 'image/jxl',
      'heic': 'image/heic',
      'heif': 'image/heif',
      // Videos
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'mkv': 'video/x-matroska',
      'webm': 'video/webm',
      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'opus': 'audio/opus',
      'm4a': 'audio/mp4',
      'wma': 'audio/x-ms-wma',
      // Documents
      'pdf': 'application/pdf',
      'epub': 'application/epub+zip',
      'mobi': 'application/x-mobipocket-ebook'
    };
    
    const mimeType = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    console.log('Setting MIME type:', mimeType);
    
    // Set headers for proper media handling
    res.setHeader('Content-Type', mimeType);
    
    // For audio/video files, set additional headers to prevent download
    if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    }
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving photo file:', error);
    res.status(500).json({ error: 'Failed to serve photo file' });
  }
});

app.get('/api/photos/:id/thumbnail', requireLibrary, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate photo ID
    if (!validatePhotoId(id)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }

    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({ error: 'Missing name parameter' });
    }

    // Validate parameters to prevent path traversal
    if (!validateFileNameComponent(name)) {
      return res.status(400).json({ error: 'Invalid thumbnail name' });
    }
    
    // Security: Sanitize input to prevent path traversal
    const safeId = path.basename(id);
    const safeName = path.basename(name);

    if (!safeName) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    const thumbnailPath = path.join(LIBRARY_PATH, 'images', `${safeId}.info`, `${safeName}_thumbnail.png`);
    
    // Check if thumbnail exists
    try {
      await fs.access(thumbnailPath);
    } catch (error) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }
    
    res.sendFile(thumbnailPath);
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
  }
});

app.get('/api/photos/:id/preview', requireLibrary, async (req, res) => {
  try {
    const { id } = req.params;

    if (!validatePhotoId(id)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }

    const { ext, name } = req.query;

    if (!ext || !name) {
      return res.status(400).json({ error: 'Missing ext or name parameter' });
    }

    if (!validateFileNameComponent(name) || !validateFileNameComponent(ext)) {
      return res.status(400).json({ error: 'Invalid file name or extension' });
    }

    const safeId = path.basename(id);
    const safeName = path.basename(name);
    const safeExt = path.basename(ext).toLowerCase();
    const previewFormats = new Set(['jxl', 'heic', 'heif']);

    if (!previewFormats.has(safeExt)) {
      const filePath = path.join(LIBRARY_PATH, 'images', `${safeId}.info`, `${safeName}.${safeExt}`);
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: 'Photo file not found' });
      }
      return res.sendFile(filePath);
    }

    const thumbnailPath = path.join(LIBRARY_PATH, 'images', `${safeId}.info`, `${safeName}_thumbnail.png`);
    try {
      await fs.access(thumbnailPath);
    } catch {
      return res.status(404).json({ error: 'Preview thumbnail not found' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.sendFile(thumbnailPath);
  } catch (error) {
    console.error('Error serving preview:', error);
    res.status(500).json({ error: 'Failed to serve preview' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sync: getWatcherStatus(),
  });
});

// Sync status
app.get('/api/sync/status', requireLibrary, (req, res) => {
  res.json(getWatcherStatus());
});

// Database management endpoints
app.post('/api/database/refresh', requireLibrary, async (req, res) => {
  try {
    console.log('🔄 Manual database refresh requested...');
    const { source = 'library' } = req.body;

    if (source !== 'library') {
      return res.json({
        success: false,
        message: 'Only library rebuild is supported. Use { "source": "library" }.',
      });
    }

    await stopWatcher();
    await generateDatabaseFromLibrary({ libraryPath: LIBRARY_PATH, db: getDb() });
    await startWatcher(LIBRARY_PATH, getDb());

    res.json({
      success: true,
      message: 'Database regenerated successfully from library files',
      source: 'library_files',
    });
  } catch (error) {
    console.error('❌ Error refreshing database:', error);
    res.status(500).json({ error: 'Failed to refresh database' });
  }
});

app.get('/api/database/status', requireLibrary, async (req, res) => {
  try {
    const status = await checkDatabaseStatus();
    
    res.json({
      exists: status.exists,
      totalPhotos: status.totalPhotos,
      dbSize: status.dbSize,
      lastRefresh: status.lastRefresh,
      source: 'library_files',
      message: status.exists ? 'Database is ready' : 'Database is empty — full rebuild will run on startup',
    });
  } catch (error) {
    console.error('❌ Error getting database status:', error);
    res.status(500).json({ error: 'Failed to get database status' });
  }
});

app.get('/api/database/stats', requireLibrary, async (req, res) => {
  try {
    const stats = await getDatabaseStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    res.status(500).json({ error: 'Failed to get database stats' });
  }
});

app.get('/api/database/analyze', requireLibrary, async (req, res) => {
  try {
    console.log('🔄 Analyzing database...');
    
    const status = await checkDatabaseStatus();
    const stats = status.exists ? await getDatabaseStats() : null;
    
    // Generate recommendations
    const recommendations = [];
    
    if (!status.exists) {
      recommendations.push({
        type: 'error',
        message: 'Database is empty',
        action: 'Restart the server or run a full rebuild from Settings',
      });
    } else if (status.totalPhotos === 0) {
      recommendations.push({
        type: 'warning',
        message: 'Database has no photos',
        action: 'Run a full rebuild from Settings or Admin',
      });
    } else {
      recommendations.push({
        type: 'success',
        message: `Database is healthy with ${status.totalPhotos.toLocaleString()} photos`,
        action: 'Database is ready for use'
      });
    }
    
    if (status.dbSize > 100 * 1024 * 1024) {
      recommendations.push({
        type: 'info',
        message: `Database file is large (${(status.dbSize / 1024 / 1024).toFixed(2)}MB)`,
        action: 'This is normal for large photo libraries'
      });
    }
    
    res.json({
      database: {
        exists: status.exists,
        totalPhotos: status.totalPhotos,
        dbSize: status.dbSize,
        lastRefresh: status.lastRefresh,
        source: 'library_files',
      },
      stats: stats,
      recommendations
    });
  } catch (error) {
    console.error('❌ Error analyzing database:', error);
    res.status(500).json({ error: 'Failed to analyze database' });
  }
});

// Get all unique tags
app.get('/api/tags', requireLibrary, async (req, res) => {
  try {
    const database = getDb();
    const rows = await database.getAllTags();
    const tags = rows.map(row => row.tag).sort((a, b) => a.localeCompare(b));
    res.json(tags);
  } catch (error) {
    console.error('❌ Error getting tags:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

// Get photo counts for all tags (optimized single query)
app.get('/api/tags/counts', requireLibrary, async (req, res) => {
  try {
    const database = getDb();
    const tagCounts = await database.getTagCounts();
    res.json(tagCounts);
  } catch (error) {
    console.error('❌ Error getting tag counts:', error);
    res.status(500).json({ error: 'Failed to get tag counts' });
  }
});

// Get tag co-occurrence graph edges (must be before /api/tags/:tag/photos)
app.get('/api/tags/co-occurrences', requireLibrary, async (req, res) => {
  try {
    const minWeight = req.query.minWeight ? parseInt(req.query.minWeight, 10) : 2;
    const minTagCount = req.query.minTagCount ? parseInt(req.query.minTagCount, 10) : 10;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5000;
    const edges = await getDb().getTagCoOccurrences({ minWeight, minTagCount, limit });
    res.json(edges);
  } catch (error) {
    console.error('❌ Error getting tag co-occurrences:', error);
    res.status(500).json({ error: 'Failed to get tag co-occurrences' });
  }
});

// Get paginated photos for a tag
app.get('/api/tags/:tag/photos', requireLibrary, async (req, res) => {
  try {
    const tag = req.params.tag;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const orderBy = req.query.orderBy || 'mtime';
    const orderDirection = req.query.orderDirection || 'DESC';
    const result = await getDb().getPhotosByTagPaginated({ tag, limit, offset, orderBy, orderDirection });
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting photos for tag:', error);
    res.status(500).json({ error: 'Failed to get photos for tag' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Create server with connection management
const server = require('http').createServer(app);

// Connection management
server.on('connection', (socket) => {
  // Set connection timeout to prevent hanging connections
  socket.setTimeout(30000); // 30 seconds
  
  socket.on('timeout', () => {
    console.log('Connection timeout, closing socket');
    socket.destroy();
  });
  
  socket.on('error', (err) => {
    console.log('Socket error:', err.message);
  });
});

// Start server
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);

  if (!isConfigured()) {
    console.log('⚠️  No valid library configured – running in setup mode');
    console.log('   Open the app in your browser to configure via the setup wizard.');
    console.log('🚀 Server ready (setup mode)');
    return;
  }

  console.log(`Library files served from: ${LIBRARY_PATH}`);

  try {
    const dbInitStart = Date.now();
    await initializeDatabase();
    const dbInitTime = ((Date.now() - dbInitStart) / 1000).toFixed(1);
    console.log(`✅ Database initialized (${dbInitTime}s)`);

    startLibrarySync()
      .then(() => console.log('🚀 Server ready with file watcher active'))
      .catch((err) => console.error('❌ Failed to start library sync:', err));
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    // Don't exit – keep running so the user can reconfigure via API
  }
});

// Graceful shutdown
async function shutdown() {
  await stopWatcher();
  server.close(() => {
    console.log('Server closed');
    const database = getDb();
    if (database) database.close();
    process.exit(0);
  });
}
process.on('SIGTERM', () => { console.log('SIGTERM received'); shutdown(); });
process.on('SIGINT', () => { console.log('SIGINT received'); shutdown(); });