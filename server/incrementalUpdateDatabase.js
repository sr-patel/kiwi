const path = require('path');
const fs = require('fs').promises;
const PhotoLibraryDatabase = require('./database');
const CryptoJS = require('crypto-js');
const os = require('os');
const { getLibraryPath, getDatabasePath } = require('./config-loader');

const LIBRARY_PATH = getLibraryPath();
const DB_PATH = getDatabasePath();

// Optimized configuration for incremental updates
const CONFIG = {
  CHUNK_SIZE: 2000,                     // Larger chunks for faster scanning
  CONCURRENCY_LIMIT: Math.min(200, os.cpus().length * 12),  // Very aggressive for fast detection
  BATCH_SIZE: 1000,                     // Large batch operations
  RELATIONSHIP_BATCH_SIZE: 20000,       // Very large relationship batches
  ENABLE_SMART_DETECTION: true,         // Use multiple detection methods
  ENABLE_HASH_COMPARISON: true,         // Compare metadata hashes for changes
  ENABLE_DELETION_DETECTION: true,      // Detect and remove deleted files
  ENABLE_PROGRESS_LOGGING: true,
};

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

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
  };
}

async function incrementalUpdateDatabase(progress = { logs: [] }) {
  const startTime = Date.now();
  const phaseTimings = {};
  
  progress.status = 'running';
  progress.startTime = new Date().toISOString();
  progress.logs = [];
  progress.error = null;
  progress.totalFiles = 0;
  progress.processedFiles = 0;
  progress.percent = 0;
  progress.eta = null;
  progress.elapsed = 0;
  progress.phase = 'initialization';

  function updateProgress(processed, total, currentPhase = '') {
    progress.processedFiles = processed;
    progress.totalFiles = total;
    progress.percent = total > 0 ? Math.round((processed / total) * 100) : 0;
    progress.elapsed = Date.now() - startTime;
    progress.phase = currentPhase;
    
    if (processed > 0 && progress.elapsed > 0) {
      const rate = processed / (progress.elapsed / 1000);
      const remaining = total - processed;
      const etaSeconds = remaining / rate;
      if (etaSeconds > 0 && etaSeconds < 86400) {
        const etaMinutes = Math.round(etaSeconds / 60);
        progress.eta = etaMinutes > 60 ? `${Math.round(etaMinutes / 60)}h ${etaMinutes % 60}m` : `${etaMinutes}m`;
      } else {
        progress.eta = null;
      }
    }
  }

  function log(msg) {
    progress.logs.push(`[${new Date().toISOString()}] ${msg}`);
    if (progress.logs.length > 200) progress.logs.shift();
    console.log(msg);
  }

  function startPhase(phaseName) {
    phaseTimings[phaseName] = Date.now();
    log(`\n${'='.repeat(80)}`);
    log(`🚀 PHASE: ${phaseName.toUpperCase()}`);
    log('='.repeat(80));
  }

  function endPhase(phaseName) {
    const duration = Date.now() - phaseTimings[phaseName];
    log(`✅ Phase "${phaseName}" completed in ${formatDuration(duration)}`);
    log('='.repeat(80));
  }

  log('\n' + '⚡'.repeat(80));
  log('⚡' + ' '.repeat(78) + '⚡');
  log('⚡' + '     🔄 INCREMENTAL DATABASE UPDATE - Smart Change Detection'.padEnd(79) + '⚡');
  log('⚡' + ' '.repeat(78) + '⚡');
  log('⚡'.repeat(80) + '\n');
  log(`📁 Library path: ${LIBRARY_PATH}`);
  log(`🗄️  Database path: ${DB_PATH}`);
  log(`💻 System: ${os.cpus().length} CPU cores, ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB RAM`);
  log('─'.repeat(80));
  
  try {
    // PHASE 1: Validation
    startPhase('validation');
    updateProgress(0, 100, 'validation');
    
    log('🔍 Validating library structure...');
    const libraryExists = await fs.access(LIBRARY_PATH).then(() => true).catch(() => false);
    if (!libraryExists) {
      throw new Error(`Library path not found: ${LIBRARY_PATH}`);
    }
    
    const imagesDir = path.join(LIBRARY_PATH, 'images');
    const mtimePath = path.join(LIBRARY_PATH, 'mtime.json');
    
    const [imagesExists, mtimeExists] = await Promise.all([
      fs.access(imagesDir).then(() => true).catch(() => false),
      fs.access(mtimePath).then(() => true).catch(() => false)
    ]);
    
    if (!imagesExists) {
      throw new Error(`Images directory not found: ${imagesDir}`);
    }
    
    log('✅ Library structure validated');
    log(`   ⏰ mtime.json: ${mtimeExists ? '✅ Found' : '⚠️  Missing (will use file stats)'}`);
    
    endPhase('validation');
    
    // PHASE 2: Database Connection
    startPhase('database_init');
    updateProgress(5, 100, 'database_init');
    
    log('🗄️  Connecting to database...');
    const db = new PhotoLibraryDatabase(DB_PATH);
    await db.initialize();
    log('✅ Database connected');
    
    // Get last refresh time
    const lastRefresh = await db.getCacheInfo('last_refresh');
    const dbLastRefresh = lastRefresh ? new Date(lastRefresh) : new Date(0);
    const timeSinceLastRefresh = Date.now() - dbLastRefresh.getTime();
    
    log(`📅 Last database update: ${dbLastRefresh.toISOString()}`);
    log(`   ⏱️  Time since last update: ${formatDuration(timeSinceLastRefresh)}`);
    
    endPhase('database_init');
    
    // PHASE 3: Load Auxiliary Data
    startPhase('load_data');
    updateProgress(10, 100, 'load_data');
    
    let mtimeData = {};
    if (mtimeExists) {
      try {
        log('📖 Loading mtime data...');
        const mtimeRaw = await fs.readFile(mtimePath, 'utf8');
        mtimeData = JSON.parse(mtimeRaw);
        log(`✅ Loaded ${Object.keys(mtimeData).length.toLocaleString()} mtime entries`);
      } catch (error) {
        log(`⚠️  Failed to load mtime data: ${error.message}`);
      }
    }
    
    endPhase('load_data');
    
    // PHASE 4: Scan File System
    startPhase('scan_filesystem');
    updateProgress(15, 100, 'scan_filesystem');
    
    log('🔍 Scanning images directory...');
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    const photoDirs = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.info'));
    
    log(`📊 Found ${photoDirs.length.toLocaleString()} photo directories`);
    
    // Create set of disk IDs for quick lookup
    const diskIds = new Set(photoDirs.map(entry => entry.name.replace('.info', '')));
    
    endPhase('scan_filesystem');
    
    // PHASE 5: Analyze Changes
    startPhase('change_detection');
    updateProgress(20, 100, 'change_detection');
    
    // Get existing photos from database
    log('📊 Loading existing database entries...');
    const existingPhotos = await db.getPhotos();
    const existingIds = new Set(existingPhotos.map(p => p.id));
    const photoIdToHash = new Map();
    const photoIdToMtime = new Map();
    
    for (const p of existingPhotos) {
      if (p.metadata_hash) photoIdToHash.set(p.id, p.metadata_hash);
      if (p.updated_at) photoIdToMtime.set(p.id, new Date(p.updated_at));
    }
    
    log(`📊 Database contains ${existingIds.size.toLocaleString()} existing photos`);
    
    // Detect changes using smart parallel detection
    log('🔍 Analyzing changes with parallel processing...');
    log(`⚙️  Configuration: ${CONFIG.CHUNK_SIZE} files/chunk, ${CONFIG.CONCURRENCY_LIMIT} concurrent operations`);
    
    const newFiles = [];
    const modifiedFiles = [];
    const unchangedFiles = [];
    const errorFiles = [];
    
    // Process in chunks for better performance
    for (let chunkStart = 0; chunkStart < photoDirs.length; chunkStart += CONFIG.CHUNK_SIZE) {
      const chunk = photoDirs.slice(chunkStart, chunkStart + CONFIG.CHUNK_SIZE);
      const chunkNumber = Math.floor(chunkStart / CONFIG.CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(photoDirs.length / CONFIG.CHUNK_SIZE);
      
      log(`   📦 Analyzing chunk ${chunkNumber}/${totalChunks} (${chunk.length} files)`);
      
      const chunkStartTime = Date.now();
      
      // Parallel change detection
      const tasks = chunk.map(entry => async () => {
        const fileId = entry.name.replace('.info', '');
        const photoDir = path.join(imagesDir, entry.name);
        
        try {
          // Quick check: Is it a new file?
          if (!existingIds.has(fileId)) {
            return { type: 'new', fileId, entry };
          }
          
          // Smart change detection using multiple methods
          const needsUpdate = await detectChanges(
            fileId,
            photoDir,
            mtimeData,
            dbLastRefresh,
            photoIdToHash,
            photoIdToMtime
          );
          
          if (needsUpdate) {
            return { type: 'modified', fileId, entry };
          } else {
            return { type: 'unchanged', fileId };
          }
          
        } catch (error) {
          return { type: 'error', fileId, error: error.message };
        }
      });
      
      // Run with concurrency limit
      const results = [];
      let taskIndex = 0;
      
      async function runNext() {
        if (taskIndex >= tasks.length) return;
        const idx = taskIndex++;
        const result = await tasks[idx]();
        results.push(result);
        await runNext();
      }
      
      await Promise.all(
        Array.from(
          { length: Math.min(CONFIG.CONCURRENCY_LIMIT, tasks.length) },
          runNext
        )
      );
      
      // Process results
      for (const result of results) {
        switch (result.type) {
          case 'new':
            newFiles.push({ fileId: result.fileId, entry: result.entry });
            break;
          case 'modified':
            modifiedFiles.push({ fileId: result.fileId, entry: result.entry });
            break;
          case 'unchanged':
            unchangedFiles.push(result.fileId);
            break;
          case 'error':
            errorFiles.push({ fileId: result.fileId, error: result.error });
            break;
        }
      }
      
      const chunkDuration = Date.now() - chunkStartTime;
      const itemsPerSecond = Math.round((chunk.length / chunkDuration) * 1000);
      log(`   ⚡ Analyzed in ${formatDuration(chunkDuration)} (${itemsPerSecond} items/sec)`);
      
      updateProgress(20 + ((chunkStart + chunk.length) / photoDirs.length) * 20, 100, 'change_detection');
      
      // Clear chunk data
      chunk.length = 0;
      tasks.length = 0;
      results.length = 0;
    }
    
    log(`\n📊 Change detection complete:`);
    log(`   🆕 New files: ${newFiles.length.toLocaleString()}`);
    log(`   🔄 Modified files: ${modifiedFiles.length.toLocaleString()}`);
    log(`   ✅ Unchanged files: ${unchangedFiles.length.toLocaleString()}`);
    log(`   ⚠️  Error files: ${errorFiles.length.toLocaleString()}`);
    
    endPhase('change_detection');
    
    // PHASE 6: Handle Deletions
    if (CONFIG.ENABLE_DELETION_DETECTION) {
      startPhase('deletion_detection');
      updateProgress(40, 100, 'deletion_detection');
      
      const deletedIds = Array.from(existingIds).filter(id => !diskIds.has(id));
      
      if (deletedIds.length > 0) {
        log(`🗑️  Found ${deletedIds.length.toLocaleString()} deleted files`);
        log('   Removing from database...');
        
        await db.removePhotoTagRelationshipsBatch(deletedIds);
        await db.removePhotoFolderRelationshipsBatch(deletedIds);
        await db.removePhotosBatch(deletedIds);
        
        log(`✅ Deleted files removed from database`);
      } else {
        log('✅ No deletions detected');
      }
      
      endPhase('deletion_detection');
    }
    
    // PHASE 7: Process Updates
    const filesToProcess = [...newFiles, ...modifiedFiles];
    
    if (filesToProcess.length === 0) {
      log('\n✅ No updates needed - database is up to date!');
      
      // Update last refresh time
      await db.updateCacheInfo('last_refresh', new Date().toISOString());
      
      const totalTime = Date.now() - startTime;
      updateProgress(100, 100, 'completed');
      progress.status = 'completed';
      
      log(`\n⏱️  Total time: ${formatDuration(totalTime)}`);
      log('🎉 Incremental update completed successfully!');
      
      return {
        success: true,
        stats: {
          totalTime,
          newFiles: 0,
          modifiedFiles: 0,
          deletedFiles: CONFIG.ENABLE_DELETION_DETECTION ? deletedIds.length : 0,
          unchangedFiles: unchangedFiles.length,
          errorFiles: errorFiles.length
        }
      };
    }
    
    startPhase('process_updates');
    updateProgress(45, 100, 'process_updates');
    
    log(`\n🔄 Processing ${filesToProcess.length.toLocaleString()} files (${newFiles.length} new, ${modifiedFiles.length} modified)...`);
    
    let processedCount = 0;
    let errorCount = 0;
    const photoFolderRelationships = [];
    const photoTagRelationships = [];
    const modifiedIds = modifiedFiles.map(f => f.fileId);
    
    // Remove old relationships for modified files
    if (modifiedIds.length > 0) {
      log(`🗑️  Removing old relationships for ${modifiedIds.length.toLocaleString()} modified files...`);
      await db.removePhotoTagRelationshipsBatch(modifiedIds);
      await db.removePhotoFolderRelationshipsBatch(modifiedIds);
    }
    
    // Process updates in large batches
    for (let i = 0; i < filesToProcess.length; i += CONFIG.BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + CONFIG.BATCH_SIZE);
      const batchNumber = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(filesToProcess.length / CONFIG.BATCH_SIZE);
      
      log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} files)`);
      
      const batchStartTime = Date.now();
      const batchPhotos = [];
      
      // Parallel processing
      const tasks = batch.map(({ fileId, entry }) => async () => {
        try {
          const photoDir = path.join(imagesDir, entry.name);
          const metadataPath = path.join(photoDir, 'metadata.json');
          
          let metadata;
          try {
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(metadataContent);
            if (!metadata.id) metadata.id = fileId;
            if (mtimeData[fileId]) metadata.mtime = mtimeData[fileId];
          } catch (error) {
            // generateFallbackMetadata removed - skipping file
            console.log(`⚠️  Skipping ${fileId} - generateFallbackMetadata removed`);
            return;
          }
          
          if (!metadata) return;
          
          // Generate metadata hash
          const metadataString = JSON.stringify(metadata);
          const metadataHash = CryptoJS.SHA1(metadataString).toString();
          metadata.metadata_hash = metadataHash;
          
          // Clean metadata for database
          const cleanMetadata = {
            id: metadata.id,
            name: metadata.name,
            ext: metadata.ext,
            size: metadata.size || 0,
            mtime: metadata.mtime,
            type: metadata.type || determineTypeFromExt(metadata.ext),
            width: metadata.width || null,
            height: metadata.height || null,
            duration: metadata.duration || null,
            fps: metadata.fps || null,
            codec: metadata.codec || null,
            audioCodec: metadata.audioCodec || null,
            bitrate: metadata.bitrate || null,
            sampleRate: metadata.sampleRate || null,
            channels: metadata.channels || null,
            exif: metadata.exif || null,
            gps: metadata.gps || null,
            camera: metadata.camera || null,
            dateTime: metadata.dateTime || null,
            btime: metadata.btime ? new Date(metadata.btime).toISOString() : null,
            url: metadata.url || '',
            annotation: metadata.annotation || '',
            metadata_hash: metadata.metadata_hash,
            created_at: metadata.btime ? new Date(metadata.btime).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          batchPhotos.push({ cleanMetadata, originalMetadata: metadata });
          
        } catch (error) {
          log(`   ⚠️  Error processing ${entry.name}: ${error.message}`);
        }
      });
      
      // Run with concurrency limit
      let taskIndex = 0;
      async function runNext() {
        if (taskIndex >= tasks.length) return;
        const idx = taskIndex++;
        await tasks[idx]();
        await runNext();
      }
      
      await Promise.all(
        Array.from(
          { length: Math.min(CONFIG.CONCURRENCY_LIMIT, tasks.length) },
          runNext
        )
      );
      
      // Batch insert/update
      if (batchPhotos.length > 0) {
        try {
          const cleanPhotos = batchPhotos.map(item => item.cleanMetadata);
          await db.insertPhotosBatch(cleanPhotos);
          processedCount += batchPhotos.length;
          
          // Collect relationships
          for (const item of batchPhotos) {
            const { originalMetadata } = item;
            
            if (originalMetadata.folders && Array.isArray(originalMetadata.folders)) {
              for (const folderId of originalMetadata.folders) {
                photoFolderRelationships.push({ 
                  photoId: originalMetadata.id, 
                  folderId 
                });
              }
            }
            
            if (originalMetadata.tags && Array.isArray(originalMetadata.tags)) {
              for (const tag of originalMetadata.tags) {
                if (tag && typeof tag === 'string' && tag.trim()) {
                  photoTagRelationships.push({ 
                    photoId: originalMetadata.id, 
                    tag: tag.trim() 
                  });
                }
              }
            }
          }
          
        } catch (error) {
          log(`   ❌ Batch operation failed: ${error.message}`);
          errorCount += batch.length;
        }
      }
      
      const batchDuration = Date.now() - batchStartTime;
      const itemsPerSecond = Math.round((batch.length / batchDuration) * 1000);
      log(`   ⚡ Processed in ${formatDuration(batchDuration)} (${itemsPerSecond} items/sec)`);
      log(`   ✅ ${batchPhotos.length} photos updated`);
      
      updateProgress(45 + ((processedCount / filesToProcess.length) * 35), 100, 'process_updates');
      
      // Clear batch data
      batch.length = 0;
      tasks.length = 0;
      batchPhotos.length = 0;
    }
    
    endPhase('process_updates');
    
    // PHASE 8: Insert Relationships
    startPhase('insert_relationships');
    updateProgress(80, 100, 'insert_relationships');
    
    if (photoFolderRelationships.length > 0) {
      log(`📁 Inserting ${photoFolderRelationships.length.toLocaleString()} folder relationships...`);
      
      const relationshipChunkSize = CONFIG.RELATIONSHIP_BATCH_SIZE;
      for (let i = 0; i < photoFolderRelationships.length; i += relationshipChunkSize) {
        const relationshipChunk = photoFolderRelationships.slice(i, i + relationshipChunkSize);
        await db.insertPhotoFolderRelationships(relationshipChunk);
      }
      
      log(`✅ Folder relationships inserted`);
    }
    
    if (photoTagRelationships.length > 0) {
      log(`🏷️  Inserting ${photoTagRelationships.length.toLocaleString()} tag relationships...`);
      
      const relationshipChunkSize = CONFIG.RELATIONSHIP_BATCH_SIZE;
      for (let i = 0; i < photoTagRelationships.length; i += relationshipChunkSize) {
        const relationshipChunk = photoTagRelationships.slice(i, i + relationshipChunkSize);
        await db.insertPhotoTagRelationships(relationshipChunk);
      }
      
      log(`✅ Tag relationships inserted`);
    }
    
    endPhase('insert_relationships');
    
    // PHASE 9: Finalization
    startPhase('finalization');
    updateProgress(95, 100, 'finalization');
    
    await db.updateCacheInfo('last_refresh', new Date().toISOString());
    const finalCount = await db.getPhotoCount();
    await db.updateCacheInfo('total_photos', finalCount.toString());
    
    endPhase('finalization');
    
    // FINAL REPORT
    const totalTime = Date.now() - startTime;
    const deletedCount = CONFIG.ENABLE_DELETION_DETECTION ? 
      (Array.from(existingIds).filter(id => !diskIds.has(id))).length : 0;
    
    updateProgress(100, 100, 'completed');
    progress.status = 'completed';
    
    log('\n' + '⚡'.repeat(80));
    log('⚡' + ' '.repeat(78) + '⚡');
    log('⚡' + '       ✅ INCREMENTAL UPDATE COMPLETED'.padEnd(79) + '⚡');
    log('⚡' + ' '.repeat(78) + '⚡');
    log('⚡'.repeat(80) + '\n');
    
    log('📊 FINAL STATISTICS:');
    log('─'.repeat(80));
    log(`   ⏱️  Total time: ${formatDuration(totalTime)}`);
    log(`   ⚡ Speed: ${Math.round((filesToProcess.length / (totalTime / 1000)))} files/second`);
    log(`\n   📸 Changes:`);
    log(`      • New files: ${newFiles.length.toLocaleString()}`);
    log(`      • Modified files: ${modifiedFiles.length.toLocaleString()}`);
    log(`      • Deleted files: ${deletedCount.toLocaleString()}`);
    log(`      • Unchanged files: ${unchangedFiles.length.toLocaleString()}`);
    log(`      • Errors: ${errorCount.toLocaleString()}`);
    log(`\n   📊 Database:`);
    log(`      • Total photos: ${finalCount.toLocaleString()}`);
    log(`      • Folder relationships: ${photoFolderRelationships.length.toLocaleString()}`);
    log(`      • Tag relationships: ${photoTagRelationships.length.toLocaleString()}`);
    
    log('\n' + '─'.repeat(80));
    log('🎉 Database updated successfully!');
    log('─'.repeat(80) + '\n');
    
    return {
      success: true,
      stats: {
        totalTime,
        newFiles: newFiles.length,
        modifiedFiles: modifiedFiles.length,
        deletedFiles: deletedCount,
        unchangedFiles: unchangedFiles.length,
        errorFiles: errorFiles.length,
        processedCount,
        errorCount
      }
    };
    
  } catch (error) {
    log(`\n❌ CRITICAL ERROR: ${error.message}`);
    log(`   Stack: ${error.stack}`);
    progress.status = 'failed';
    progress.error = error.message;
    throw error;
  }
}

// Smart change detection using multiple methods
async function detectChanges(fileId, photoDir, mtimeData, dbLastRefresh, photoIdToHash, photoIdToMtime) {
  try {
    // Method 1: Check directory modification time
    const dirStats = await fs.stat(photoDir);
    if (dirStats.mtime > dbLastRefresh) {
      return true;
    }
    
    // Method 2: Check mtime.json data
    if (CONFIG.ENABLE_SMART_DETECTION && mtimeData[fileId]) {
      const fileMtime = new Date(mtimeData[fileId]);
      if (fileMtime > dbLastRefresh) {
        return true;
      }
    }
    
    // Method 3: Check metadata.json file modification
    const metadataPath = path.join(photoDir, 'metadata.json');
    try {
      const metadataStats = await fs.stat(metadataPath);
      if (metadataStats.mtime > dbLastRefresh) {
        return true;
      }
      
      // Method 4: Hash comparison (if enabled and available)
      if (CONFIG.ENABLE_HASH_COMPARISON && photoIdToHash.has(fileId)) {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        const metadata = JSON.parse(metadataContent);
        const metadataString = JSON.stringify(metadata);
        const currentHash = CryptoJS.SHA1(metadataString).toString();
        const storedHash = photoIdToHash.get(fileId);
        
        if (currentHash !== storedHash) {
          return true;
        }
      }
    } catch (error) {
      // metadata.json doesn't exist or can't be read
      return true;
    }
    
    return false;
  } catch (error) {
    // If we can't check, assume it needs update
    return true;
  }
}

// Helper functions

function determineTypeFromExt(ext) {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'heic', 'heif', 'avif'];
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'opus', 'wma', 'm4a'];
  
  const extLower = ext.toLowerCase();
  if (imageExts.includes(extLower)) return 'image';
  if (videoExts.includes(extLower)) return 'video';
  if (audioExts.includes(extLower)) return 'audio';
  
  return 'unknown';
}

// Run the script
if (require.main === module) {
  console.log('Starting incremental database update...\n');
  
  incrementalUpdateDatabase({ logs: [] })
    .then((result) => {
      console.log('\n✅ Incremental update completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Incremental update failed:', error.message);
      process.exit(1);
    });
}

module.exports = { incrementalUpdateDatabase };


