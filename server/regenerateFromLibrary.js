const path = require('path');
const fs = require('fs').promises;
const PhotoLibraryDatabase = require('./database');
const { getLibraryPath, getDatabasePath } = require('./config-loader');
const {
  listPhotoDirs,
  photoIdFromInfoDirName,
  upsertPhotoFromMetadata,
  loadMtimeData,
} = require('./librarySync');

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

async function generateDatabaseFromLibrary(options = {}) {
  const libraryPath = options.libraryPath || getLibraryPath();
  const dbPath = options.dbPath || getDatabasePath();
  const startTime = Date.now();

  if (!libraryPath || !dbPath) {
    throw new Error('Library path and database path must be configured');
  }

  console.log('🔄 Starting database regeneration from library files...');
  console.log(`📁 Library path: ${libraryPath}`);
  console.log(`🗄️  Database path: ${dbPath}`);

  const libraryExists = await fs.access(libraryPath).then(() => true).catch(() => false);
  if (!libraryExists) {
    throw new Error(`Library path not found: ${libraryPath}`);
  }

  const imagesDir = path.join(libraryPath, 'images');
  const imagesExists = await fs.access(imagesDir).then(() => true).catch(() => false);
  if (!imagesExists) {
    throw new Error(`Images directory not found: ${imagesDir}`);
  }

  const db = options.db instanceof PhotoLibraryDatabase
    ? options.db
    : new PhotoLibraryDatabase(dbPath);

  if (!(options.db instanceof PhotoLibraryDatabase)) {
    await db.initialize();
  }

  await db.clearAllData();

  const mtimeData = await loadMtimeData(libraryPath);
  const photoDirs = await listPhotoDirs(libraryPath);

  console.log(`📊 Processing ${photoDirs.length} photo directories...`);

  let processedCount = 0;
  let errorCount = 0;

  for (const entry of photoDirs) {
    const photoId = photoIdFromInfoDirName(entry.name);
    const metadataPath = path.join(imagesDir, entry.name, 'metadata.json');

    try {
      await upsertPhotoFromMetadata(db, photoId, metadataPath, { mtimeData });
      processedCount++;
    } catch (error) {
      console.warn(`⚠️  Failed to process ${entry.name}:`, error.message);
      errorCount++;
    }
  }

  await db.updateCacheInfo('last_refresh', new Date().toISOString());
  await db.updateCacheInfo('total_photos', processedCount.toString());
  await db.updateCacheInfo('source', 'library_files');

  const totalTime = Date.now() - startTime;
  const stats = await db.getStats();

  console.log('✅ Database regeneration completed!');
  console.log(`   📸 Photos processed: ${processedCount.toLocaleString()}`);
  console.log(`   ⚠️  Errors: ${errorCount.toLocaleString()}`);
  console.log(`   ⏱️  Total time: ${formatDuration(totalTime)}`);
  console.log(`   🗄️  Database size: ${formatBytes(await db.getDatabaseSize())}`);
  console.log(`   🏷️  Total tags: ${stats.totalTags.toLocaleString()}`);

  return { processedCount, errorCount, stats };
}

if (require.main === module) {
  generateDatabaseFromLibrary()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { generateDatabaseFromLibrary };
