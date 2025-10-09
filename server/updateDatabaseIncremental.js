const path = require('path');
const fs = require('fs').promises;
const PhotoLibraryDatabase = require('./database');
const CryptoJS = require('crypto-js');
const os = require('os');
const { getLibraryPath, getDatabasePath } = require('./config-loader');

const LIBRARY_PATH = getLibraryPath();
const DB_PATH = getDatabasePath();

// Configuration for memory-efficient processing and optimized concurrency
const CONFIG = {
  // Memory-efficient processing
  CHUNK_SIZE: 1000,                   // Increased from 500 for better throughput
  MEMORY_THRESHOLD_MB: 1024,          // Increased from 512 for better performance
  GARBAGE_COLLECTION_INTERVAL: 10,    // Reduced GC frequency for better performance
  
  // Optimized concurrency
  CONCURRENCY_LIMIT: Math.min(100, os.cpus().length * 8),  // More aggressive concurrency
  MAX_CONCURRENT_OPERATIONS: 200,     // Increased from 100
  
  // Batch processing - optimized for better performance
  BATCH_SIZE: 200,                    // Increased from 50
  RELATIONSHIP_BATCH_SIZE: 5000,      // Increased from 1000
  TRANSACTION_SIZE: 5000,             // New: larger transactions for better performance
};

// Memory monitoring utility
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024),      // Resident Set Size in MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),  // Heap Used in MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // Heap Total in MB
    external: Math.round(usage.external / 1024 / 1024)   // External in MB
  };
}

