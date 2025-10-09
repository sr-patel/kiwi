const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const PhotoLibraryDatabase = require('./database');
const { getLibraryPath, getDatabasePath } = require('./config-loader');

const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3001;

// Configure library path from config
const LIBRARY_PATH = getLibraryPath();

// Database instance
const dbPath = getDatabasePath();
const db = new PhotoLibraryDatabase(dbPath);

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
const RATE_LIMIT_MAX_REQUESTS = 10000; // 10000 requests per minute (very lenient for local development with large libraries)

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

// Serve static files from the library directory
app.use('/library', express.static(LIBRARY_PATH));

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
 * Initialize the database
 */
async function initializeDatabase() {
  try {
    console.log('🗄️  Initializing database...');
    await db.initialize();
    
    // Check if database has data
    const stats = await db.getStats();
    if (stats.totalPhotos === 0) {
      console.log('⚠️  Database is empty. Please run the regeneration script first:');
      console.log('   node server/regenerateFromCache.js');
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
 * Check if database needs to be refreshed by comparing modification times
 */
async function needsDatabaseRefresh() {
  try {
    // Check if database exists
    const dbExists = await fs.access(dbPath).then(() => true).catch(() => false);
    if (!dbExists) {
      console.log('🔄 Database does not exist, needs refresh');
      return { needsRefresh: true, reason: 'database_not_exists' };
    }

    // Get database modification time
    const dbStats = await fs.stat(dbPath);
    const dbTime = dbStats.mtime.getTime();

    // Get images directory modification time
    const imagesDir = path.join(LIBRARY_PATH, 'images');
    const imagesStats = await fs.stat(imagesDir);
    const imagesTime = imagesStats.mtime.getTime();

    // Check if images directory was modified after database
    if (imagesTime > dbTime) {
      console.log('🔄 Images directory modified after database, needs refresh');
      return { needsRefresh: true, reason: 'directory_modified' };
    }

    // Check individual photo directories for changes
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    const modifiedFiles = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.endsWith('.info')) {
        const photoDir = path.join(imagesDir, entry.name);
        try {
          const photoStats = await fs.stat(photoDir);
          if (photoStats.mtime.getTime() > dbTime) {
            modifiedFiles.push(entry.name.replace('.info', ''));
          }
        } catch (error) {
          // Skip if we can't access the directory
        }
      }
    }

    if (modifiedFiles.length > 0) {
      console.log(`🔄 ${modifiedFiles.length} files modified after database, needs incremental update`);
      return { 
        needsRefresh: true, 
        reason: 'files_modified',
        modifiedFiles 
      };
    }

    console.log('✅ Database is up to date');
    return { needsRefresh: false };
  } catch (error) {
    console.log('🔄 Error checking database, will refresh:', error.message);
    return { needsRefresh: true, reason: 'error' };
  }
}

/**
 * Update database with modified files
 */
async function updateDatabaseFiles(fileIds) {
  try {
    console.log(`🔄 Updating ${fileIds.length} files in database...`);
    
    const imagesDir = path.join(LIBRARY_PATH, 'images');
    const updatedPhotos = [];
    
    for (const fileId of fileIds) {
      try {
        const photoDir = path.join(imagesDir, `${fileId}.info`);
        // generateFallbackMetadata removed - skipping file
        console.log(`⚠️  Skipping ${fileId} - generateFallbackMetadata removed`);
        continue;
      } catch (error) {
        console.warn(`⚠️  Failed to update metadata for ${fileId}:`, error.message);
      }
    }
    
    if (updatedPhotos.length > 0) {
      await db.insertPhotosBatch(updatedPhotos);
      console.log(`✅ Updated ${updatedPhotos.length} files in database`);
    }
    
    // Update last refresh time
    await db.updateCacheInfo('last_refresh', new Date().toISOString());
    
    return updatedPhotos.length;
  } catch (error) {
    console.error('❌ Failed to update database files:', error.message);
    throw error;
  }
}

/**
 * Find new files that aren't in the database
 */
async function findNewFiles() {
  try {
    console.log('🔍 Finding new files...');
    
    const imagesDir = path.join(LIBRARY_PATH, 'images');
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    const photoDirs = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.info'));
    
    const existingIds = new Set();
    const existingPhotos = await db.getPhotos();
    existingPhotos.forEach(photo => existingIds.add(photo.id));
    
    const newFileIds = [];
    for (const entry of photoDirs) {
      const fileId = entry.name.replace('.info', '');
      if (!existingIds.has(fileId)) {
        newFileIds.push(fileId);
      }
    }
    
    console.log(`📊 Found ${newFileIds.length} new files out of ${photoDirs.length} total`);
    return newFileIds;
  } catch (error) {
    console.error('❌ Failed to find new files:', error.message);
    throw error;
  }
}

/**
 * Generate complete database from library
 */
async function generateDatabase() {
  try {
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
      
      const batchPhotos = [];
      for (const entry of batch) {
        try {
          const fileId = entry.name.replace('.info', '');
          const photoDir = path.join(imagesDir, entry.name);
          
          // Try to read existing metadata first
          let metadata;
          const metadataPath = path.join(photoDir, 'metadata.json');
          try {
            const data = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(data);
            console.log(`  📄 Read existing metadata for ${fileId}`);
          } catch (error) {
            // If metadata.json doesn't exist or is corrupted, skip file
            console.log(`  ⚠️  Skipping ${fileId} - no metadata.json found`);
            continue;
          }
          
          if (metadata) {
            batchPhotos.push(metadata);
            
            // Extract folder relationships from metadata
            if (metadata.folders && Array.isArray(metadata.folders)) {
              for (const folderId of metadata.folders) {
                photoFolderRelationships.push({
                  photoId: fileId,
                  folderId: folderId
                });
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️  Failed to process ${entry.name}:`, error.message);
        }
      }
      
      if (batchPhotos.length > 0) {
        await db.insertPhotosBatch(batchPhotos);
        allPhotos.push(...batchPhotos);
      }
    }
    
    // Insert photo-folder relationships
    if (photoFolderRelationships.length > 0) {
      console.log(`📁 Inserting ${photoFolderRelationships.length} photo-folder relationships...`);
      await db.insertPhotoFolderRelationships(photoFolderRelationships);
    }
    
    // Update last refresh time
    await db.updateCacheInfo('last_refresh', new Date().toISOString());
    await db.updateCacheInfo('total_photos', allPhotos.length.toString());
    
    console.log(`✅ Generated database with ${allPhotos.length} photos and ${photoFolderRelationships.length} folder relationships`);
    return allPhotos;
  } catch (error) {
    console.error('❌ Failed to generate database:', error.message);
    throw error;
  }
}

/**
 * Get photos from database with optional filtering
 */
async function getPhotosFromDatabase(options = {}) {
  try {
    return await db.getPhotos(options);
  } catch (error) {
    console.error('❌ Failed to get photos from database:', error.message);
    throw error;
  }
}

/**
 * Get photo count from database
 */
async function getPhotoCountFromDatabase(options = {}) {
  try {
    return await db.getPhotoCount(options);
  } catch (error) {
    console.error('❌ Failed to get photo count from database:', error.message);
    throw error;
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  try {
    const stats = await db.getStats();
    
    // Convert typeStats array to fileTypes object
    const fileTypes = {};
    if (stats.typeStats) {
      stats.typeStats.forEach(typeStat => {
        fileTypes[typeStat.type] = typeStat.count;
      });
    }
    
    // Get last refresh time
    const lastRefresh = await db.getCacheInfo('last_refresh');
    
    return {
      totalPhotos: stats.totalPhotos,
      dbSize: stats.dbSize,
      totalSize: stats.totalSize,
      lastRefresh: lastRefresh,
      fileTypes: fileTypes
    };
  } catch (error) {
    console.error('❌ Failed to get database stats:', error.message);
    throw error;
  }
}

/**
 * Check database status (simplified - just check if database exists and has data)
 */
async function checkDatabaseStatus() {
  try {
    const stats = await db.getStats();
    return {
      exists: true,
      totalPhotos: stats.totalPhotos,
      dbSize: stats.dbSize,
      lastRefresh: await db.getCacheInfo('last_refresh')
    };
  } catch (error) {
    return {
      exists: false,
      totalPhotos: 0,
      dbSize: 0,
      lastRefresh: null
    };
  }
}

// Test endpoint to verify file paths
app.get('/api/test/files/:photoId', async (req, res) => {
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
app.get('/api/library/metadata', async (req, res) => {
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

// New endpoint: Get mtime data for caching
app.get('/api/library/mtime', async (req, res) => {
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

app.get('/api/library/tags', async (req, res) => {
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

// New endpoint: Get all photo metadata for folder structure
app.get('/api/photos/metadata', async (req, res) => {
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

app.get('/api/metadata', async (req, res) => {
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

// Get total photo count
app.get('/api/photos/count', async (req, res) => {
  try {
    const count = await db.getPhotoCount();
    res.json({ count });
  } catch (error) {
    console.error('❌ Error getting total photo count:', error);
    res.status(500).json({ error: 'Failed to get total photo count' });
  }
});

// Get photo counts for every folder
app.get('/api/folders/counts', async (req, res) => {
  try {
    const counts = await db.getPhotoCountsByFolder();
    res.json(counts);
  } catch (error) {
    console.error('❌ Error getting folder counts:', error);
    res.status(500).json({ error: 'Failed to get folder counts' });
  }
});

// Get photo count for a specific folder
app.get('/api/folders/:folderId/count', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { recursive = 'false' } = req.query;
    
    let count;
    if (recursive === 'true') {
      // Get recursive count including subfolders
      count = await db.getRecursivePhotoCountForFolder(folderId);
    } else {
      // Get direct count only
      count = await db.getPhotoCountForFolder(folderId);
    }
    
    res.json({ folderId, count, recursive: recursive === 'true' });
  } catch (error) {
    console.error('❌ Error getting folder count:', error);
    res.status(500).json({ error: 'Failed to get folder count' });
  }
});

// Get recursive photo counts for all folders
app.get('/api/folders/counts/recursive', async (req, res) => {
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
    
    const allFolderIds = folderTree ? getAllFolderIdsFromTree(folderTree) : await db.getAllFolderIds();
    const counts = {};
    
    // Get recursive count for each folder
    for (const folderId of allFolderIds) {
      counts[folderId] = await db.getRecursivePhotoCountForFolder(folderId, folderTree);
    }
    
    res.json(counts);
  } catch (error) {
    console.error('❌ Error getting recursive folder counts:', error);
    res.status(500).json({ error: 'Failed to get recursive folder counts' });
  }
});

// Get first thumbnail image for a folder
app.get('/api/folders/:folderId/thumbnail', async (req, res) => {
  try {
    const { folderId } = req.params;
    const firstImage = db.getFirstImageInFolder(folderId);
    
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

// Get paginated photos for a folder (or all)
app.get('/api/photos', async (req, res) => {
  try {
    const folderId = req.query.folderId || null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const orderBy = req.query.orderBy || 'mtime';
    const orderDirection = req.query.orderDirection || 'DESC';
    const randomSeed = req.query.randomSeed ? parseInt(req.query.randomSeed, 10) : undefined;
    const result = await db.getPhotosPaginated({ folderId, limit, offset, orderBy, orderDirection, randomSeed });
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting paginated photos:', error);
    res.status(500).json({ error: 'Failed to get paginated photos' });
  }
});

// Fast search photos with tags support
app.get('/api/search/photos', async (req, res) => {
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
    
    const photos = await db.searchPhotos({ 
      query, type, limit, offset, orderBy, orderDirection, folderId, tagContext: tag 
    });
    
    console.log(`✅ Found ${photos.length} results for search: "${query}"`);
    res.json(photos);
  } catch (error) {
    console.error('❌ Error searching photos:', error);
    res.status(500).json({ error: 'Failed to search photos' });
  }
});

// Get search result count
app.get('/api/search/count', async (req, res) => {
  try {
    const query = req.query.q || '';
    const type = req.query.type || null;
    const folderId = req.query.folderId || null;
    const tag = req.query.tag || null;
    
    const count = await db.getSearchCount({ query, type, folderId, tagContext: tag });
    res.json({ count });
  } catch (error) {
    console.error('❌ Error getting search count:', error);
    res.status(500).json({ error: 'Failed to get search count' });
  }
});

// Get search result total size
app.get('/api/search/size', async (req, res) => {
  try {
    const query = req.query.q || '';
    const type = req.query.type || null;
    const folderId = req.query.folderId || null;
    const tag = req.query.tag || null;
    
    const totalSize = await db.getSearchTotalSize({ query, type, folderId, tagContext: tag });
    res.json({ totalSize });
  } catch (error) {
    console.error('❌ Error getting search total size:', error);
    res.status(500).json({ error: 'Failed to get search total size' });
  }
});

// Debug endpoint to check database content
app.get('/api/debug/database', async (req, res) => {
  try {
    const stats = await db.getStats();
    const samplePhotos = await db.getPhotos({ limit: 5 });
    const sampleTags = await db.getAllTags();
    
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

app.get('/api/photos/:id', async (req, res) => {
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
        const photo = await db.getPhotoById(id);
        if (photo) {
          const folders = await db.getFoldersForPhoto(id);
          const photoMetadata = {
            ...photo,
            folders: folders,
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
    res.status(404).json({ error: 'Photo not found' });
  }
});

// New endpoint: Get photo metadata by ID
app.get('/api/photos/:id/metadata', async (req, res) => {
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
      
      // Add the photo ID to the metadata
      const photoMetadata = {
        ...metadata,
        id: id,
        folders: metadata.folders || [],
        tags: metadata.tags || [],
        isDeleted: metadata.isDeleted || false,
        url: metadata.url || `/api/photos/${id}/file?ext=${metadata.ext}&name=${encodeURIComponent(metadata.name)}`,
        thumbnailUrl: metadata.thumbnailUrl || `/api/photos/${id}/thumbnail?name=${encodeURIComponent(metadata.name)}`
      };
      
      res.json(photoMetadata);
    } catch (error) {
      console.warn(`Failed to read metadata for ${id}:`, error.message);
      
      // Try to get from database
      try {
        const photo = await db.getPhotoById(id);
        if (photo) {
          const folders = await db.getFoldersForPhoto(id);
          const photoMetadata = {
            ...photo,
            id: id,
            folders: folders,
            tags: [], // Database doesn't store tags yet
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

// New endpoint: Get photo file
app.get('/api/photos/:id/file', async (req, res) => {
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

// New endpoint: Get photo thumbnail
app.get('/api/photos/:id/thumbnail', async (req, res) => {
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

// SMB connection test endpoint
app.post('/api/smb/test', async (req, res) => {
  try {
    const { host, port, username, password, share, path: smbPath } = req.body;
    
    // This is a simplified test - in production you'd use a proper SMB library
    const testCommand = `net use \\\\${host}\\${share} /user:${username} ${password}`;
    
    try {
      await execAsync(testCommand);
      res.json({ success: true, message: 'SMB connection successful' });
    } catch (error) {
      res.status(400).json({ success: false, message: 'SMB connection failed' });
    }
  } catch (error) {
    console.error('SMB test error:', error);
    res.status(500).json({ error: 'Failed to test SMB connection' });
  }
});

// List SMB files endpoint
app.post('/api/smb/list', async (req, res) => {
  try {
    const { host, share, path: smbPath } = req.body;
    
    // This would list files from the SMB share
    // For now, return a mock response
    res.json({
      files: [],
      directories: [],
      path: smbPath || '/'
    });
  } catch (error) {
    console.error('SMB list error:', error);
    res.status(500).json({ error: 'Failed to list SMB files' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database management endpoints
app.post('/api/database/refresh', async (req, res) => {
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

app.post('/api/database/update', async (req, res) => {
  try {
    console.log('🔄 Manual incremental database update requested...');
    
    // Check if user wants to update from library files
    const { source = 'library' } = req.body;
    
    if (source === 'library') {
      console.log('📁 Performing incremental update from library files...');
      
      // Import the incremental update function
      const { updateDatabaseIncremental } = require('./updateDatabaseIncremental');
      
      // Run the incremental update
      await updateDatabaseIncremental(updateProgress);
      
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

app.get('/api/database/status', async (req, res) => {
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

app.get('/api/database/stats', async (req, res) => {
  try {
    const stats = await getDatabaseStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    res.status(500).json({ error: 'Failed to get database stats' });
  }
});

app.get('/api/database/analyze', async (req, res) => {
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
app.get('/api/tags', async (req, res) => {
  try {
    const rows = await db.getAllTags();
    const tags = rows.map(row => row.tag).sort((a, b) => a.localeCompare(b));
    res.json(tags);
  } catch (error) {
    console.error('❌ Error getting tags:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

// Get photo counts for all tags
app.get('/api/tags/counts', async (req, res) => {
  try {
    const rows = await db.getAllTags();
    const tagCounts = {};
    
    // Get count for each tag
    for (const row of rows) {
      const count = await db.getPhotoCountForTag(row.tag);
      tagCounts[row.tag] = count;
    }
    
    res.json(tagCounts);
  } catch (error) {
    console.error('❌ Error getting tag counts:', error);
    res.status(500).json({ error: 'Failed to get tag counts' });
  }
});

// Get paginated photos for a tag
app.get('/api/tags/:tag/photos', async (req, res) => {
  try {
    const tag = req.params.tag;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const orderBy = req.query.orderBy || 'mtime';
    const orderDirection = req.query.orderDirection || 'DESC';
    const result = await db.getPhotosByTagPaginated({ tag, limit, offset, orderBy, orderDirection });
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
    const { updateDatabaseIncremental } = require('./updateDatabaseIncremental');
    
    // Run the incremental update asynchronously
    updateDatabaseIncremental(updateProgress)
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
  console.log(`Library files served from: ${LIBRARY_PATH}`);
  
  try {
    // Initialize database
    const dbInitStart = Date.now();
    await initializeDatabase();
    const dbInitTime = ((Date.now() - dbInitStart) / 1000).toFixed(1);
    console.log(`✅ Database initialized successfully (${dbInitTime}s)`);
    
    // Check if database exists and has data
    console.log('📊 Checking database status...');
    const status = await checkDatabaseStatus();
    
    if (!status.exists || status.totalPhotos === 0) {
      // No database or empty database - do full regeneration
      console.log('🔄 Database is empty, performing full regeneration...');
      await generateDatabase();
      console.log('✅ Database generation completed');
    } else {
      // Database exists - just log status, don't run incremental update
      console.log(`✅ Database ready with ${status.totalPhotos.toLocaleString()} photos`);
      console.log('📝 Use the admin page to run incremental updates manually');
    }
    
    console.log('🚀 Server ready to serve requests');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    db.close();
    process.exit(0);
  });
});