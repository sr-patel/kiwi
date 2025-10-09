const path = require('path');
const fs = require('fs').promises;
const PhotoLibraryDatabase = require('./database');
const CryptoJS = require('crypto-js');
const os = require('os');
const { getLibraryPath, getDatabasePath } = require('./config-loader');

const LIBRARY_PATH = getLibraryPath();
const DB_PATH = getDatabasePath();

// Configuration for memory-efficient processing
const CONFIG = {
  CHUNK_SIZE: 500,
  CONCURRENCY_LIMIT: Math.min(50, os.cpus().length * 4),
  BATCH_SIZE: 50,
  RELATIONSHIP_BATCH_SIZE: 1000,
};

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

async function forceUpdateDatabase(progress = { logs: [] }) {
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

  function updateProgress(processed, total, currentPhase = '') {
    progress.processedFiles = processed;
    progress.totalFiles = total;
    progress.percent = total > 0 ? Math.round((processed / total) * 100) : 0;
    progress.elapsed = Date.now() - startTime;
    
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
    if (progress.logs.length > 100) progress.logs.shift();
    console.log(msg);
  }

  log('🔄 Starting FORCED database update (bypassing change detection)...');
  log(`📁 Library path: ${LIBRARY_PATH}`);
  log(`🗄️  Database path: ${DB_PATH}`);
  log('─'.repeat(80));
  
  try {
    // Check if library exists
    log('🔍 Checking library structure...');
    const libraryExists = await fs.access(LIBRARY_PATH).then(() => true).catch(() => false);
    if (!libraryExists) {
      log('❌ Library path not found: ' + LIBRARY_PATH);
      process.exit(1);
    }
    
    const imagesDir = path.join(LIBRARY_PATH, 'images');
    const imagesExists = await fs.access(imagesDir).then(() => true).catch(() => false);
    
    if (!imagesExists) {
      log('❌ Images directory not found: ' + imagesDir);
      process.exit(1);
    }
    
    log('✅ Library structure validated');
    log('─'.repeat(80));
    
    // Initialize database
    log('🗄️  Connecting to database...');
    const db = new PhotoLibraryDatabase(DB_PATH);
    await db.initialize();
    log('✅ Database connected');
    
    // Scan images directory
    log('🔍 Scanning images directory...');
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    const photoDirs = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.info'));
    
    log(`📊 Found ${photoDirs.length} photo directories`);
    log('─'.repeat(80));
    
    // Force update all files (no change detection)
    const filesToProcess = photoDirs.map(entry => ({
      fileId: entry.name.replace('.info', ''),
      entry
    }));
    
    log(`🔄 Force updating ${filesToProcess.length} files...`);
    updateProgress(0, filesToProcess.length, 'processing');
    
    let processedCount = 0;
    let errorCount = 0;
    const photoFolderRelationships = [];
    const photoTagRelationships = [];
    
    // Process files in chunks
    for (let chunkStart = 0; chunkStart < filesToProcess.length; chunkStart += CONFIG.CHUNK_SIZE) {
      const chunk = filesToProcess.slice(chunkStart, chunkStart + CONFIG.CHUNK_SIZE);
      const chunkNumber = Math.floor(chunkStart / CONFIG.CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(filesToProcess.length / CONFIG.CHUNK_SIZE);
      
      log(`📦 Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} files)...`);
      
      const batchPhotos = [];
      let batchErrorCount = 0;
      let batchProcessedCount = 0;
      
      const limit = Math.min(CONFIG.CONCURRENCY_LIMIT, chunk.length);
      const tasks = chunk.map(({ fileId, entry }) => async () => {
        try {
          const photoDir = path.join(imagesDir, entry.name);
          let metadata;
          const metadataPath = path.join(photoDir, 'metadata.json');
          
          try {
            const data = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(data);
            if (!metadata.id) metadata.id = fileId;
          } catch (error) {
            // generateFallbackMetadata removed - skipping file
            log('⚠️  Skipping ' + fileId + ' - generateFallbackMetadata removed');
            return;
          }
          
          if (metadata) {
            const metadataString = JSON.stringify(metadata);
            const metadataHash = CryptoJS.SHA1(metadataString).toString();
            metadata.metadata_hash = metadataHash;
            
            // Clean metadata object with proper timestamp conversion
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
      
      // Run with concurrency limit
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
      
      updateProgress(processedCount, filesToProcess.length, 'processing');
      
      if (batchPhotos.length > 0) {
        try {
          const cleanPhotos = batchPhotos.map(item => item.cleanMetadata);
          log(`💾 Batch updating ${cleanPhotos.length} photos...`);
          await db.insertPhotosBatch(cleanPhotos);
          log(`✅ Successfully updated ${cleanPhotos.length} photos in batch`);
          
          // Collect relationships
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
          // Fallback to individual operations
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
    
    // Update relationships
    if (photoFolderRelationships.length > 0) {
      log(`📁 Updating ${photoFolderRelationships.length} photo-folder relationships...`);
      try {
        // Remove all old relationships and insert new ones
        log('🗑️  Removing all old folder relationships...');
        await db.prepare('DELETE FROM photo_folders').run();
        
        const relationshipChunkSize = CONFIG.RELATIONSHIP_BATCH_SIZE;
        for (let i = 0; i < photoFolderRelationships.length; i += relationshipChunkSize) {
          const chunk = photoFolderRelationships.slice(i, i + relationshipChunkSize);
          const chunkNumber = Math.floor(i / relationshipChunkSize) + 1;
          const totalChunks = Math.ceil(photoFolderRelationships.length / relationshipChunkSize);
          
          log(`➕ Inserting folder relationships chunk ${chunkNumber}/${totalChunks} (${chunk.length} relationships)...`);
          await db.insertPhotoFolderRelationships(chunk);
        }
        log(`✅ Folder relationships updated successfully`);
      } catch (error) {
        log('❌ Failed to update folder relationships: ' + error.message);
      }
    }
    
    if (photoTagRelationships.length > 0) {
      log(`🏷️  Updating ${photoTagRelationships.length} photo-tag relationships...`);
      try {
        // Remove all old relationships and insert new ones
        log('🗑️  Removing all old tag relationships...');
        await db.prepare('DELETE FROM photo_tags').run();
        
        const relationshipChunkSize = CONFIG.RELATIONSHIP_BATCH_SIZE;
        for (let i = 0; i < photoTagRelationships.length; i += relationshipChunkSize) {
          const chunk = photoTagRelationships.slice(i, i + relationshipChunkSize);
          const chunkNumber = Math.floor(i / relationshipChunkSize) + 1;
          const totalChunks = Math.ceil(photoTagRelationships.length / relationshipChunkSize);
          
          log(`➕ Inserting tag relationships chunk ${chunkNumber}/${totalChunks} (${chunk.length} relationships)...`);
          await db.insertPhotoTagRelationships(chunk);
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
    updateProgress(filesToProcess.length, filesToProcess.length, 'completed');
    
    log('─'.repeat(80));
    log('✅ FORCED update completed!');
    log(`📊 Results:`);
    log(`   ✅ Successfully processed: ${processedCount}`);
    log(`   ⚠️  Errors: ${errorCount}`);
    log(`   ⏱️  Total time: ${formatDuration(totalTime)}`);
    log(`   📁 Folder relationships: ${photoFolderRelationships.length}`);
    log(`   🏷️  Tag relationships: ${photoTagRelationships.length}`);
    log(`   📸 Total photos in database: ${newTotal.toLocaleString()}`);
    
    log('─'.repeat(80));
    log('🎉 Database force updated successfully!');
    
  } catch (error) {
    log('❌ Force update failed: ' + error);
    process.exit(1);
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
  forceUpdateDatabase({ logs: [] })
    .then(() => {
      console.log('✅ Force update script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.log('❌ Force update script failed: ' + error);
      process.exit(1);
    });
}

module.exports = { forceUpdateDatabase }; 