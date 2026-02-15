const path = require('path');
const fs = require('fs').promises;
const PhotoLibraryDatabase = require('./database');
const { getLibraryPath, getDatabasePath } = require('./config-loader');

const LIBRARY_PATH = getLibraryPath();
const DB_PATH = getDatabasePath();

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

async function generateDatabaseFromLibrary() {
  const startTime = Date.now();
  
  console.log('🔄 Starting database regeneration from library files...');
  console.log(`📁 Library path: ${LIBRARY_PATH}`);
  console.log(`🗄️  Database path: ${DB_PATH}`);
  console.log('─'.repeat(80));
  
  try {
    // Check if library exists
    console.log('🔍 Checking library structure...');
    const libraryExists = await fs.access(LIBRARY_PATH).then(() => true).catch(() => false);
    if (!libraryExists) {
      console.error('❌ Library path not found:', LIBRARY_PATH);
      process.exit(1);
    }
    
    // Check for required files
    const metadataPath = path.join(LIBRARY_PATH, 'metadata.json');
    const mtimePath = path.join(LIBRARY_PATH, 'mtime.json');
    const imagesDir = path.join(LIBRARY_PATH, 'images');
    
    const [metadataExists, mtimeExists, imagesExists] = await Promise.all([
      fs.access(metadataPath).then(() => true).catch(() => false),
      fs.access(mtimePath).then(() => true).catch(() => false),
      fs.access(imagesDir).then(() => true).catch(() => false)
    ]);
    
    if (!imagesExists) {
      console.error('❌ Images directory not found:', imagesDir);
      process.exit(1);
    }
    
    console.log('✅ Library structure validated');
    console.log(`   📄 Library metadata: ${metadataExists ? '✅' : '❌'}`);
    console.log(`   ⏰ Mtime data: ${mtimeExists ? '✅' : '❌'}`);
    console.log(`   📁 Images directory: ✅`);
    console.log('─'.repeat(80));
    
    // Initialize database
    console.log('🗄️  Initializing SQLite database...');
    const db = new PhotoLibraryDatabase(DB_PATH);
    await db.initialize();
    console.log('✅ Database initialized');
    
    // Clear existing data
    console.log('🧹 Clearing existing database data...');
    await db.clearAllData();
    console.log('✅ Database cleared');
    
    // Read library metadata if available
    let libraryMetadata = null;
    if (metadataExists) {
      try {
        console.log('📖 Reading library metadata...');
        const metadataData = await fs.readFile(metadataPath, 'utf8');
        libraryMetadata = JSON.parse(metadataData);
        console.log(`✅ Library metadata loaded (${libraryMetadata.folders?.length || 0} folders)`);
      } catch (error) {
        console.warn('⚠️  Failed to read library metadata:', error.message);
      }
    }
    
    // Read mtime data if available
    let mtimeData = {};
    if (mtimeExists) {
      try {
        console.log('📖 Reading mtime data...');
        const mtimeDataRaw = await fs.readFile(mtimePath, 'utf8');
        mtimeData = JSON.parse(mtimeDataRaw);
        console.log(`✅ Mtime data loaded (${Object.keys(mtimeData).length} entries)`);
      } catch (error) {
        console.warn('⚠️  Failed to read mtime data:', error.message);
      }
    }
    
    // Scan images directory
    console.log('🔍 Scanning images directory...');
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    const photoDirs = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.info'));
    
    console.log(`📊 Found ${photoDirs.length} photo directories`);
    console.log('─'.repeat(80));
    
    // Process photos in batches
    const batchSize = 100;
    const allPhotos = [];
    const photoFolderRelationships = [];
    let processedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < photoDirs.length; i += batchSize) {
      const batch = photoDirs.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(photoDirs.length / batchSize);
      const progress = ((i + batch.length) / photoDirs.length * 100).toFixed(1);
      const elapsed = Date.now() - startTime;
      
      console.log(`📦 Batch ${batchNumber}/${totalBatches} (${progress}%) - ${batch.length} items`);
      console.log(`   ⏱️  Elapsed: ${formatDuration(elapsed)}`);
      
      const batchPromises = batch.map(async (entry) => {
        try {
          const fileId = entry.name.replace('.info', '');
          const photoDir = path.join(imagesDir, entry.name);
          
          // Try to read metadata.json first
          let metadata;
          const metadataPath = path.join(photoDir, 'metadata.json');
          try {
            const data = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(data);
            
            // Add the photo ID if not present
            if (!metadata.id) {
              metadata.id = fileId;
            }
            
            // Add mtime data if available
            if (mtimeData[fileId]) {
              metadata.mtime = mtimeData[fileId];
            }
            
          } catch (error) {
            // generateFallbackMetadata removed - skipping file
            console.log(`⚠️  Skipping ${fileId} - generateFallbackMetadata removed`);
            return null;
          }
          
          if (metadata) {
            const relationships = [];
            
            // Extract folder relationships from metadata
            if (metadata.folders && Array.isArray(metadata.folders)) {
              for (const folderId of metadata.folders) {
                relationships.push({
                  photoId: fileId,
                  folderId: folderId
                });
              }
            }
            
            return { metadata, relationships };
          }
        } catch (error) {
          console.warn(`⚠️  Failed to process ${entry.name}:`, error.message);
          return { error: true };
        }
        return null;
      });

      const results = await Promise.all(batchPromises);
      const batchPhotos = [];

      for (const res of results) {
        if (!res) continue;

        if (res.error) {
          errorCount++;
        } else {
          batchPhotos.push(res.metadata);
          if (res.relationships && res.relationships.length > 0) {
            photoFolderRelationships.push(...res.relationships);
          }
          processedCount++;
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
    
    // Update cache info
    await db.updateCacheInfo('last_refresh', new Date().toISOString());
    await db.updateCacheInfo('total_photos', allPhotos.length.toString());
    await db.updateCacheInfo('source', 'library_files');
    
    const totalTime = Date.now() - startTime;
    
    console.log('─'.repeat(80));
    console.log('✅ Database regeneration completed!');
    console.log(`📊 Results:`);
    console.log(`   📸 Photos processed: ${processedCount.toLocaleString()}`);
    console.log(`   📁 Folder relationships: ${photoFolderRelationships.length.toLocaleString()}`);
    console.log(`   ⚠️  Errors: ${errorCount.toLocaleString()}`);
    console.log(`   ⏱️  Total time: ${formatDuration(totalTime)}`);
    console.log(`   🗄️  Database size: ${formatBytes(await db.getDatabaseSize())}`);
    
    // Get database stats
    const stats = await db.getStats();
    console.log(`📈 Database stats:`);
    console.log(`   📸 Total photos: ${stats.totalPhotos.toLocaleString()}`);
    console.log(`   📁 Total folders: ${stats.totalFolders.toLocaleString()}`);
    console.log(`   🏷️  Total tags: ${stats.totalTags.toLocaleString()}`);
    console.log(`   💾 Total size: ${formatBytes(stats.totalSize)}`);
    
    console.log('─'.repeat(80));
    console.log('🎉 Database is ready for use!');
    
  } catch (error) {
    console.error('❌ Database regeneration failed:', error);
    process.exit(1);
  }
}

// Helper functions

function determineTypeFromExt(ext) {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'heic', 'heif'];
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'opus', 'wma'];
  
  if (imageExts.includes(ext.toLowerCase())) return 'image';
  if (videoExts.includes(ext.toLowerCase())) return 'video';
  if (audioExts.includes(ext.toLowerCase())) return 'audio';
  
  return 'unknown';
}

// Run the script
if (require.main === module) {
  generateDatabaseFromLibrary()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { generateDatabaseFromLibrary }; 