// Force garbage collection if available
function forceGarbageCollection() {
  if (global.gc) {
    global.gc();
    return true;
  }
  return false;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

async function updateDatabaseIncremental(progress) {
  const startTime = Date.now();
  progress.status = 'running';
  progress.startTime = new Date().toISOString();
  progress.logs = [];
  progress.error = null;
  progress.totalFiles = 0;
  progress.processedFiles = 0;
  progress.percent = 0;
  progress.eta = null;
  progress.elapsed = 0;

  // Helper function to update progress
  function updateProgress(processed, total, currentPhase = '') {
    progress.processedFiles = processed;
    progress.totalFiles = total;
    progress.percent = total > 0 ? Math.round((processed / total) * 100) : 0;
    progress.elapsed = Date.now() - startTime;
    
    // Calculate ETA
    if (processed > 0 && progress.elapsed > 0) {
      const rate = processed / (progress.elapsed / 1000); // files per second
      const remaining = total - processed;
      const etaSeconds = remaining / rate;
      if (etaSeconds > 0 && etaSeconds < 86400) { // Less than 24 hours
        const etaMinutes = Math.round(etaSeconds / 60);
        progress.eta = etaMinutes > 60 ? `${Math.round(etaMinutes / 60)}h ${etaMinutes % 60}m` : `${etaMinutes}m`;
      } else {
        progress.eta = null;
      }
    }
  }

  function log(msg) {
    progress.logs.push(`[${new Date().toISOString()}] ${msg}`);
    if (progress.logs.length > 100) progress.logs.shift();
    console.log(msg);
  }

  log('🔄 Starting incremental database update...');
  log(`📁 Library path: ${LIBRARY_PATH}`);
  log(`🗄️  Database path: ${DB_PATH}`);
  log('─'.repeat(80));
  
  // Log optimized configuration
  log('⚙️  Optimized Configuration:');
  log(`   🧠 Memory threshold: ${CONFIG.MEMORY_THRESHOLD_MB}MB`);
  log(`   🔄 Concurrency limit: ${CONFIG.CONCURRENCY_LIMIT} (${os.cpus().length} CPU cores)`);
  log(`   📦 Chunk size: ${CONFIG.CHUNK_SIZE} files`);
  log(`   💾 Batch size: ${CONFIG.BATCH_SIZE} photos`);
  log(`   🏷️  Relationship batch: ${CONFIG.RELATIONSHIP_BATCH_SIZE} items`);
  log(`   🧹 GC interval: every ${CONFIG.GARBAGE_COLLECTION_INTERVAL} chunks`);
  log('─'.repeat(80));
  
  try {
    // Check if library exists
    log('🔍 Checking library structure...');
    const libraryExists = await fs.access(LIBRARY_PATH).then(() => true).catch(() => false);
    if (!libraryExists) {
      log('❌ Library path not found: ' + LIBRARY_PATH);
      process.exit(1);
    }
    
    // Check for required files
    const mtimePath = path.join(LIBRARY_PATH, 'mtime.json');
    const imagesDir = path.join(LIBRARY_PATH, 'images');
    
    const [mtimeExists, imagesExists] = await Promise.all([
      fs.access(mtimePath).then(() => true).catch(() => false),
      fs.access(imagesDir).then(() => true).catch(() => false)
    ]);
    
    if (!imagesExists) {
      log('❌ Images directory not found: ' + imagesDir);
      process.exit(1);
    }
    
    log('✅ Library structure validated');
    log(`   ⏰ Mtime data: ${mtimeExists ? '✅' : '❌'}`);
    log(`   📁 Images directory: ✅`);
    log('─'.repeat(80));
    
    // Initialize database
    log('🗄️  Connecting to database...');
    const db = new PhotoLibraryDatabase(DB_PATH);
    await db.initialize();
    log('✅ Database connected');
    
    // Get database last refresh time
    const lastRefresh = await db.getCacheInfo('last_refresh');
    const dbLastRefresh = lastRefresh ? new Date(lastRefresh) : new Date(0);
    log(`📅 Database last updated: ${dbLastRefresh.toISOString()}`);
    
    // Read mtime data if available
    let mtimeData = {};
    if (mtimeExists) {
      try {
        log('📖 Reading mtime data...');
        const mtimeDataRaw = await fs.readFile(mtimePath, 'utf8');
        mtimeData = JSON.parse(mtimeDataRaw);
        log(`✅ Mtime data loaded (${Object.keys(mtimeData).length} entries)`);
      } catch (error) {
        log('⚠️  Failed to read mtime data: ' + error.message);
      }
    }
    
    // Scan images directory
    log('🔍 Scanning images directory...');
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    const photoDirs = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.info'));
    
    log(`📊 Found ${photoDirs.length} photo directories`);
    log('─'.repeat(80));
    
    // Update progress for file scanning phase
    updateProgress(photoDirs.length, photoDirs.length, 'scanning');
    
    // Get existing photos from database
    log('🔍 Getting existing photos from database...');
    const existingPhotos = await db.getPhotos();
    const existingIds = new Set(existingPhotos.map(p => p.id));
    log(`📊 Database has ${existingIds.size} existing photos`);
    
    const photoIdToHash = {};
    for (const p of existingPhotos) {
      if (p.metadata_hash) photoIdToHash[p.id] = p.metadata_hash;
    }
    
    // Check for new and modified files
    log('🔍 Checking for new and modified files...');
    const newFiles = [];
    const modifiedFiles = [];
    const unchangedFiles = [];
    
    // Process files in parallel chunks for better performance
    const CHUNK_SIZE = CONFIG.CHUNK_SIZE;
    const CONCURRENCY_LIMIT = CONFIG.CONCURRENCY_LIMIT;
    
    for (let chunkStart = 0; chunkStart < photoDirs.length; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, photoDirs.length);
      const chunk = photoDirs.slice(chunkStart, chunkEnd);
      const chunkNumber = Math.floor(chunkStart / CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(photoDirs.length / CHUNK_SIZE);
      const progressPercent = (chunkEnd / photoDirs.length * 100).toFixed(1);
      
      log(`🔄 Processing chunk ${chunkNumber}/${totalChunks} (${progressPercent}%) - ${chunk.length} files`);
      
      // Create tasks for parallel processing
      const tasks = chunk.map(entry => async () => {
        const fileId = entry.name.replace('.info', '');
        const photoDir = path.join(imagesDir, entry.name);
        
        try {
          // Get directory modification time (parallelized)
          const dirStats = await fs.stat(photoDir);
          const dirMtime = dirStats.mtime;
          
          // Check if file is new
          if (!existingIds.has(fileId)) {
            return { type: 'new', fileId, entry, dirMtime };
          }
          
          // Check if file has been modified (parallelized)
          const needsUpdate = await checkIfFileNeedsUpdate(fileId, photoDir, dirMtime, mtimeData, dbLastRefresh);
          if (needsUpdate) {
            return { type: 'modified', fileId, entry, dirMtime };
          } else {
            return { type: 'unchanged', fileId };
          }
          
        } catch (error) {
          log('⚠️  Failed to check ' + entry.name + ': ' + error.message);
          return { type: 'error', fileId, error: error.message };
        }
      });
      
      // Process tasks with concurrency limit
      const results = [];
      let taskIndex = 0;
      
      async function runNext() {
        if (taskIndex >= tasks.length) return;
        const idx = taskIndex++;
        const result = await tasks[idx]();
        results.push(result);
        await runNext();
      }
      
      // Run with concurrency limit
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY_LIMIT, tasks.length) }, runNext));
      
      // Process results
      for (const result of results) {
        switch (result.type) {
          case 'new':
            newFiles.push({ fileId: result.fileId, entry: result.entry, dirMtime: result.dirMtime });
            break;
          case 'modified':
            modifiedFiles.push({ fileId: result.fileId, entry: result.entry, dirMtime: result.dirMtime });
            break;
          case 'unchanged':
            unchangedFiles.push(result.fileId);
            break;
          case 'error':
            // Error already logged, continue
            break;
        }
      }
      
      // Progress logging
      const processedSoFar = Math.min(chunkEnd, photoDirs.length);
      log(`✅ Chunk ${chunkNumber} complete: ${processedSoFar} of ${photoDirs.length} files processed`);
      
      // Update progress for file analysis phase
      updateProgress(processedSoFar, photoDirs.length, 'analyzing');
      
      // Memory monitoring and garbage collection
      const memoryUsage = getMemoryUsage();
      log(`💾 Memory usage: ${memoryUsage.heapUsed}MB used / ${memoryUsage.heapTotal}MB total`);
      
      // Force garbage collection if memory usage is high or every N chunks
      if (memoryUsage.heapUsed > CONFIG.MEMORY_THRESHOLD_MB || 
          chunkNumber % CONFIG.GARBAGE_COLLECTION_INTERVAL === 0) {
        const beforeGC = memoryUsage.heapUsed;
        const gcSuccess = forceGarbageCollection();
        if (gcSuccess) {
          const afterGC = getMemoryUsage().heapUsed;
          const freed = beforeGC - afterGC;
          log(`🧹 Garbage collection: freed ${freed}MB (${beforeGC}MB → ${afterGC}MB)`);
        }
      }
      
      // Clear chunk data to free memory
      chunk.length = 0;
      tasks.length = 0;
      results.length = 0;
    }
    
    log(`🔄 Completed parallel file analysis (100%)...`);
    
    log(`📊 File analysis complete:`);
    log(`   🆕 New files: ${newFiles.length}`);
    log(`   🔄 Modified files: ${modifiedFiles.length}`);
    log(`   ✅ Unchanged files: ${unchangedFiles.length}`);
    log('─'.repeat(80));
    
    if (newFiles.length === 0 && modifiedFiles.length === 0) {
      log('✅ No updates needed - database is up to date');
      return;
    }
    
    // Detect deleted files
    const diskIds = new Set(photoDirs.map(entry => entry.name.replace('.info', '')));
    const deletedIds = Array.from(existingIds).filter(id => !diskIds.has(id));
    if (deletedIds.length > 0) {
      log('🗑️  Found ' + deletedIds.length + ' deleted files. Removing from database...');
      await db.removePhotoFolderRelationshipsBatch(deletedIds);
      await db.removePhotoTagRelationshipsBatch(deletedIds);
      await db.removePhotosBatch(deletedIds);
      log('🗑️  Deleted files removed from database.');
    }
    
    // Process new and modified files
    const filesToProcess = [...newFiles, ...modifiedFiles];
    const batchSize = CONFIG.BATCH_SIZE;
    let processedCount = 0;
    let errorCount = 0;
    const photoFolderRelationships = [];
    const photoTagRelationships = [];
    
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(filesToProcess.length / batchSize);
      const progressPercent = ((i + batch.length) / filesToProcess.length * 100).toFixed(1);
      const elapsed = Date.now() - startTime;
      
      log(`📦 Batch ${batchNumber}/${totalBatches} (${progressPercent}%) - ${batch.length} items`);
      log(`   ⏱️  Elapsed: ${formatDuration(elapsed)}`);
      
      // Parallelize stat and metadata reads with optimized concurrency
      const limit = Math.min(CONFIG.MAX_CONCURRENT_OPERATIONS, batch.length);
      const batchPhotos = [];
      let batchErrorCount = 0;
      let batchProcessedCount = 0;
      
      log(`   🔄 Processing ${batch.length} files with ${limit} concurrent operations...`);
      
      const tasks = batch.map(({ fileId, entry }) => async () => {
        try {
          const photoDir = path.join(imagesDir, entry.name);
          let metadata;
          const metadataPath = path.join(photoDir, 'metadata.json');
          try {
            const data = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(data);
            if (!metadata.id) metadata.id = fileId;
            if (mtimeData[fileId]) metadata.mtime = mtimeData[fileId];
          } catch (error) {
            // generateFallbackMetadata removed - skipping file
            log('⚠️  Skipping ' + fileId + ' - generateFallbackMetadata removed');
            return;
          }
          if (metadata) {
            const metadataString = JSON.stringify(metadata);
            const metadataHash = CryptoJS.SHA1(metadataString).toString();
            metadata.metadata_hash = metadataHash;
            
            // Clean metadata object to only include database columns
            const cleanMetadata = {
              id: metadata.id,
              name: metadata.name,
              ext: metadata.ext,
              size: metadata.size,
              mtime: metadata.mtime,
              type: metadata.type || 'unknown',
              width: metadata.width,
              height: metadata.height,
              duration: metadata.duration,
              fps: metadata.fps,
              codec: metadata.codec,
              audioCodec: metadata.audioCodec,
              bitrate: metadata.bitrate,
              sampleRate: metadata.sampleRate,
              channels: metadata.channels,
              exif: metadata.exif,
              gps: metadata.gps,
              camera: metadata.camera,
              dateTime: metadata.dateTime,
              btime: metadata.btime ? new Date(metadata.btime).toISOString() : null,
              url: metadata.url || '',
              annotation: metadata.annotation || '',

              metadata_hash: metadata.metadata_hash,
              // Convert timestamp fields from metadata (Unix timestamps to ISO strings)
              created_at: metadata.btime ? new Date(metadata.btime).toISOString() : null,
              updated_at: (metadata.modificationTime || metadata.lastModified) ? new Date(metadata.modificationTime || metadata.lastModified).toISOString() : null
            };
            
            batchPhotos.push({ cleanMetadata, originalMetadata: metadata });
            batchProcessedCount++;
          }
        } catch (error) {
          log('⚠️  Failed to process ' + entry.name + ': ' + error.message);
          batchErrorCount++;
        }
      });
      
      // Run with optimized concurrency limit
      let taskIndex = 0;
      async function runNext() {
        if (taskIndex >= tasks.length) return;
        const idx = taskIndex++;
        await tasks[idx]();
        await runNext();
      }
      await Promise.all(Array.from({ length: limit }, runNext));
      processedCount += batchProcessedCount;
      errorCount += batchErrorCount;
      
      // Update progress for file processing phase
      updateProgress(processedCount, filesToProcess.length, 'processing');
      
      // Memory monitoring for metadata processing
      const memoryUsage = getMemoryUsage();
      log(`   💾 Memory after batch: ${memoryUsage.heapUsed}MB used / ${memoryUsage.heapTotal}MB total`);
      
      // Clear batch data to free memory
      batch.length = 0;
      tasks.length = 0;
      
      if (batchPhotos.length > 0) {
        // Use batched database operations for better performance
        try {
          const cleanPhotos = batchPhotos.map(item => item.cleanMetadata);
          log(`💾 Batch inserting/updating ${cleanPhotos.length} photos...`);
          await db.insertPhotosBatch(cleanPhotos);
          log(`✅ Successfully processed ${cleanPhotos.length} photos in batch`);
          
          // Now collect relationships after photos are inserted
          for (const item of batchPhotos) {
            const { originalMetadata } = item;
            if (originalMetadata.folders && Array.isArray(originalMetadata.folders)) {
              for (const folderId of originalMetadata.folders) {
                photoFolderRelationships.push({ photoId: originalMetadata.id, folderId });
              }
            }
            if (originalMetadata.tags && Array.isArray(originalMetadata.tags)) {
              for (const tag of originalMetadata.tags) {
                if (tag && typeof tag === 'string') {
                  photoTagRelationships.push({ photoId: originalMetadata.id, tag });
                }
              }
            }
          }
        } catch (error) {
          log('❌ Batch database operation failed: ' + error.message);
          // Fallback to individual operations if batch fails
          log('🔄 Falling back to individual operations...');
          for (const item of batchPhotos) {
            try {
              await db.upsertPhoto(item.cleanMetadata);
            } catch (individualError) {
              log('⚠️  Failed to upsert photo ' + item.cleanMetadata.id + ': ' + individualError.message);
              errorCount++;
            }
          }
        }
      }
    }
    
    // Update photo-folder relationships with memory-efficient processing
    if (photoFolderRelationships.length > 0) {
      log(`📁 Updating ${photoFolderRelationships.length} photo-folder relationships...`);
      
      try {
        // Remove old relationships for modified files in batch
        const modifiedIds = modifiedFiles.map(f => f.fileId);
        if (modifiedIds.length > 0) {
          log(`🗑️  Removing old folder relationships for ${modifiedIds.length} modified files...`);
          await db.removePhotoFolderRelationshipsBatch(modifiedIds);
        }
        
        // Insert new relationships in chunks for memory efficiency
        const relationshipChunkSize = CONFIG.RELATIONSHIP_BATCH_SIZE;
        for (let i = 0; i < photoFolderRelationships.length; i += relationshipChunkSize) {
          const chunk = photoFolderRelationships.slice(i, i + relationshipChunkSize);
          const chunkNumber = Math.floor(i / relationshipChunkSize) + 1;
          const totalChunks = Math.ceil(photoFolderRelationships.length / relationshipChunkSize);
          
          log(`➕ Inserting folder relationships chunk ${chunkNumber}/${totalChunks} (${chunk.length} relationships)...`);
          await db.insertPhotoFolderRelationships(chunk);
          
          // Memory monitoring
          const memoryUsage = getMemoryUsage();
          log(`   💾 Memory after relationship chunk: ${memoryUsage.heapUsed}MB used`);
          
          // Clear chunk data
          chunk.length = 0;
        }
        log(`✅ Folder relationships updated successfully`);
      } catch (error) {
        log('❌ Failed to update folder relationships: ' + error.message);
      }
    }
    
    // Update photo-tag relationships with memory-efficient processing
    if (photoTagRelationships.length > 0) {
      log(`🏷️  Updating ${photoTagRelationships.length} photo-tag relationships...`);
      
      try {
        // Remove old tag relationships for modified files in batch
        const modifiedIds = modifiedFiles.map(f => f.fileId);
        if (modifiedIds.length > 0) {
          log(`🗑️  Removing old tag relationships for ${modifiedIds.length} modified files...`);
          await db.removePhotoTagRelationshipsBatch(modifiedIds);
        }
        
        // Insert new relationships in chunks for memory efficiency
        const relationshipChunkSize = CONFIG.RELATIONSHIP_BATCH_SIZE;
        for (let i = 0; i < photoTagRelationships.length; i += relationshipChunkSize) {
          const chunk = photoTagRelationships.slice(i, i + relationshipChunkSize);
          const chunkNumber = Math.floor(i / relationshipChunkSize) + 1;
          const totalChunks = Math.ceil(photoTagRelationships.length / relationshipChunkSize);
          
          log(`➕ Inserting tag relationships chunk ${chunkNumber}/${totalChunks} (${chunk.length} relationships)...`);
          await db.insertPhotoTagRelationships(chunk);
          
          // Memory monitoring
          const memoryUsage = getMemoryUsage();
          log(`   💾 Memory after relationship chunk: ${memoryUsage.heapUsed}MB used`);
          
          // Clear chunk data
          chunk.length = 0;
        }
        log(`✅ Tag relationships updated successfully`);
      } catch (error) {
        log('❌ Failed to update tag relationships: ' + error.message);
      }
    }
    
    // Update cache info
    await db.updateCacheInfo('last_refresh', new Date().toISOString());
    const newTotal = await db.getPhotoCount();
    await db.updateCacheInfo('total_photos', newTotal.toString());
    
    const totalTime = Date.now() - startTime;
    
    // Update progress to show completion
    updateProgress(filesToProcess.length, filesToProcess.length, 'completed');
    
    log('─'.repeat(80));
    log('✅ Incremental update completed!');
    log(`📊 Results:`);
    log(`   🆕 New files: ${newFiles.length}`);
    log(`   🔄 Modified files: ${modifiedFiles.length}`);
    log(`   ✅ Successfully processed: ${processedCount}`);
    log(`   ⚠️  Errors: ${errorCount}`);
    log(`   ⏱️  Total time: ${formatDuration(totalTime)}`);
    log(`   📁 Folder relationships: ${photoFolderRelationships.length}`);
    log(`   🏷️  Tag relationships: ${photoTagRelationships.length}`);
    log(`   📸 Total photos in database: ${newTotal.toLocaleString()}`);
    
    log('─'.repeat(80));
    log('🎉 Database updated successfully!');
    
  } catch (error) {
    log('❌ Incremental update failed: ' + error);
    process.exit(1);
  }
}

