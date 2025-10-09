const path = require('path');
const fs = require('fs').promises;
const PhotoLibraryDatabase = require('./database');
const CryptoJS = require('crypto-js');
const os = require('os');
const { getLibraryPath, getDatabasePath } = require('./config-loader');

const LIBRARY_PATH = getLibraryPath();
const DB_PATH = getDatabasePath();

// Configuration for optimal performance
const CONFIG = {
  CHUNK_SIZE: 1000,                    // Large chunks for fast processing
  CONCURRENCY_LIMIT: Math.min(150, os.cpus().length * 10),  // Aggressive concurrency
  BATCH_SIZE: 500,                     // Large batch operations
  RELATIONSHIP_BATCH_SIZE: 10000,      // Very large relationship batches
  ENABLE_PROGRESS_LOGGING: true,       // Detailed progress logs
  ENABLE_MEMORY_MONITORING: true,      // Track memory usage
  ENABLE_VALIDATION: true,             // Validate data integrity
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
    external: Math.round(usage.external / 1024 / 1024)
  };
}

async function fullRebuildDatabase(progress = { logs: [] }) {
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

  log('\n' + '█'.repeat(80));
  log('█' + ' '.repeat(78) + '█');
  log('█' + '       🔄 FULL DATABASE REBUILD - Complete Regeneration'.padEnd(79) + '█');
  log('█' + ' '.repeat(78) + '█');
  log('█'.repeat(80) + '\n');
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
    const metadataPath = path.join(LIBRARY_PATH, 'metadata.json');
    const mtimePath = path.join(LIBRARY_PATH, 'mtime.json');
    const tagsPath = path.join(LIBRARY_PATH, 'tags.json');
    
    const [imagesExists, metadataExists, mtimeExists, tagsExists] = await Promise.all([
      fs.access(imagesDir).then(() => true).catch(() => false),
      fs.access(metadataPath).then(() => true).catch(() => false),
      fs.access(mtimePath).then(() => true).catch(() => false),
      fs.access(tagsPath).then(() => true).catch(() => false)
    ]);
    
    if (!imagesExists) {
      throw new Error(`Images directory not found: ${imagesDir}`);
    }
    
    log('✅ Library structure validated');
    log(`   📄 metadata.json: ${metadataExists ? '✅ Found' : '❌ Missing (will generate fallbacks)'}`);
    log(`   ⏰ mtime.json: ${mtimeExists ? '✅ Found' : '❌ Missing (will use file stats)'}`);
    log(`   🏷️  tags.json: ${tagsExists ? '✅ Found' : '❌ Missing (will extract from metadata)'}`);
    log(`   📁 images/: ✅ Found`);
    
    endPhase('validation');
    
    // PHASE 2: Database Initialization
    startPhase('database_init');
    updateProgress(10, 100, 'database_init');
    
    log('🗄️  Initializing database...');
    const db = new PhotoLibraryDatabase(DB_PATH);
    await db.initialize();
    log('✅ Database connected and initialized');
    
    // Check if database has existing data
    const existingCount = await db.getPhotoCount();
    if (existingCount > 0) {
      log(`⚠️  Database contains ${existingCount.toLocaleString()} existing photos`);
      await db.clearAllDataForRebuild();
    } else {
      log('✅ Database is empty, ready for fresh data');
    }
    
    endPhase('database_init');
    
    // PHASE 3: Load Library Metadata
    startPhase('load_metadata');
    updateProgress(20, 100, 'load_metadata');
    
    let libraryMetadata = null;
    let mtimeData = {};
    let tagsData = {};
    let folderMap = new Map();
    
    if (metadataExists) {
      try {
        log('📖 Loading library metadata...');
        const metadataRaw = await fs.readFile(metadataPath, 'utf8');
        libraryMetadata = JSON.parse(metadataRaw);
        
        if (libraryMetadata.folders) {
          // Build folder map for quick lookup
          function mapFolders(folders, parentPath = '') {
            for (const folder of folders) {
              folderMap.set(folder.id, {
                ...folder,
                fullPath: parentPath ? `${parentPath}/${folder.name}` : folder.name
              });
              if (folder.children && folder.children.length > 0) {
                mapFolders(folder.children, folderMap.get(folder.id).fullPath);
              }
            }
          }
          mapFolders(libraryMetadata.folders);
          log(`✅ Loaded ${folderMap.size} folders from metadata`);
        }
      } catch (error) {
        log(`⚠️  Failed to load library metadata: ${error.message}`);
      }
    }
    
    if (mtimeExists) {
      try {
        log('📖 Loading mtime data...');
        const mtimeRaw = await fs.readFile(mtimePath, 'utf8');
        mtimeData = JSON.parse(mtimeRaw);
        const mtimeCount = Object.keys(mtimeData).length;
        log(`✅ Loaded ${mtimeCount.toLocaleString()} mtime entries`);
      } catch (error) {
        log(`⚠️  Failed to load mtime data: ${error.message}`);
      }
    }
    
    if (tagsExists) {
      try {
        log('📖 Loading tags data...');
        const tagsRaw = await fs.readFile(tagsPath, 'utf8');
        tagsData = JSON.parse(tagsRaw);
        log(`✅ Loaded tags data`);
      } catch (error) {
        log(`⚠️  Failed to load tags data: ${error.message}`);
      }
    }
    
    endPhase('load_metadata');
    
    // PHASE 4: Scan File System
    startPhase('scan_filesystem');
    updateProgress(30, 100, 'scan_filesystem');
    
    log('🔍 Scanning images directory...');
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    const photoDirs = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.info'));
    
    log(`📊 Found ${photoDirs.length.toLocaleString()} photo directories to process`);
    
    endPhase('scan_filesystem');
    
    // PHASE 5: Process Photos
    startPhase('process_photos');
    updateProgress(40, photoDirs.length + 40, 'process_photos');
    
    log(`🔄 Processing ${photoDirs.length.toLocaleString()} photos with optimized batch operations...`);
    log(`⚙️  Configuration: ${CONFIG.CHUNK_SIZE} files/chunk, ${CONFIG.CONCURRENCY_LIMIT} concurrent operations`);
    
    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const photoFolderRelationships = [];
    const photoTagRelationships = [];
    const validationErrors = [];
    
    // Process in large chunks
    for (let chunkStart = 0; chunkStart < photoDirs.length; chunkStart += CONFIG.CHUNK_SIZE) {
      const chunk = photoDirs.slice(chunkStart, chunkStart + CONFIG.CHUNK_SIZE);
      const chunkNumber = Math.floor(chunkStart / CONFIG.CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(photoDirs.length / CONFIG.CHUNK_SIZE);
      
      log(`\n📦 Chunk ${chunkNumber}/${totalChunks} (${chunk.length} files)`);
      log(`   Progress: ${processedCount.toLocaleString()}/${photoDirs.length.toLocaleString()} (${((processedCount / photoDirs.length) * 100).toFixed(1)}%)`);
      
      if (CONFIG.ENABLE_MEMORY_MONITORING) {
        const mem = getMemoryUsage();
        log(`   💾 Memory: ${mem.heapUsed}MB used / ${mem.heapTotal}MB total (RSS: ${mem.rss}MB)`);
      }
      
      const chunkStartTime = Date.now();
      const batchPhotos = [];
      let batchErrorCount = 0;
      let batchSkippedCount = 0;
      
      // Parallel processing with concurrency limit
      const tasks = chunk.map(({ name: dirName }) => async () => {
        try {
          const fileId = dirName.replace('.info', '');
          const photoDir = path.join(imagesDir, dirName);
          
          // Read metadata
          let metadata;
          const metadataFilePath = path.join(photoDir, 'metadata.json');
          
          try {
            const metadataContent = await fs.readFile(metadataFilePath, 'utf8');
            metadata = JSON.parse(metadataContent);
            if (!metadata.id) metadata.id = fileId;
          } catch (error) {
            // generateFallbackMetadata removed - skipping file
            console.log(`⚠️  Skipping ${fileId} - generateFallbackMetadata removed`);
            batchSkippedCount++;
            return;
          }
          
          // Merge mtime if available
          if (mtimeData[fileId]) {
            metadata.mtime = mtimeData[fileId];
          }
          
          // Validate metadata
          if (CONFIG.ENABLE_VALIDATION) {
            const validation = validateMetadata(metadata);
            if (!validation.valid) {
              validationErrors.push({ fileId, errors: validation.errors });
              if (validation.errors.includes('missing_id') || validation.errors.includes('missing_name')) {
                batchSkippedCount++;
                return;
              }
            }
          }
          
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
          log(`   ⚠️  Error processing ${dirName}: ${error.message}`);
          batchErrorCount++;
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
      
      processedCount += chunk.length;
      errorCount += batchErrorCount;
      skippedCount += batchSkippedCount;
      
      // Batch insert photos
      if (batchPhotos.length > 0) {
        try {
          const cleanPhotos = batchPhotos.map(item => item.cleanMetadata);
          await db.insertPhotosBatch(cleanPhotos);
          log(`   ✅ Inserted ${cleanPhotos.length} photos`);
          
          // Collect relationships
          for (const item of batchPhotos) {
            const { originalMetadata } = item;
            
            // Folder relationships
            if (originalMetadata.folders && Array.isArray(originalMetadata.folders)) {
              for (const folderId of originalMetadata.folders) {
                photoFolderRelationships.push({ 
                  photoId: originalMetadata.id, 
                  folderId 
                });
              }
            }
            
            // Tag relationships
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
          log(`   ❌ Batch insert failed: ${error.message}`);
          log(`   🔄 Falling back to individual inserts...`);
          
          for (const item of batchPhotos) {
            try {
              await db.upsertPhoto(item.cleanMetadata);
            } catch (individualError) {
              log(`   ⚠️  Failed to insert ${item.cleanMetadata.id}: ${individualError.message}`);
              errorCount++;
            }
          }
        }
      }
      
      const chunkDuration = Date.now() - chunkStartTime;
      const itemsPerSecond = Math.round((chunk.length / chunkDuration) * 1000);
      log(`   ⚡ Chunk processed in ${formatDuration(chunkDuration)} (${itemsPerSecond} items/sec)`);
      log(`   📊 Chunk stats: ${batchPhotos.length} success, ${batchErrorCount} errors, ${batchSkippedCount} skipped`);
      
      updateProgress(40 + processedCount, photoDirs.length + 40, 'process_photos');
      
      // Clear chunk data
      chunk.length = 0;
      tasks.length = 0;
      batchPhotos.length = 0;
      
      // Force garbage collection if available
      if (global.gc) global.gc();
    }
    
    log(`\n📊 Photo processing summary:`);
    log(`   ✅ Successfully processed: ${(processedCount - errorCount - skippedCount).toLocaleString()}`);
    log(`   ⚠️  Errors: ${errorCount.toLocaleString()}`);
    log(`   ⏭️  Skipped: ${skippedCount.toLocaleString()}`);
    log(`   📁 Folder relationships collected: ${photoFolderRelationships.length.toLocaleString()}`);
    log(`   🏷️  Tag relationships collected: ${photoTagRelationships.length.toLocaleString()}`);
    
    if (CONFIG.ENABLE_VALIDATION && validationErrors.length > 0) {
      log(`   ⚠️  Validation warnings: ${validationErrors.length}`);
    }
    
    endPhase('process_photos');
    
    // PHASE 6: Insert Relationships
    startPhase('insert_relationships');
    updateProgress(photoDirs.length + 40, photoDirs.length + 60, 'insert_relationships');
    
    // Folder relationships
    if (photoFolderRelationships.length > 0) {
      log(`📁 Inserting ${photoFolderRelationships.length.toLocaleString()} folder relationships...`);
      
      const relationshipChunkSize = CONFIG.RELATIONSHIP_BATCH_SIZE;
      for (let i = 0; i < photoFolderRelationships.length; i += relationshipChunkSize) {
        const relationshipChunk = photoFolderRelationships.slice(i, i + relationshipChunkSize);
        const chunkNum = Math.floor(i / relationshipChunkSize) + 1;
        const totalChunks = Math.ceil(photoFolderRelationships.length / relationshipChunkSize);
        
        log(`   📦 Chunk ${chunkNum}/${totalChunks}: ${relationshipChunk.length.toLocaleString()} relationships`);
        await db.insertPhotoFolderRelationships(relationshipChunk);
      }
      
      log(`✅ Folder relationships inserted successfully`);
    }
    
    // Tag relationships
    if (photoTagRelationships.length > 0) {
      log(`🏷️  Inserting ${photoTagRelationships.length.toLocaleString()} tag relationships...`);
      
      const relationshipChunkSize = CONFIG.RELATIONSHIP_BATCH_SIZE;
      for (let i = 0; i < photoTagRelationships.length; i += relationshipChunkSize) {
        const relationshipChunk = photoTagRelationships.slice(i, i + relationshipChunkSize);
        const chunkNum = Math.floor(i / relationshipChunkSize) + 1;
        const totalChunks = Math.ceil(photoTagRelationships.length / relationshipChunkSize);
        
        log(`   📦 Chunk ${chunkNum}/${totalChunks}: ${relationshipChunk.length.toLocaleString()} relationships`);
        await db.insertPhotoTagRelationships(relationshipChunk);
      }
      
      log(`✅ Tag relationships inserted successfully`);
    }
    
    endPhase('insert_relationships');
    
    // PHASE 7: Finalization
    startPhase('finalization');
    updateProgress(photoDirs.length + 60, photoDirs.length + 100, 'finalization');
    
    // Update cache info
    log('📝 Updating cache information...');
    await db.updateCacheInfo('last_refresh', new Date().toISOString());
    await db.updateCacheInfo('last_full_rebuild', new Date().toISOString());
    const finalCount = await db.getPhotoCount();
    await db.updateCacheInfo('total_photos', finalCount.toString());
    await db.updateCacheInfo('source', 'full_rebuild');
    await db.updateCacheInfo('library_path', LIBRARY_PATH);
    
    // Get final statistics
    const stats = await db.getStats();
    const dbSize = await db.getDatabaseSize();
    
    endPhase('finalization');
    
    // FINAL REPORT
    const totalTime = Date.now() - startTime;
    updateProgress(photoDirs.length + 100, photoDirs.length + 100, 'completed');
    progress.status = 'completed';
    
    log('\n' + '█'.repeat(80));
    log('█' + ' '.repeat(78) + '█');
    log('█' + '       ✅ FULL DATABASE REBUILD COMPLETED'.padEnd(79) + '█');
    log('█' + ' '.repeat(78) + '█');
    log('█'.repeat(80) + '\n');
    
    log('📊 FINAL STATISTICS:');
    log('─'.repeat(80));
    log(`   ⏱️  Total time: ${formatDuration(totalTime)}`);
    log(`   ⚡ Average speed: ${Math.round((photoDirs.length / (totalTime / 1000)))} photos/second`);
    log(`\n   📸 Photos:`);
    log(`      • Total processed: ${processedCount.toLocaleString()}`);
    log(`      • Successfully imported: ${(processedCount - errorCount - skippedCount).toLocaleString()}`);
    log(`      • Errors: ${errorCount.toLocaleString()}`);
    log(`      • Skipped: ${skippedCount.toLocaleString()}`);
    log(`\n   📁 Folders:`);
    log(`      • Total folders: ${stats.totalFolders.toLocaleString()}`);
    log(`      • Photo-folder relationships: ${photoFolderRelationships.length.toLocaleString()}`);
    log(`\n   🏷️  Tags:`);
    log(`      • Unique tags: ${stats.totalTags.toLocaleString()}`);
    log(`      • Photo-tag relationships: ${photoTagRelationships.length.toLocaleString()}`);
    log(`\n   💾 Storage:`);
    log(`      • Database size: ${formatBytes(dbSize)}`);
    log(`      • Total media size: ${formatBytes(stats.totalSize)}`);
    log(`      • Average photo size: ${formatBytes(stats.totalSize / finalCount)}`);
    
    if (CONFIG.ENABLE_MEMORY_MONITORING) {
      const finalMem = getMemoryUsage();
      log(`\n   🧠 Memory:`);
      log(`      • Peak heap used: ${finalMem.heapUsed}MB`);
      log(`      • Total RSS: ${finalMem.rss}MB`);
    }
    
    log('\n   ⏱️  Phase Timings:');
    for (const [phase, startTime] of Object.entries(phaseTimings)) {
      const phaseDuration = Date.now() - startTime;
      const phasePercent = ((phaseDuration / totalTime) * 100).toFixed(1);
      log(`      • ${phase}: ${formatDuration(phaseDuration)} (${phasePercent}%)`);
    }
    
    log('\n' + '─'.repeat(80));
    log('🎉 Database is ready for use!');
    log('─'.repeat(80) + '\n');
    
    return {
      success: true,
      stats: {
        totalTime,
        processedCount,
        errorCount,
        skippedCount,
        finalCount,
        folderRelationships: photoFolderRelationships.length,
        tagRelationships: photoTagRelationships.length,
        dbSize
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

function validateMetadata(metadata) {
  const errors = [];
  
  if (!metadata.id) errors.push('missing_id');
  if (!metadata.name) errors.push('missing_name');
  if (!metadata.ext) errors.push('missing_ext');
  if (metadata.size === undefined || metadata.size === null) errors.push('missing_size');
  if (!metadata.type) errors.push('missing_type');
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Run the script
if (require.main === module) {
  console.log('Starting full database rebuild...\n');
  
  fullRebuildDatabase({ logs: [] })
    .then((result) => {
      console.log('\n✅ Full rebuild completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Full rebuild failed:', error.message);
      process.exit(1);
    });
}

module.exports = { fullRebuildDatabase };


