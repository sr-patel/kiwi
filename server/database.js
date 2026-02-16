const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs').promises;

class PhotoLibraryDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.preparedStatements = new Map(); // Cache for prepared statements
  }

  /**
   * Initialize the database and create tables if they don't exist
   */
  async initialize() {
    try {
      console.log('🗄️  Initializing SQLite database...');
      
      // Ensure the directory exists
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });
      
      // Open database
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000');      // 64MB cache (negative = KB)
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('mmap_size = 268435456');    // 256MB memory-mapped I/O
      this.db.pragma('page_size = 4096');         // Better for mixed read/write
      this.db.pragma('auto_vacuum = INCREMENTAL'); // Auto-vacuum for maintenance
      this.db.pragma('optimize');                 // Optimize database after configuration
      
      // Migration: add metadata_hash column if it doesn't exist
      try {
        const colCheck = this.db.prepare("PRAGMA table_info(photos)").all();
        if (!colCheck.some(col => col.name === 'metadata_hash')) {
          this.db.exec('ALTER TABLE photos ADD COLUMN metadata_hash TEXT');
          console.log('✅ Added metadata_hash column to photos table');
        }
      } catch (e) {
        console.error('❌ Failed to add metadata_hash column:', e.message);
      }
      
      // Create tables
      await this.createTables();
      
      console.log('✅ Database initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize database:', error.message);
      throw error;
    }
  }

  /**
   * Get or create a prepared statement with caching
   */
  getStatement(key, sql) {
    if (!this.preparedStatements.has(key)) {
      this.preparedStatements.set(key, this.db.prepare(sql));
    }
    return this.preparedStatements.get(key);
  }

  /**
   * Performance monitoring utility
   */
  logPerformanceMetrics(operation, startTime, itemCount = 0) {
    const duration = Date.now() - startTime;
    const itemsPerSecond = itemCount > 0 ? Math.round((itemCount / duration) * 1000) : 0;
    console.log(`⚡ ${operation}: ${duration}ms${itemCount > 0 ? ` (${itemsPerSecond} items/sec)` : ''}`);
  }

  /**
   * Validates and normalizes the sort direction.
   * @param {string} direction - The sort direction (ASC or DESC)
   * @returns {string} - 'ASC' or 'DESC'
   */
  _validateDirection(direction) {
    if (!direction) return 'DESC';
    const upper = String(direction).toUpperCase();
    return (upper === 'ASC' || upper === 'DESC') ? upper : 'DESC';
  }

  /**
   * Generates an ORDER BY SQL clause based on the provided sort parameters.
   * This centralizes sorting logic and ensures consistent behavior (like natural sorting for names).
   */
  getOrderByClause(orderBy, options = {}) {
    const { tableAlias = '', randomSeed = null } = options;
    const prefix = tableAlias ? `${tableAlias}.` : '';

    switch (orderBy) {
      case 'name':
        return `CAST(
          CASE
            WHEN ${prefix}name GLOB '[0-9]*' THEN
              CASE
                WHEN INSTR(${prefix}name, '.') > 0 THEN
                  SUBSTR(${prefix}name, 1, INSTR(${prefix}name, '.') - 1)
                ELSE ${prefix}name
              END
            ELSE NULL
          END AS INTEGER
        ) ASC NULLS LAST, ${prefix}name COLLATE NOCASE`;
      case 'date':
        return `${prefix}date_time`;
      case 'date_created':
        return `${prefix}created_at`;
      case 'date_updated':
        return `${prefix}updated_at`;
      case 'size':
        return `${prefix}size`;
      case 'type':
        return `${prefix}ext`;
      case 'dimensions':
        return `${prefix}width * ${prefix}height`;
      case 'tags':
        // Count tags for the photo; assumes 'tags' table exists and links via photo_id
        return `(SELECT COUNT(*) FROM tags WHERE photo_id = ${prefix}id)`;
      case 'random':
        if (randomSeed) {
          // Use seeded random for consistent results if provided
          const seed = parseFloat(randomSeed) || 0;
          return `(RANDOM() * ${seed}) % 1`;
        }
        return 'RANDOM()';
      case 'mtime':
      default:
        return `${prefix}mtime`;
    }
  }

  /**
   * Create database tables
   */
  async createTables() {
    const createPhotosTable = `
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ext TEXT NOT NULL,
        size INTEGER NOT NULL,
        mtime TEXT NOT NULL,
        type TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        duration REAL,
        fps TEXT,
        codec TEXT,
        audio_codec TEXT,
        bitrate INTEGER,
        sample_rate INTEGER,
        channels INTEGER,
        exif_data TEXT,
        gps_latitude REAL,
        gps_longitude REAL,
        gps_altitude REAL,
        camera TEXT,
        date_time TEXT,
        btime TEXT,
        url TEXT,
        annotation TEXT,
        metadata_hash TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createTagsTable = `
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
        UNIQUE(photo_id, tag)
      )
    `;

    const createPhotoFoldersTable = `
      CREATE TABLE IF NOT EXISTS photo_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_id TEXT NOT NULL,
        folder_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
        UNIQUE(photo_id, folder_id)
      )
    `;

    const createCacheInfoTable = `
      CREATE TABLE IF NOT EXISTS cache_info (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      this.db.exec(createPhotosTable);
      this.db.exec(createTagsTable);
      this.db.exec(createPhotoFoldersTable);
      this.db.exec(createCacheInfoTable);
      
      // Create indexes for better performance
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(type)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_mtime ON photos(mtime)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_name ON photos(name)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_tags_photo_id ON tags(photo_id)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photo_folders_photo_id ON photo_folders(photo_id)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photo_folders_folder_id ON photo_folders(folder_id)');
      
      // Enhanced composite indexes for complex queries
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_type_mtime ON photos(type, mtime)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_size_type ON photos(size, type)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_date_type ON photos(date_time, type)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_tags_tag_photo_id ON tags(tag, photo_id)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photo_folders_folder_photo ON photo_folders(folder_id, photo_id)');
      
      // Covering index for common photo listing queries
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_listing ON photos(type, mtime, id, name, size)');
      
    // Index for folder thumbnail queries
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_image_files ON photos(ext) WHERE LOWER(ext) IN (\'jpg\', \'jpeg\', \'png\', \'gif\', \'webp\', \'bmp\', \'svg\', \'tiff\', \'tif\', \'avif\')');
    
    // Additional indexes for search performance
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_name_lower ON photos(LOWER(name))');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_photos_camera_lower ON photos(LOWER(camera))');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_tags_tag_lower ON tags(LOWER(tag))');
      
      console.log('✅ Database tables created successfully');
    } catch (error) {
      console.error('❌ Failed to create tables:', error.message);
      throw error;
    }
  }

  /**
   * Insert or update a photo record
   */
  async upsertPhoto(photoData) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO photos (
        id, name, ext, size, mtime, type, width, height, duration, fps, codec,
        audio_codec, bitrate, sample_rate, channels, exif_data, gps_latitude,
        gps_longitude, gps_altitude, camera, date_time, created_at, updated_at, metadata_hash, btime, url, annotation
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    try {
      const exifData = photoData.exif ? JSON.stringify(photoData.exif) : null;
      // Use actual timestamps from metadata, fallback to current time
      const createdAt = photoData.created_at || (photoData.btime ? new Date(photoData.btime).toISOString() : new Date().toISOString());
      const updatedAt = photoData.updated_at || (photoData.modificationTime ? new Date(photoData.modificationTime).toISOString() : new Date().toISOString());
      
      stmt.run(
        photoData.id,
        photoData.name,
        photoData.ext,
        photoData.size,
        photoData.mtime,
        photoData.type || 'unknown',
        photoData.width,
        photoData.height,
        photoData.duration,
        photoData.fps,
        photoData.codec,
        photoData.audioCodec,
        photoData.bitrate,
        photoData.sampleRate,
        photoData.channels,
        exifData,
        photoData.gps?.latitude,
        photoData.gps?.longitude,
        photoData.gps?.altitude,
        photoData.camera,
        photoData.dateTime,
        createdAt,
        updatedAt,
        photoData.metadata_hash || null,
        photoData.btime ? (typeof photoData.btime === 'number' ? new Date(photoData.btime).toISOString() : photoData.btime) : null,
        photoData.url || '',
        photoData.annotation || ''
      );
      return true;
    } catch (error) {
      console.error('❌ Failed to upsert photo:', error.message);
      throw error;
    }
  }

  /**
   * Insert multiple photos in a transaction
   */
  async insertPhotosBatch(photosData) {
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO photos (
        id, name, ext, size, mtime, type, width, height, duration, fps, codec,
        audio_codec, bitrate, sample_rate, channels, exif_data, gps_latitude,
        gps_longitude, gps_altitude, camera, date_time, created_at, updated_at, metadata_hash, btime, url, annotation
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    try {
      const transaction = this.db.transaction((photos) => {
        for (const photoData of photos) {
          const exifData = photoData.exif ? JSON.stringify(photoData.exif) : null;
          // Use actual timestamps from metadata, fallback to current time
          const createdAt = photoData.created_at || (photoData.btime ? new Date(photoData.btime).toISOString() : new Date().toISOString());
          const updatedAt = photoData.updated_at || (photoData.modificationTime ? new Date(photoData.modificationTime).toISOString() : new Date().toISOString());
          
          insertStmt.run(
            photoData.id,
            photoData.name,
            photoData.ext,
            photoData.size,
            photoData.mtime,
            photoData.type || 'unknown',
            photoData.width,
            photoData.height,
            photoData.duration,
            photoData.fps,
            photoData.codec,
            photoData.audioCodec,
            photoData.bitrate,
            photoData.sampleRate,
            photoData.channels,
            exifData,
            photoData.gps?.latitude,
            photoData.gps?.longitude,
            photoData.gps?.altitude,
            photoData.camera,
            photoData.dateTime,
            createdAt,
            updatedAt,
            photoData.metadata_hash || null,
            photoData.btime ? (typeof photoData.btime === 'number' ? new Date(photoData.btime).toISOString() : photoData.btime) : null,
            photoData.url || '',
            photoData.annotation || ''
          );
        }
      });
      transaction(photosData);
      return true;
    } catch (error) {
      console.error('❌ Failed to insert photos batch:', error.message);
      throw error;
    }
  }

  /**
   * Get all photos with optional filtering
   */
  async getPhotos(options = {}) {
    const {
      type = null,
      limit = null,
      offset = 0,
      orderBy = 'mtime',
      orderDirection = 'DESC',
      search = null
    } = options;

    let query = 'SELECT * FROM photos';
    const params = [];
    const conditions = [];

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (search) {
      conditions.push('(name LIKE ? OR camera LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const orderByClause = this.getOrderByClause(orderBy);
    const validatedDirection = this._validateDirection(orderDirection);
    query += ` ORDER BY ${orderByClause} ${validatedDirection}`;

    if (limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    try {
      const stmt = this.db.prepare(query);
      const photos = stmt.all(...params);
      
      // Parse EXIF data back to objects
      return photos.map(photo => ({
        ...photo,
        exif: photo.exif_data ? JSON.parse(photo.exif_data) : null,
        gps: photo.gps_latitude ? {
          latitude: photo.gps_latitude,
          longitude: photo.gps_longitude,
          altitude: photo.gps_altitude
        } : null
      }));
    } catch (error) {
      console.error('❌ Failed to get photos:', error.message);
      throw error;
    }
  }

  /**
   * Get a single photo by ID
   */
  async getPhotoById(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM photos WHERE id = ?');
      const photo = stmt.get(id);
      
      if (!photo) {
        return null;
      }

      return {
        ...photo,
        exif: photo.exif_data ? JSON.parse(photo.exif_data) : null,
        gps: photo.gps_latitude ? {
          latitude: photo.gps_latitude,
          longitude: photo.gps_longitude,
          altitude: photo.gps_altitude
        } : null
      };
    } catch (error) {
      console.error('❌ Failed to get photo by ID:', error.message);
      throw error;
    }
  }

  /**
   * Get photo count
   */
  async getPhotoCount(options = {}) {
    const { type = null, search = null } = options;

    let query = 'SELECT COUNT(*) as count FROM photos';
    const params = [];
    const conditions = [];

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (search) {
      conditions.push('(name LIKE ? OR camera LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    try {
      const stmt = this.db.prepare(query);
      const result = stmt.get(...params);
      return result.count;
    } catch (error) {
      console.error('❌ Failed to get photo count:', error.message);
      throw error;
    }
  }

  /**
   * Fast search photos with tags support
   */
  async searchPhotos(options = {}) {
    const {
      query = '',
      type = null,
      limit = 50,
      offset = 0,
      orderBy = 'mtime',
      orderDirection = 'DESC',
      folderId = null,
      tagContext = null
    } = options;

    if (!query.trim()) {
      // If no search query, fall back to regular getPhotos
      return this.getPhotos({ type, limit, offset, orderBy, orderDirection });
    }

    // First, get all available tags to check for exact matches
    console.log('🔍 About to call getAllTags... VERSION 2.0');
    const allTags = await this.getAllTags();
    console.log('🔍 getAllTags result:', { type: typeof allTags, length: allTags?.length, firstItem: allTags?.[0] });
    console.log('🔍 getAllTags is array:', Array.isArray(allTags));
    
    // Create tag set - getAllTags returns [{tag: "tag1"}, {tag: "tag2"}, ...]
    const tagSet = new Set();
    if (Array.isArray(allTags)) {
      for (const tagRow of allTags) {
        if (tagRow && typeof tagRow.tag === 'string') {
          tagSet.add(tagRow.tag.toLowerCase());
        }
      }
    }
    
    console.log('🔍 Available tags sample:', Array.from(tagSet).slice(0, 10));
    console.log('🔍 Looking for tag:', query, 'in set:', tagSet.has(query.toLowerCase()));

    // Parse query to separate content and tag searches
    // Handle explicit tag: prefixes with proper multi-word support
    const contentParts = [];
    const tagParts = [];
    
    // Split by 'tag:' to find all tag sections
    const parts = query.split(/(?=tag:)/g);
    console.log('🔍 Parts after tag: split:', parts);
    
    for (const part of parts) {
      if (part.startsWith('tag:')) {
        // This is a tag section, extract the tag content
        const tagContent = part.replace(/^tag:/, '').trim();
        if (tagContent) {
          tagParts.push(tagContent);
        }
      } else if (part.trim()) {
        // This is content, process for implicit tag detection
        const contentWords = part.trim().split(/\s+/).filter(Boolean);
        
        for (let i = 0; i < contentWords.length; i++) {
          const word = contentWords[i];
          
          // Check if this word (or combination of words) matches an existing tag
          let potentialTag = word;
          let j = i;
          let foundMultiWordTag = false;
          
          // Try to find the longest possible tag match starting from this position
          while (j < contentWords.length) {
            const testTag = contentWords.slice(i, j + 1).join(' ');
            if (typeof testTag === 'string' && tagSet.has(testTag.toLowerCase())) {
              potentialTag = testTag;
              foundMultiWordTag = true;
              // Don't break here - continue to find the longest match
            }
            j++;
          }
          
          // If we found a tag match, add it to tagParts
          if (typeof potentialTag === 'string' && tagSet.has(potentialTag.toLowerCase())) {
            tagParts.push(potentialTag);
            // Skip the parts we've consumed for the multi-word tag
            if (foundMultiWordTag && potentialTag.includes(' ')) {
              const consumedParts = potentialTag.split(' ').length - 1;
              i += consumedParts; // Skip the additional parts
            }
          } else {
            // Otherwise, treat as content
            contentParts.push(word);
          }
        }
      }
    }
    
    const contentQueryFinal = contentParts.join(' ');
    const tagQuery = tagParts.join(' ');
    
    console.log('🔍 Parsed search query:', { 
      originalQuery: query, 
      contentQuery: contentQueryFinal, 
      tagParts, 
      tagQuery,
      allTagsCount: allTags.length
    });
    
    console.log('🔍 DEBUG: tagParts length:', tagParts.length);
    console.log('🔍 DEBUG: tagParts content:', tagParts);

    // Build SQL based on what we're searching for
    let sql;
    let params = [];

    // Handle sorting using the central helper
    const orderByClause = this.getOrderByClause(orderBy, { tableAlias: 'p' });
    const validatedDirection = this._validateDirection(orderDirection);
    
    console.log('🔍 Order by debug:', { orderBy, orderByClause });
    const folderFilterSql = folderId ? ' AND EXISTS (SELECT 1 FROM photo_folders pf WHERE pf.photo_id = p.id AND pf.folder_id = ?)' : '';
    const tagContextSql = tagContext ? ' AND EXISTS (SELECT 1 FROM tags tctx WHERE tctx.photo_id = p.id AND tctx.tag LIKE ?)' : '';

    console.log('🔍 DEBUG: contentQueryFinal:', contentQueryFinal);
    console.log('🔍 DEBUG: tagParts.length:', tagParts.length);

    if (contentQueryFinal && tagParts.length > 0) {
      // Search both content and tags - use parsed tagParts directly
      if (tagParts.length === 1) {
        // Single tag with content search
        sql = `
          SELECT p.*, (
            SELECT GROUP_CONCAT(t2.tag) 
            FROM tags t2 
            WHERE t2.photo_id = p.id
          ) as tags
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          ) AND (LOWER(p.name) LIKE ? OR LOWER(p.camera) LIKE ?)
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
          ORDER BY ${orderByClause} ${validatedDirection}
          LIMIT ? OFFSET ?
        `;
        const contentTerm = `%${contentQueryFinal.toLowerCase()}%`;
        params = [tagParts[0].toLowerCase(), contentTerm, contentTerm];
        if (type) params.push(type);
        if (folderId) params.push(folderId);
        if (tagContext) params.push(`%${tagContext}%`);
        params.push(limit, offset);
      } else {
        // Multiple tags with content search
        sql = `
          SELECT p.*, (
            SELECT GROUP_CONCAT(t2.tag) 
            FROM tags t2 
            WHERE t2.photo_id = p.id
          ) as tags
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          )
          ${tagParts.length > 1 ? tagParts.slice(1).map(() => 'AND EXISTS (SELECT 1 FROM tags t3 WHERE t3.photo_id = p.id AND LOWER(t3.tag) = ?)').join(' ') : ''}
          AND (LOWER(p.name) LIKE ? OR LOWER(p.camera) LIKE ?)
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
          ORDER BY ${orderByClause} ${validatedDirection}
          LIMIT ? OFFSET ?
        `;
        const contentTerm = `%${contentQueryFinal.toLowerCase()}%`;
        const tagTerms = tagParts.map(tag => tag.toLowerCase());
        params = [...tagTerms, contentTerm, contentTerm];
        if (type) params.push(type);
        if (folderId) params.push(folderId);
        if (tagContext) params.push(`%${tagContext}%`);
        params.push(limit, offset);
      }
    } else if (tagParts.length > 0) {
      // Search only tags - use parsed tagParts directly
      console.log('🔍 DEBUG: Taking tags-only branch');
      if (tagParts.length === 1) {
        // Single tag - search for exact match
        sql = `
          SELECT p.*, (
            SELECT GROUP_CONCAT(t2.tag) 
            FROM tags t2 
            WHERE t2.photo_id = p.id
          ) as tags
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          )
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
          ORDER BY ${orderByClause} ${validatedDirection}
          LIMIT ? OFFSET ?
        `;
        params = [tagParts[0].toLowerCase()];
        if (type) params.push(type);
        if (folderId) params.push(folderId);
        if (tagContext) params.push(`%${tagContext}%`);
        params.push(limit, offset);
      } else {
        // Multiple separate tags - use the existing logic
        sql = `
          SELECT p.*, (
            SELECT GROUP_CONCAT(t2.tag) 
            FROM tags t2 
            WHERE t2.photo_id = p.id
          ) as tags
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          )
          ${tagParts.length > 1 ? tagParts.slice(1).map(() => 'AND EXISTS (SELECT 1 FROM tags t3 WHERE t3.photo_id = p.id AND LOWER(t3.tag) = ?)').join(' ') : ''}
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
          ORDER BY ${orderByClause} ${validatedDirection}
          LIMIT ? OFFSET ?
        `;
        const tagTerms = tagParts.map(tag => tag.toLowerCase());
        params = [...tagTerms];
        if (type) params.push(type);
        if (folderId) params.push(folderId);
        if (tagContext) params.push(`%${tagContext}%`);
        params.push(limit, offset);
      }
    } else {
      // Search only content - optimized
      sql = `
        SELECT p.*, (
          SELECT GROUP_CONCAT(t2.tag) 
          FROM tags t2 
          WHERE t2.photo_id = p.id
        ) as tags
        FROM photos p
        WHERE (
          LOWER(p.name) LIKE ? OR 
          LOWER(p.camera) LIKE ? OR 
          EXISTS (SELECT 1 FROM tags t WHERE t.photo_id = p.id AND LOWER(t.tag) LIKE ?)
        )
        ${type ? 'AND p.type = ?' : ''}
        ${folderFilterSql}
        ${tagContextSql}
        ORDER BY ${orderByClause} ${validatedDirection}
        LIMIT ? OFFSET ?
      `;
      const contentTerm = `%${contentQueryFinal.toLowerCase()}%`;
      params = [contentTerm, contentTerm, contentTerm];
      if (type) params.push(type);
      if (folderId) params.push(folderId);
      if (tagContext) params.push(`%${tagContext}%`);
      params.push(limit, offset);
    }

    try {
      console.log('🔍 Search SQL:', sql);
      console.log('🔍 Search params:', params);
      console.log('🔍 Search context:', { 
        query, 
        contentQueryFinal, 
        tagQuery, 
        tagParts,
        orderBy,
        orderDirection,
        type,
        folderId,
        tagContext
      });
      
      const stmt = this.db.prepare(sql);
      const photos = stmt.all(...params);
      
      console.log(`🔍 Found ${photos.length} photos in search results`);
      
      // Parse EXIF data back to objects and add URL fields
      return photos.map(photo => ({
        ...photo,
        exif: photo.exif_data ? JSON.parse(photo.exif_data) : null,
        gps: photo.gps_latitude ? {
          latitude: photo.gps_latitude,
          longitude: photo.gps_longitude,
          altitude: photo.gps_altitude
        } : null,
        // Add URL fields that the frontend expects
        url: `/api/photos/${photo.id}/file?ext=${photo.ext}&name=${encodeURIComponent(photo.name)}`,
        thumbnailUrl: `/api/photos/${photo.id}/thumbnail?name=${encodeURIComponent(photo.name)}`,
        // Parse tags from GROUP_CONCAT result
        tags: photo.tags ? photo.tags.split(',').filter(tag => tag.trim()) : []
      }));
    } catch (error) {
      console.error('❌ Failed to search photos:', error.message);
      throw error;
    }
  }

  /**
   * Get search result count
   */
  async getSearchCount(options = {}) {
    const { query = '', type = null, folderId = null, tagContext = null } = options;

    if (!query.trim()) {
      return this.getPhotoCount({ type });
    }

    // Use the same parsing logic as searchPhotos for consistency
    const allTags = await this.getAllTags();
    const tagSet = new Set();
    if (Array.isArray(allTags)) {
      for (const tagRow of allTags) {
        if (tagRow && typeof tagRow.tag === 'string') {
          tagSet.add(tagRow.tag.toLowerCase());
        }
      }
    }

    // Parse query to separate content and tag searches
    // Handle explicit tag: prefixes with proper multi-word support
    const contentParts = [];
    const tagParts = [];
    
    // Split by 'tag:' to find all tag sections
    const parts = query.split(/(?=tag:)/g);
    
    for (const part of parts) {
      if (part.startsWith('tag:')) {
        // This is a tag section, extract the tag content
        const tagContent = part.replace(/^tag:/, '').trim();
        if (tagContent) {
          tagParts.push(tagContent);
        }
      } else if (part.trim()) {
        // This is content, process for implicit tag detection
        const contentWords = part.trim().split(/\s+/).filter(Boolean);
        
        for (let i = 0; i < contentWords.length; i++) {
          const word = contentWords[i];
          
          // Check if this word (or combination of words) matches an existing tag
          let potentialTag = word;
          let j = i;
          let foundMultiWordTag = false;
          
          // Try to find the longest possible tag match starting from this position
          while (j < contentWords.length) {
            const testTag = contentWords.slice(i, j + 1).join(' ');
            if (typeof testTag === 'string' && tagSet.has(testTag.toLowerCase())) {
              potentialTag = testTag;
              foundMultiWordTag = true;
              // Don't break here - continue to find the longest match
            }
            j++;
          }
          
          // If we found a tag match, add it to tagParts
          if (typeof potentialTag === 'string' && tagSet.has(potentialTag.toLowerCase())) {
            tagParts.push(potentialTag);
            // Skip the parts we've consumed for the multi-word tag
            if (foundMultiWordTag && potentialTag.includes(' ')) {
              const consumedParts = potentialTag.split(' ').length - 1;
              i += consumedParts; // Skip the additional parts
            }
          } else {
            // Otherwise, treat as content
            contentParts.push(word);
          }
        }
      }
    }
    
    const contentQueryFinal = contentParts.join(' ');
    const tagQuery = tagParts.join(' ');

    // Build SQL based on what we're searching for
    let sql;
    let params = [];
    const folderFilterSql = folderId ? ' AND EXISTS (SELECT 1 FROM photo_folders pf WHERE pf.photo_id = p.id AND pf.folder_id = ?)' : '';
    const tagContextSql = tagContext ? ' AND EXISTS (SELECT 1 FROM tags tctx WHERE tctx.photo_id = p.id AND tctx.tag LIKE ?)' : '';

    if (contentQueryFinal && tagParts.length > 0) {
      // Search both content and tags - use parsed tagParts directly
      if (tagParts.length === 1) {
        // Single tag with content search
        sql = `
          SELECT COUNT(DISTINCT p.id) as count
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          ) AND (LOWER(p.name) LIKE ? OR LOWER(p.camera) LIKE ?)
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
        `;
        const contentTerm = `%${contentQueryFinal.toLowerCase()}%`;
        params = [tagParts[0].toLowerCase(), contentTerm, contentTerm];
      } else {
        // Multiple tags with content search
        sql = `
          SELECT COUNT(DISTINCT p.id) as count
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          )
          ${tagParts.length > 1 ? tagParts.slice(1).map(() => 'AND EXISTS (SELECT 1 FROM tags t3 WHERE t3.photo_id = p.id AND LOWER(t3.tag) = ?)').join(' ') : ''}
          AND (LOWER(p.name) LIKE ? OR LOWER(p.camera) LIKE ?)
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
        `;
        const contentTerm = `%${contentQueryFinal.toLowerCase()}%`;
        const tagTerms = tagParts.map(tag => tag.toLowerCase());
        params = [...tagTerms, contentTerm, contentTerm];
      }
    } else if (tagParts.length > 0) {
      // Search only tags - use parsed tagParts directly
      if (tagParts.length === 1) {
        // Single tag - search for exact match
        sql = `
          SELECT COUNT(DISTINCT p.id) as count
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          )
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
        `;
        params = [tagParts[0].toLowerCase()];
      } else {
        // Multiple tags - search for all tags
        sql = `
          SELECT COUNT(DISTINCT p.id) as count
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          )
          ${tagParts.length > 1 ? tagParts.slice(1).map(() => 'AND EXISTS (SELECT 1 FROM tags t3 WHERE t3.photo_id = p.id AND LOWER(t3.tag) = ?)').join(' ') : ''}
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
        `;
        const tagTerms = tagParts.map(tag => tag.toLowerCase());
        params = [...tagTerms];
      }
    } else {
      // Search only content - optimized
      sql = `
        SELECT COUNT(DISTINCT p.id) as count
        FROM photos p
        WHERE (
          LOWER(p.name) LIKE ? OR 
          LOWER(p.camera) LIKE ? OR 
          EXISTS (SELECT 1 FROM tags t WHERE t.photo_id = p.id AND LOWER(t.tag) LIKE ?)
        )
        ${type ? 'AND p.type = ?' : ''}
        ${folderFilterSql}
        ${tagContextSql}
      `;
      const contentTerm = `%${contentQueryFinal.toLowerCase()}%`;
      params = [contentTerm, contentTerm, contentTerm];
    }

    if (type) params.push(type);
    if (folderId) params.push(folderId);
    if (tagContext) params.push(`%${tagContext}%`);

    try {
      console.log('🔍 Count SQL:', sql);
      console.log('🔍 Count params:', params);
      
      const stmt = this.db.prepare(sql);
      const result = stmt.get(...params);
      
      console.log(`🔍 Search count result:`, result);
      
      return result.count;
    } catch (error) {
      console.error('❌ Failed to get search count:', error.message);
      throw error;
    }
  }

  /**
   * Get search result total size
   */
  async getSearchTotalSize(options = {}) {
    const { query = '', type = null, folderId = null, tagContext = null } = options;

    if (!query.trim()) {
      // If no search query, get total size for all photos
      if (folderId) {
        const result = this.db.prepare('SELECT SUM(p.size) as totalSize FROM photos p JOIN photo_folders pf ON p.id = pf.photo_id WHERE pf.folder_id = ?').get(folderId);
        return result ? result.totalSize || 0 : 0;
      } else {
        const result = this.db.prepare('SELECT SUM(size) as totalSize FROM photos').get();
        return result ? result.totalSize || 0 : 0;
      }
    }

    // Use the same parsing logic as searchPhotos for consistency
    const allTags = await this.getAllTags();
    const tagSet = new Set();
    if (Array.isArray(allTags)) {
      for (const tagRow of allTags) {
        if (tagRow && typeof tagRow.tag === 'string') {
          tagSet.add(tagRow.tag.toLowerCase());
        }
      }
    }

    // Parse query to separate content and tag searches
    // Handle explicit tag: prefixes with proper multi-word support
    const contentParts = [];
    const tagParts = [];
    
    // Split by 'tag:' to find all tag sections
    const parts = query.split(/(?=tag:)/g);
    
    for (const part of parts) {
      if (part.startsWith('tag:')) {
        // This is a tag section, extract the tag content
        const tagContent = part.replace(/^tag:/, '').trim();
        if (tagContent) {
          tagParts.push(tagContent);
        }
      } else if (part.trim()) {
        // This is content, process for implicit tag detection
        const contentWords = part.trim().split(/\s+/).filter(Boolean);
        
        for (let i = 0; i < contentWords.length; i++) {
          const word = contentWords[i];
          
          // Check if this word (or combination of words) matches an existing tag
          let potentialTag = word;
          let j = i;
          let foundMultiWordTag = false;
          
          // Try to find the longest possible tag match starting from this position
          while (j < contentWords.length) {
            const testTag = contentWords.slice(i, j + 1).join(' ');
            if (typeof testTag === 'string' && tagSet.has(testTag.toLowerCase())) {
              potentialTag = testTag;
              foundMultiWordTag = true;
              // Don't break here - continue to find the longest match
            }
            j++;
          }
          
          // If we found a tag match, add it to tagParts
          if (typeof potentialTag === 'string' && tagSet.has(potentialTag.toLowerCase())) {
            tagParts.push(potentialTag);
            // Skip the parts we've consumed for the multi-word tag
            if (foundMultiWordTag && potentialTag.includes(' ')) {
              const consumedParts = potentialTag.split(' ').length - 1;
              i += consumedParts; // Skip the additional parts
            }
          } else {
            // Otherwise, treat as content
            contentParts.push(word);
          }
        }
      }
    }
    
    const contentQueryFinal = contentParts.join(' ');
    const tagQuery = tagParts.join(' ');

    // Build SQL based on what we're searching for
    let sql;
    let params = [];
    const folderFilterSql = folderId ? ' AND EXISTS (SELECT 1 FROM photo_folders pf WHERE pf.photo_id = p.id AND pf.folder_id = ?)' : '';
    const tagContextSql = tagContext ? ' AND EXISTS (SELECT 1 FROM tags tctx WHERE tctx.photo_id = p.id AND tctx.tag LIKE ?)' : '';

    if (contentQueryFinal && tagParts.length > 0) {
      // Search both content and tags - use parsed tagParts directly
      if (tagParts.length === 1) {
        // Single tag with content search
        sql = `
          SELECT SUM(p.size) as totalSize
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          ) AND (LOWER(p.name) LIKE ? OR LOWER(p.camera) LIKE ?)
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
        `;
        const contentTerm = `%${contentQueryFinal.toLowerCase()}%`;
        params = [tagParts[0].toLowerCase(), contentTerm, contentTerm];
      } else {
        // Multiple tags with content search
        sql = `
          SELECT SUM(p.size) as totalSize
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          )
          ${tagParts.length > 1 ? tagParts.slice(1).map(() => 'AND EXISTS (SELECT 1 FROM tags t3 WHERE t3.photo_id = p.id AND LOWER(t3.tag) = ?)').join(' ') : ''}
          AND (LOWER(p.name) LIKE ? OR LOWER(p.camera) LIKE ?)
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
        `;
        const contentTerm = `%${contentQueryFinal.toLowerCase()}%`;
        const tagTerms = tagParts.map(tag => tag.toLowerCase());
        params = [...tagTerms, contentTerm, contentTerm];
      }
    } else if (tagParts.length > 0) {
      // Search only tags - use parsed tagParts directly
      if (tagParts.length === 1) {
        // Single tag - search for exact match
        sql = `
          SELECT SUM(p.size) as totalSize
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          )
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
        `;
        params = [tagParts[0].toLowerCase()];
      } else {
        // Multiple tags - search for all tags
        sql = `
          SELECT SUM(p.size) as totalSize
          FROM photos p
          WHERE EXISTS (
            SELECT 1 FROM tags t 
            WHERE t.photo_id = p.id AND LOWER(t.tag) = ?
          )
          ${tagParts.length > 1 ? tagParts.slice(1).map(() => 'AND EXISTS (SELECT 1 FROM tags t3 WHERE t3.photo_id = p.id AND LOWER(t3.tag) = ?)').join(' ') : ''}
          ${type ? 'AND p.type = ?' : ''}
          ${folderFilterSql}
          ${tagContextSql}
        `;
        const tagTerms = tagParts.map(tag => tag.toLowerCase());
        params = [...tagTerms];
      }
    } else {
      // Search only content - optimized
      sql = `
        SELECT SUM(p.size) as totalSize
        FROM photos p
        WHERE (
          LOWER(p.name) LIKE ? OR 
          LOWER(p.camera) LIKE ? OR 
          EXISTS (SELECT 1 FROM tags t WHERE t.photo_id = p.id AND LOWER(t.tag) LIKE ?)
        )
        ${type ? 'AND p.type = ?' : ''}
        ${folderFilterSql}
        ${tagContextSql}
      `;
      const contentTerm = `%${contentQueryFinal.toLowerCase()}%`;
      params = [contentTerm, contentTerm, contentTerm];
    }

    if (type) params.push(type);
    if (folderId) params.push(folderId);
    if (tagContext) params.push(`%${tagContext}%`);

    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.get(...params);
      return result ? result.totalSize || 0 : 0;
    } catch (error) {
      console.error('❌ Failed to get search total size:', error.message);
      throw error;
    }
  }

  /**
   * Delete a photo by ID
   */
  async deletePhoto(id) {
    try {
      const stmt = this.db.prepare('DELETE FROM photos WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('❌ Failed to delete photo:', error.message);
      throw error;
    }
  }

  /**
   * Update cache info
   */
  async updateCacheInfo(key, value) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO cache_info (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run(key, value);
      return true;
    } catch (error) {
      console.error('❌ Failed to update cache info:', error.message);
      throw error;
    }
  }

  /**
   * Get cache info
   */
  async getCacheInfo(key) {
    try {
      const stmt = this.db.prepare('SELECT value FROM cache_info WHERE key = ?');
      const result = stmt.get(key);
      return result ? result.value : null;
    } catch (error) {
      console.error('❌ Failed to get cache info:', error.message);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const photoCount = this.db.prepare('SELECT COUNT(*) as count FROM photos').get().count;
      const typeStats = this.db.prepare(`
        SELECT type, COUNT(*) as count 
        FROM photos 
        GROUP BY type
      `).all();
      
      const totalSize = this.db.prepare('SELECT SUM(size) as total FROM photos').get().total || 0;

      // Get extension statistics
      const extensionStats = this.db.prepare(`
        SELECT ext, COUNT(*) as count, AVG(size) as avgSize, SUM(size) as totalSize
        FROM photos
        GROUP BY ext
      `).all();
      
      // Get folder and tag statistics
      const totalFolders = this.db.prepare('SELECT COUNT(DISTINCT folder_id) as count FROM photo_folders').get().count || 0;
      const totalTags = this.db.prepare('SELECT COUNT(DISTINCT tag) as count FROM tags').get().count || 0;
      
      return {
        totalPhotos: photoCount,
        totalFolders,
        totalTags,
        typeStats,
        extensionStats,
        totalSize,
        dbSize: await this.getDatabaseSize()
      };
    } catch (error) {
      console.error('❌ Failed to get database stats:', error.message);
      throw error;
    }
  }

  /**
   * Get database file size
   */
  async getDatabaseSize() {
    try {
      const stats = await fs.stat(this.dbPath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get photo count for every folder
   */
  async getPhotoCountsByFolder() {
    // Use the join table to count photos per folder
    try {
      const rows = this.db.prepare('SELECT folder_id, COUNT(*) as count FROM photo_folders GROUP BY folder_id').all();
      const result = {};
      for (const row of rows) {
        result[row.folder_id] = row.count;
      }
      return result;
    } catch (error) {
      console.error('❌ Failed to get photo counts by folder:', error.message);
      return {};
    }
  }

  /**
   * Get paginated photos for a folder (optimized version without folders/tags)
   */
  async getPhotosPaginatedFast({ folderId = null, limit = 50, offset = 0, orderBy = 'mtime', orderDirection = 'DESC' }) {
    const startTime = Date.now();
    let query, params;
    
    const validatedDirection = this._validateDirection(orderDirection);
    
    if (folderId) {
      // Use alias 'p' for joined query
      const orderByClause = this.getOrderByClause(orderBy, { tableAlias: 'p' });
      query = `
        SELECT p.* FROM photos p
        JOIN photo_folders pf ON p.id = pf.photo_id
        WHERE pf.folder_id = ?
        ORDER BY ${orderByClause} ${validatedDirection}
        LIMIT ? OFFSET ?
      `;
      params = [folderId, limit, offset];
    } else {
      // No alias needed for simple query
      const orderByClause = this.getOrderByClause(orderBy);
      query = `
        SELECT * FROM photos
        ORDER BY ${orderByClause} ${validatedDirection}
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    }

    try {
      const photos = this.db.prepare(query).all(...params);
      
      // Get total count
      let total;
      if (folderId) {
        total = this.db.prepare('SELECT COUNT(*) as count FROM photo_folders WHERE folder_id = ?').get(folderId).count;
      } else {
        total = this.db.prepare('SELECT COUNT(*) as count FROM photos').get().count;
      }
      
      // Get total size
      let totalSize;
      if (folderId) {
        totalSize = this.db.prepare('SELECT SUM(p.size) as totalSize FROM photos p JOIN photo_folders pf ON p.id = pf.photo_id WHERE pf.folder_id = ?').get(folderId).totalSize || 0;
      } else {
        totalSize = this.db.prepare('SELECT SUM(size) as totalSize FROM photos').get().totalSize || 0;
      }
      
      // Log performance metrics
      this.logPerformanceMetrics(`getPhotosPaginatedFast (${folderId ? 'folder' : 'all'})`, startTime, photos.length);
      
      return {
        photos: photos.map(photo => ({
          ...photo,
          folders: [], // Empty arrays for compatibility
          tags: [],
          exif: photo.exif_data ? JSON.parse(photo.exif_data) : null,
          gps: photo.gps_latitude ? {
            latitude: photo.gps_latitude,
            longitude: photo.gps_longitude,
            altitude: photo.gps_altitude
          } : null
        })),
        total,
        totalSize
      };
    } catch (error) {
      console.error('❌ Failed to get paginated photos (fast):', error.message);
      throw error;
    }
  }

  /**
   * Get paginated photos for a folder
   */
  async getPhotosPaginated({ folderId = null, limit = 50, offset = 0, orderBy = 'mtime', orderDirection = 'DESC', randomSeed = undefined }) {
    const startTime = Date.now();
    let query, params;
    
    // Build the ORDER BY clause based on sort parameters
    const orderByClause = this.getOrderByClause(orderBy);
    const validatedDirection = this._validateDirection(orderDirection);
    
    if (folderId) {
      // Handle special sorting cases
      const orderByWithAlias = this.getOrderByClause(orderBy, { tableAlias: 'p' });
      
      query = `
        SELECT p.* FROM photos p
        JOIN photo_folders pf ON p.id = pf.photo_id
        WHERE pf.folder_id = ?
        ORDER BY ${orderByWithAlias} ${validatedDirection}
        LIMIT ? OFFSET ?
      `;
      params = [folderId, limit, offset];
    } else {
      query = `
        SELECT * FROM photos
        ORDER BY ${orderByClause} ${validatedDirection}
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    }

    try {
      // Optimized query with JOINs to avoid N+1 problem
      let optimizedQuery, optimizedParams;
      
      if (folderId) {
        // Handle special sorting cases for folder queries
        const orderByWithAlias = this.getOrderByClause(orderBy, { tableAlias: 'p', randomSeed });
        
        optimizedQuery = `
          SELECT 
            p.*,
            GROUP_CONCAT(DISTINCT pf.folder_id) as folder_ids,
            GROUP_CONCAT(DISTINCT t.tag) as tags
          FROM photos p
          JOIN photo_folders pf ON p.id = pf.photo_id
          LEFT JOIN tags t ON p.id = t.photo_id
          WHERE pf.folder_id = ?
          GROUP BY p.id
          ORDER BY ${orderByWithAlias} ${validatedDirection}
          LIMIT ? OFFSET ?
        `;
        optimizedParams = [folderId, limit, offset];
      } else {
        optimizedQuery = `
          SELECT 
            p.*,
            GROUP_CONCAT(DISTINCT pf.folder_id) as folder_ids,
            GROUP_CONCAT(DISTINCT t.tag) as tags
          FROM photos p
          LEFT JOIN photo_folders pf ON p.id = pf.photo_id
          LEFT JOIN tags t ON p.id = t.photo_id
          GROUP BY p.id
          ORDER BY ${orderByClause} ${validatedDirection}
          LIMIT ? OFFSET ?
        `;
        optimizedParams = [limit, offset];
      }
      
      const photos = this.db.prepare(optimizedQuery).all(...optimizedParams);
      
      // Get total count
      let total;
      if (folderId) {
        total = this.db.prepare('SELECT COUNT(*) as count FROM photo_folders WHERE folder_id = ?').get(folderId).count;
      } else {
        total = this.db.prepare('SELECT COUNT(*) as count FROM photos').get().count;
      }
      
      // Process photos with folders and tags (now included in the query)
      const photosWithFolders = photos.map(photo => {
        const folders = photo.folder_ids ? photo.folder_ids.split(',').filter(Boolean) : [];
        const tags = photo.tags ? photo.tags.split(',').filter(Boolean) : [];
        
        // Remove the aggregated columns from the photo object
        const { folder_ids, tags: photoTags, ...cleanPhoto } = photo;
        
        return {
          ...cleanPhoto,
          folders: folders,
          tags: tags,
          exif: photo.exif_data ? JSON.parse(photo.exif_data) : null,
          gps: photo.gps_latitude ? {
            latitude: photo.gps_latitude,
            longitude: photo.gps_longitude,
            altitude: photo.gps_altitude
          } : null
        };
      });
      
      // Get total size
      let totalSize;
      if (folderId) {
        totalSize = this.db.prepare('SELECT SUM(p.size) as totalSize FROM photos p JOIN photo_folders pf ON p.id = pf.photo_id WHERE pf.folder_id = ?').get(folderId).totalSize || 0;
      } else {
        totalSize = this.db.prepare('SELECT SUM(size) as totalSize FROM photos').get().totalSize || 0;
      }
      
      // Log performance metrics
      this.logPerformanceMetrics(`getPhotosPaginated (${folderId ? 'folder' : 'all'})`, startTime, photosWithFolders.length);
      
      return {
        photos: photosWithFolders,
        total,
        totalSize
      };
    } catch (error) {
      console.error('❌ Failed to get paginated photos:', error.message);
      throw error;
    }
  }

  /**
   * Insert photo-folder relationships
   */
  async insertPhotoFolderRelationships(relationships) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO photo_folders (photo_id, folder_id)
      VALUES (?, ?)
    `);

    try {
      const transaction = this.db.transaction((rels) => {
        for (const rel of rels) {
          stmt.run(rel.photoId, rel.folderId);
        }
      });

      transaction(relationships);
      console.log(`✅ Inserted ${relationships.length} photo-folder relationships`);
      return true;
    } catch (error) {
      console.error('❌ Failed to insert photo-folder relationships:', error.message);
      throw error;
    }
  }

  /**
   * Insert photo-tag relationships
   */
  async insertPhotoTagRelationships(relationships) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO tags (photo_id, tag)
      VALUES (?, ?)
    `);

    try {
      const transaction = this.db.transaction((rels) => {
        for (const rel of rels) {
          stmt.run(rel.photoId, rel.tag);
        }
      });

      transaction(relationships);
      console.log(`✅ Inserted ${relationships.length} photo-tag relationships`);
      return true;
    } catch (error) {
      console.error('❌ Failed to insert photo-tag relationships:', error.message);
      throw error;
    }
  }

  /**
   * Get photo count for a specific folder
   */
  async getPhotoCountForFolder(folderId) {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM photo_folders WHERE folder_id = ?');
      const result = stmt.get(folderId);
      return result ? result.count : 0;
    } catch (error) {
      console.error('❌ Failed to get photo count for folder:', error.message);
      return 0;
    }
  }

  /**
   * Get all folder IDs for a photo
   */
  async getFoldersForPhoto(photoId) {
    try {
      const stmt = this.db.prepare('SELECT folder_id FROM photo_folders WHERE photo_id = ?');
      const rows = stmt.all(photoId);
      return rows.map(row => row.folder_id);
    } catch (error) {
      console.error('❌ Failed to get folders for photo:', error.message);
      return [];
    }
  }

  /**
   * Get all tags for a photo
   */
  async getTagsForPhoto(photoId) {
    try {
      const stmt = this.db.prepare('SELECT tag FROM tags WHERE photo_id = ? ORDER BY tag');
      const rows = stmt.all(photoId);
      return rows.map(row => row.tag);
    } catch (error) {
      console.error('❌ Failed to get tags for photo:', error.message);
      return [];
    }
  }

  /**
   * Get all photo IDs for a folder
   */
  async getPhotosForFolder(folderId) {
    try {
      const stmt = this.db.prepare('SELECT photo_id FROM photo_folders WHERE folder_id = ?');
      const rows = stmt.all(folderId);
      return rows.map(row => row.photo_id);
    } catch (error) {
      console.error('❌ Failed to get photos for folder:', error.message);
      return [];
    }
  }

  /**
   * Clear all data from the database
   */
  async clearAllData() {
    try {
      console.log('🧹 Clearing all database data...');
      
      // Delete all data from tables
      this.db.prepare('DELETE FROM photos').run();
      this.db.prepare('DELETE FROM tags').run();
      this.db.prepare('DELETE FROM photo_folders').run();
      this.db.prepare('DELETE FROM cache_info').run();
      
      // Reset auto-increment counters
      this.db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('tags', 'photo_folders')").run();
      
      console.log('✅ Database cleared successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear database:', error.message);
      throw error;
    }
  }

  /**
   * Remove all folder relationships for a photo
   */
  async removePhotoFolderRelationships(photoId) {
    try {
      const stmt = this.db.prepare('DELETE FROM photo_folders WHERE photo_id = ?');
      const result = stmt.run(photoId);
      return result.changes;
    } catch (error) {
      console.error('❌ Failed to remove photo-folder relationships:', error.message);
      throw error;
    }
  }

  /**
   * Remove all tag relationships for a photo
   */
  async removePhotoTagRelationships(photoId) {
    try {
      const stmt = this.db.prepare('DELETE FROM tags WHERE photo_id = ?');
      const result = stmt.run(photoId);
      return result.changes;
    } catch (error) {
      console.error('❌ Failed to remove photo-tag relationships:', error.message);
      throw error;
    }
  }

  /**
   * Get recursive photo count for a folder (including all subfolders)
   */
  async getRecursivePhotoCountForFolder(folderId, folderTree = null) {
    try {
      // If we have the folder tree, use it for recursive counting
      if (folderTree) {
        const getAllSubfolderIds = (folderId, tree) => {
          const folderIds = [folderId];
          
          const findFolder = (folders, targetId) => {
            for (const folder of folders) {
              if (folder.id === targetId) {
                // Add all children recursively
                const addChildren = (children) => {
                  for (const child of children) {
                    folderIds.push(child.id);
                    if (child.children && child.children.length > 0) {
                      addChildren(child.children);
                    }
                  }
                };
                addChildren(folder.children);
                return true;
              }
              if (folder.children && folder.children.length > 0) {
                if (findFolder(folder.children, targetId)) {
                  return true;
                }
              }
            }
            return false;
          };
          
          findFolder(tree, folderId);
          return folderIds;
        };
        
        const allFolderIds = getAllSubfolderIds(folderId, folderTree);
        
        // Count photos in all these folders
        const placeholders = allFolderIds.map(() => '?').join(',');
        const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM photo_folders WHERE folder_id IN (${placeholders})`);
        const result = stmt.get(...allFolderIds);
        return result ? result.count : 0;
      } else {
        // Fallback to direct count if no folder tree provided
        return await this.getPhotoCountForFolder(folderId);
      }
    } catch (error) {
      console.error('❌ Failed to get recursive photo count for folder:', error.message);
      return 0;
    }
  }

  /**
   * Get recursive photo counts for all folders in the tree
   * Optimized to avoid N+1 queries
   */
  async getRecursiveFolderCounts(folderTree) {
    try {
      // 1. Get all direct counts in one query
      const directCountsMap = await this.getPhotoCountsByFolder();

      // If no tree provided, we can only return direct counts
      if (!folderTree) {
        return directCountsMap;
      }

      // 2. Calculate recursive counts in memory
      const recursiveCounts = {};

      // Helper to traverse and sum counts
      // Returns the total count for the current node (including children)
      const calculateRecursive = (nodes) => {
        let siblingsTotal = 0;

        for (const node of nodes) {
          let nodeTotal = directCountsMap[node.id] || 0;

          if (node.children && node.children.length > 0) {
            nodeTotal += calculateRecursive(node.children);
          }

          recursiveCounts[node.id] = nodeTotal;
          siblingsTotal += nodeTotal;
        }

        return siblingsTotal;
      };

      calculateRecursive(folderTree);

      return recursiveCounts;
    } catch (error) {
      console.error('❌ Failed to get recursive folder counts:', error.message);
      return {};
    }
  }

  /**
   * Get all unique folder IDs from the database
   */
  async getAllFolderIds() {
    try {
      const stmt = this.db.prepare('SELECT DISTINCT folder_id FROM photo_folders');
      const rows = stmt.all();
      return rows.map(row => row.folder_id);
    } catch (error) {
      console.error('❌ Failed to get all folder IDs:', error.message);
      return [];
    }
  }

  /**
   * Get photo counts for all tags
   */
  async getTagCounts() {
    try {
      const rows = this.db.prepare('SELECT tag, COUNT(*) as count FROM tags GROUP BY tag').all();
      const result = {};
      for (const row of rows) {
        result[row.tag] = row.count;
      }
      return result;
    } catch (error) {
      console.error('❌ Failed to get tag counts:', error.message);
      return {};
    }
  }

  /**
   * Get all unique tags
   */
  async getAllTags() {
    try {
      const stmt = this.db.prepare('SELECT DISTINCT tag FROM tags');
      const rows = stmt.all();
      return rows;
    } catch (error) {
      console.error('❌ Failed to get all tags:', error.message);
      return [];
    }
  }

  /**
   * Get paginated photos for a tag
   */
  async getPhotosByTagPaginated({ tag, limit = 50, offset = 0, orderBy = 'mtime', orderDirection = 'DESC' }) {
    try {
      // Handle special sort fields
      const orderByClause = this.getOrderByClause(orderBy, { tableAlias: 'p' });
      const validatedDirection = this._validateDirection(orderDirection);

      // Use JOIN to get photos with tags and apply sorting properly
      const query = `
        SELECT DISTINCT p.* 
        FROM photos p
        INNER JOIN tags t ON p.id = t.photo_id
        WHERE t.tag = ?
        ORDER BY ${orderByClause} ${validatedDirection}
        LIMIT ? OFFSET ?
      `;
      const photos = this.db.prepare(query).all(tag, limit, offset);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM photos p
        INNER JOIN tags t ON p.id = t.photo_id
        WHERE t.tag = ?
      `;
      const totalResult = this.db.prepare(countQuery).get(tag);
      const total = totalResult ? totalResult.total : 0;
      
      // Get folders for each photo
      const photosWithFolders = await Promise.all(photos.map(async (photo) => {
        const folders = await this.getFoldersForPhoto(photo.id);
        const tags = await this.getTagsForPhoto(photo.id);
        return {
          ...photo,
          folders: folders,
          tags: tags,
          exif: photo.exif_data ? JSON.parse(photo.exif_data) : null,
          gps: photo.gps_latitude ? {
            latitude: photo.gps_latitude,
            longitude: photo.gps_longitude,
            altitude: photo.gps_altitude
          } : null
        };
      }));
      
      // Calculate if there are more photos
      const hasMore = offset + limit < total;
      
      // Get total size for all photos with this tag
      const totalSizeQuery = `
        SELECT SUM(p.size) as totalSize
        FROM photos p
        INNER JOIN tags t ON p.id = t.photo_id
        WHERE t.tag = ?
      `;
      const totalSizeResult = this.db.prepare(totalSizeQuery).get(tag);
      const totalSize = totalSizeResult ? totalSizeResult.totalSize : 0;
      
      return {
        photos: photosWithFolders,
        total,
        hasMore,
        totalSize
      };
    } catch (error) {
      console.error('❌ Failed to get paginated photos by tag:', error.message);
      return { photos: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get photo count for a tag
   */
  async getPhotoCountForTag(tag) {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(DISTINCT p.id) as count
        FROM photos p
        INNER JOIN tags t ON p.id = t.photo_id
        WHERE t.tag = ?
      `);
      const result = stmt.get(tag);
      return result ? result.count : 0;
    } catch (error) {
      console.error('❌ Failed to get photo count for tag:', error.message);
      return 0;
    }
  }

  /**
   * Remove multiple photos by IDs (batch)
   */
  async removePhotosBatch(ids) {
    if (!ids || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM photos WHERE id IN (${placeholders})`);
    stmt.run(...ids);
  }

  /**
   * Remove multiple photo-folder relationships by photo IDs (batch)
   */
  async removePhotoFolderRelationshipsBatch(ids) {
    if (!ids || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM photo_folders WHERE photo_id IN (${placeholders})`);
    stmt.run(...ids);
  }

  /**
   * Remove multiple photo-tag relationships by photo IDs (batch)
   */
  async removePhotoTagRelationshipsBatch(ids) {
    if (!ids || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM tags WHERE photo_id IN (${placeholders})`);
    stmt.run(...ids);
  }

  /**
   * Get the first alphabetically sorted image in a folder for thumbnail
   */
  getFirstImageInFolder(folderId) {
    try {
      const stmt = this.db.prepare(`
        SELECT p.id, p.name, p.ext
        FROM photos p
        JOIN photo_folders pf ON p.id = pf.photo_id
        WHERE pf.folder_id = ? 
          AND LOWER(p.ext) IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif', 'avif')
        ORDER BY ${this.getOrderByClause('name', { tableAlias: 'p' })} ASC
        LIMIT 1
      `);
      
      return stmt.get(folderId);
    } catch (error) {
      console.error('❌ Failed to get first image in folder:', error.message);
      return null;
    }
  }

  /**
   * Get the raw database object for advanced operations
   */
  getRawDatabase() {
    return this.db;
  }

  /**
   * Clear all data from the database (optimized version for rebuilds)
   */
  async clearAllDataForRebuild() {
    try {
      console.log('🧹 Clearing all existing data for fresh rebuild...');
      
      // Clear in optimal order (relationships first, then photos)
      this.db.prepare('DELETE FROM tags').run();
      this.db.prepare('DELETE FROM photo_folders').run();
      this.db.prepare('DELETE FROM photos').run();
      this.db.prepare('DELETE FROM cache_info').run();
      
      // Vacuum to reclaim space
      console.log('🗑️  Vacuuming database to reclaim space...');
      this.db.prepare('VACUUM').run();
      
      console.log('✅ Database cleared successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear database for rebuild:', error.message);
      throw error;
    }
  }
}

module.exports = PhotoLibraryDatabase; 