async function checkIfFileNeedsUpdate(fileId, photoDir, dirMtime, mtimeData, dbLastRefresh) {
  try {
    // Check if directory was modified after database last refresh
    if (dirMtime > dbLastRefresh) {
      return true;
    }
    
    // Check mtime data if available
    if (mtimeData[fileId]) {
      const fileMtime = new Date(mtimeData[fileId]);
      if (fileMtime > dbLastRefresh) {
        return true;
      }
    }
    
    // Check if metadata.json was modified
    const metadataPath = path.join(photoDir, 'metadata.json');
    try {
      const metadataStats = await fs.stat(metadataPath);
      if (metadataStats.mtime > dbLastRefresh) {
        return true;
      }
    } catch (error) {
      // metadata.json doesn't exist, but that's okay
    }
    
    return false;
  } catch (error) {
    console.log('Failed to check if ' + fileId + ' needs update: ' + error.message);
    return true; // Assume it needs update if we can't check
  }
}

// Helper functions

function determineTypeFromExt(ext) {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'heic', 'heif', 'avif'];
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'opus', 'wma'];
  
  if (imageExts.includes(ext.toLowerCase())) return 'image';
  if (videoExts.includes(ext.toLowerCase())) return 'video';
  if (audioExts.includes(ext.toLowerCase())) return 'audio';
  
  return 'unknown';
}

// Run the script
if (require.main === module) {
  updateDatabaseIncremental({ logs: [] })
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.log('❌ Script failed: ' + error);
      process.exit(1);
    });
}

module.exports = { updateDatabaseIncremental }; 