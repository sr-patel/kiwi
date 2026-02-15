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
  getLibraryPath,
  getDatabasePath,
  reloadConfig,
} = require('./config-loader');

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
  origin: process.env.NODE_ENV === 'production' ? ['http://localhost:3000'] : true,
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

// --- Global update progress state ---
const updateProgress = {
  status: 'idle', // idle, running, done, error
  totalFiles: 0,
  processedFiles: 0,
  percent: 0,
  eta: null,
  startTime: null,
  elapsed: 0,
  logs: [], // Array of recent log lines
  error: null
};

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
 * Generate complete database from library
 */
async function generateDatabase() {
  const database = getDb();
  if (!database) throw new Error('Database not available');

  console.log('🔄 Generating complete database from library...');
  
  const imagesDir = path.join(LIBRARY_PATH, 'images');
  const entries = await fs.readdir(imagesDir, { withFileTypes: true });
  const photoDirs = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.info'));
  
  console.log(`📊 Processing ${photoDirs.length} photo directories...`);
  
  const batchSize = 100;
  const allPhotos = [];
  const photoFolderRelationships = [];
  
  for (let i = 0; i < photoDirs.length; i += batchSize) {
    const batch = photoDirs.slice(i, i + batchSize);
    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(photoDirs.length / batchSize)} (${batch.length} items)`);
    
    const batchPromises = batch.map(async (entry) => {
      try {
        const fileId = entry.name.replace('.info', '');
        const photoDir = path.join(imagesDir, entry.name);
        
        const metadataPath = path.join(photoDir, 'metadata.json');
        let metadata;
        try {
          const data = await fs.readFile(metadataPath, 'utf8');
          metadata = JSON.parse(data);
        } catch (_) {
          return null; // skip files without metadata
        }
        
        if (metadata) {
          const relationships = [];
          if (metadata.folders && Array.isArray(metadata.folders)) {
            for (const folderId of metadata.folders) {
              relationships.push({ photoId: fileId, folderId });
            }
          }
          return { metadata, relationships };
        }
      } catch (error) {
        console.warn(`⚠️  Failed to process ${entry.name}:`, error.message);
        return null;
      }
      return null;
    });

    const results = await Promise.all(batchPromises);
    const batchPhotos = [];

    for (const res of results) {
      if (res) {
        batchPhotos.push(res.metadata);
        if (res.relationships && res.relationships.length > 0) {
          photoFolderRelationships.push(...res.relationships);
        }
      }
    }
    
    if (batchPhotos.length > 0) {
      await database.insertPhotosBatch(batchPhotos);
      allPhotos.push(...batchPhotos);
    }
  }
  
  if (photoFolderRelationships.length > 0) {
    console.log(`📁 Inserting ${photoFolderRelationships.length} photo-folder relationships...`);
    await database.insertPhotoFolderRelationships(photoFolderRelationships);
  }
  
  await database.updateCacheInfo('last_refresh', new Date().toISOString());
  await database.updateCacheInfo('total_photos', allPhotos.length.toString());
  
  console.log(`✅ Generated database with ${allPhotos.length} photos and ${photoFolderRelationships.length} folder relationships`);
  return allPhotos;
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
 * Get database statistics
 */
async function getDatabaseStats() {
  const database = getDb();
  if (!database) throw new Error('Database not available');

  const stats = await database.getStats();
  const fileTypes = {};
  if (stats.typeStats) {
    stats.typeStats.forEach(typeStat => {
      fileTypes[typeStat.type] = typeStat.count;
    });
  }
  const lastRefresh = await database.getCacheInfo('last_refresh');
  return {
    totalPhotos: stats.totalPhotos,
    dbSize: stats.dbSize,
    totalSize: stats.totalSize,
    lastRefresh,
    fileTypes,
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
          await initializeDatabase();

          // Kick off database build in the background if empty, but don't block response
          checkDatabaseStatus()
            .then((status) => {
              if (!status.exists || status.totalPhotos === 0) {
                console.log('🔄 Database empty after config change, starting background regeneration...');
                return generateDatabase()
                  .then(() => console.log('✅ Background database regeneration after config change completed'))
                  .catch((err) =>
                    console.error('❌ Background database regeneration after config change failed:', err)
                  );
              }
              return undefined;
            })
            .catch((err) => {
              console.error('❌ Failed to check database status after config change:', err);
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

// ─── Library-dependent routes (guarded) ───

// Test endpoint to verify file paths
app.get('/api/test/files/:photoId', requireLibrary, async (req, res) => {
  try {
    const { photoId } = req.params;
    const photoDir = path.join(LIBRARY_PATH, `images/${photoId}.info`);
    
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

// Input validation helper
function validatePhotoId(photoId) {
  if (!photoId || typeof photoId !== 'string') {
    return false;
  }
  // Allow alphanumeric characters and common separators
  return /^[a-zA-Z0-9._-]+$/.test(photoId);
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
    
    // Get all folder IDs from the folder tree (not just from database)
    const getAllFolderIdsFromTree = (folders) => {
      const folderIds = [];
      const traverse = (folderList) => {
        for (const folder of folderList) {
          folderIds.push(folder.id);
          if (folder.children && folder.children.length > 0) {
            traverse(folder.children);
          }
        }
      };
      traverse(folders);
      return folderIds;
    };
    
    const database = getDb();
    const allFolderIds = folderTree ? getAllFolderIdsFromTree(folderTree) : await database.getAllFolderIds();
    const counts = {};
    
    for (const folderId of allFolderIds) {
      counts[folderId] = await database.getRecursivePhotoCountForFolder(folderId, folderTree);
    }
    
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
    res.json(photos);
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
    const photoDir = path.join(LIBRARY_PATH, `images/${id}.info`);
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
    const photoDir = path.join(LIBRARY_PATH, `images/${id}.info`);
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
    
    const filePath = path.join(LIBRARY_PATH, `images/${id}.info/${name}.${ext}`);
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
    
    const thumbnailPath = path.join(LIBRARY_PATH, `images/${id}.info/${name}_thumbnail.png`);
    
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database management endpoints
app.post('/api/database/refresh', requireLibrary, async (req, res) => {
  try {
    console.log('🔄 Manual database refresh requested...');
    
    // Check if user wants to regenerate from library files
    const { source = 'library' } = req.body;
    
    if (source === 'library') {
      console.log('📁 Regenerating database from library files...');
      
      // Import the regeneration function
      const { generateDatabaseFromLibrary } = require('./regenerateFromLibrary');
      
      // Run the regeneration
      await generateDatabaseFromLibrary();
      
      res.json({ 
        success: true, 
        message: 'Database regenerated successfully from library files',
        source: 'library_files'
      });
    } else if (source === 'cache') {
      console.log('⚠️  Database refresh from cache file is not supported via API');
      console.log('   Please run: node server/regenerateFromCache.js');
      res.json({ 
        success: false, 
        message: 'Database refresh from cache file is not supported via API. Please run the regeneration script manually.',
        instructions: 'Run: node server/regenerateFromCache.js'
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Invalid source specified. Use "library" or "cache".'
      });
    }
  } catch (error) {
    console.error('❌ Error refreshing database:', error);
    res.status(500).json({ error: 'Failed to refresh database' });
  }
});

app.post('/api/database/update', requireLibrary, async (req, res) => {
  try {
    console.log('🔄 Manual incremental database update requested...');
    
    // Check if user wants to update from library files
    const { source = 'library' } = req.body;
    
    if (source === 'library') {
      console.log('📁 Performing incremental update from library files...');
      
      // Import the incremental update function
      const { incrementalUpdateDatabase } = require('./incrementalUpdateDatabase');
      
      // Run the incremental update
      await incrementalUpdateDatabase(updateProgress);
      
      res.json({ 
        success: true, 
        message: 'Database updated incrementally from library files',
        source: 'library_files'
      });
    } else {
      console.log('⚠️  Incremental updates are not supported with cache-based database');
      res.json({ 
        success: false, 
        message: 'Incremental updates are not supported with cache-based database',
        instructions: 'To update the database, regenerate it from the cache file'
      });
    }
  } catch (error) {
    console.error('❌ Error updating database:', error);
    res.status(500).json({ error: 'Failed to update database' });
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
      source: 'server-metadata-cache.json',
      message: status.exists ? 'Database is ready' : 'Database is empty - run regeneration script'
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
        action: 'Run: node server/regenerateFromCache.js'
      });
    } else if (status.totalPhotos === 0) {
      recommendations.push({
        type: 'warning',
        message: 'Database has no photos',
        action: 'Run: node server/regenerateFromCache.js'
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
        source: 'server-metadata-cache.json'
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

// Get photo counts for all tags (single query instead of N+1)
app.get('/api/tags/counts', requireLibrary, async (req, res) => {
  try {
    const database = getDb();
    // Try batch method first; fall back to N+1 if not available
    if (typeof database.getTagCounts === 'function') {
      const tagCounts = await database.getTagCounts();
      res.json(tagCounts);
    } else {
      const rows = await database.getAllTags();
      const tagCounts = {};
      for (const row of rows) {
        tagCounts[row.tag] = await database.getPhotoCountForTag(row.tag);
      }
      res.json(tagCounts);
    }
  } catch (error) {
    console.error('❌ Error getting tag counts:', error);
    res.status(500).json({ error: 'Failed to get tag counts' });
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

// API endpoint to get update progress
app.get('/api/database/update-status', (req, res) => {
  res.json(updateProgress);
});

// API endpoint for incremental updates
app.post('/api/database/incremental-update', async (req, res) => {
  try {
    // Check if update is already running
    if (updateProgress.status === 'running') {
      return res.status(409).json({ 
        error: 'Update already in progress',
        message: 'An incremental update is currently running. Please wait for it to complete.'
      });
    }

    // Reset progress state
    updateProgress.status = 'running';
    updateProgress.totalFiles = 0;
    updateProgress.processedFiles = 0;
    updateProgress.percent = 0;
    updateProgress.eta = null;
    updateProgress.startTime = new Date().toISOString();
    updateProgress.elapsed = 0;
    updateProgress.logs = [];
    updateProgress.error = null;

    console.log('🔄 Starting incremental update from admin request...');
    
    // Import and run the incremental update function
    const { incrementalUpdateDatabase } = require('./incrementalUpdateDatabase');
    
    // Run the incremental update asynchronously
    incrementalUpdateDatabase(updateProgress)
      .then(() => {
        updateProgress.status = 'done';
        console.log('✅ Incremental update completed successfully');
      })
      .catch((error) => {
        updateProgress.status = 'error';
        updateProgress.error = error.message;
        console.error('❌ Incremental update failed:', error.message);
      });

    res.json({ 
      success: true, 
      message: 'Incremental update started',
      status: 'running'
    });
    
  } catch (error) {
    console.error('❌ Error starting incremental update:', error);
    updateProgress.status = 'error';
    updateProgress.error = error.message;
    res.status(500).json({ 
      error: 'Failed to start incremental update',
      message: error.message
    });
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

    // Check status and, if empty, start background regeneration instead of blocking startup
    checkDatabaseStatus()
      .then((status) => {
        if (!status.exists || status.totalPhotos === 0) {
          console.log('🔄 Database is empty, starting background regeneration...');
          return generateDatabase()
            .then(() => console.log('✅ Background database generation completed'))
            .catch((err) =>
              console.error('❌ Background database generation failed:', err)
            );
        }

        console.log(`✅ Database ready with ${status.totalPhotos.toLocaleString()} photos`);
        return undefined;
      })
      .catch((err) => {
        console.error('❌ Failed to check database status on startup:', err);
      });

    console.log('🚀 Server ready to serve requests');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    // Don't exit – keep running so the user can reconfigure via API
  }
});

// Graceful shutdown
function shutdown() {
  server.close(() => {
    console.log('Server closed');
    const database = getDb();
    if (database) database.close();
    process.exit(0);
  });
}
process.on('SIGTERM', () => { console.log('SIGTERM received'); shutdown(); });
process.on('SIGINT', () => { console.log('SIGINT received'); shutdown(); });