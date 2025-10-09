const PhotoLibraryDatabase = require('./database');
const path = require('path');

const LIBRARY_PATH = process.env.LIBRARY_PATH || 'X:\\Photos\\lib\\homework.library';
const DB_PATH = path.join(LIBRARY_PATH, 'photo-library.db');

async function testDatabasePerformance() {
  console.log('🚀 Testing Database Performance Optimizations\n');
  
  const db = new PhotoLibraryDatabase(DB_PATH);
  
  try {
    // Initialize database
    console.log('📊 Initializing database...');
    await db.initialize();
    
    // Test 1: Basic photo count
    console.log('\n📈 Test 1: Basic photo count');
    const countStart = Date.now();
    const totalPhotos = db.db.prepare('SELECT COUNT(*) as count FROM photos').get().count;
    const countDuration = Date.now() - countStart;
    console.log(`✅ Total photos: ${totalPhotos.toLocaleString()}`);
    console.log(`⚡ Count query: ${countDuration}ms`);
    
    // Test 2: Paginated photos (folder)
    console.log('\n📈 Test 2: Paginated photos (folder)');
    const folderStart = Date.now();
    const folderResult = await db.getPhotosPaginated({
      folderId: 'LZX5GFLAA8NWT', // Use a real folder ID if available
      limit: 50,
      offset: 0,
      orderBy: 'mtime',
      orderDirection: 'DESC'
    });
    const folderDuration = Date.now() - folderStart;
    console.log(`✅ Folder photos: ${folderResult.photos.length} (total: ${folderResult.total.toLocaleString()})`);
    console.log(`⚡ Folder query: ${folderDuration}ms`);
    
    // Test 3: Paginated photos (all) - with folders/tags
    console.log('\n📈 Test 3: Paginated photos (all) - with folders/tags');
    const allStart = Date.now();
    const allResult = await db.getPhotosPaginated({
      folderId: null,
      limit: 100,
      offset: 0,
      orderBy: 'mtime',
      orderDirection: 'DESC'
    });
    const allDuration = Date.now() - allStart;
    console.log(`✅ All photos: ${allResult.photos.length} (total: ${allResult.total.toLocaleString()})`);
    console.log(`⚡ All photos query: ${allDuration}ms`);
    
    // Test 3b: Paginated photos (all) - fast version without folders/tags
    console.log('\n📈 Test 3b: Paginated photos (all) - fast version');
    const allFastStart = Date.now();
    const allFastResult = await db.getPhotosPaginatedFast({
      folderId: null,
      limit: 100,
      offset: 0,
      orderBy: 'mtime',
      orderDirection: 'DESC'
    });
    const allFastDuration = Date.now() - allFastStart;
    console.log(`✅ All photos (fast): ${allFastResult.photos.length} (total: ${allFastResult.total.toLocaleString()})`);
    console.log(`⚡ All photos query (fast): ${allFastDuration}ms`);
    
    // Test 4: Search performance
    console.log('\n📈 Test 4: Search performance');
    const searchStart = Date.now();
    const searchResult = await db.searchPhotos({
      query: 'jpg',
      limit: 50,
      offset: 0,
      orderBy: 'mtime',
      orderDirection: 'DESC'
    });
    const searchDuration = Date.now() - searchStart;
    console.log(`✅ Search results: ${searchResult.length}`);
    console.log(`⚡ Search query: ${searchDuration}ms`);
    
    // Test 5: Folder counts
    console.log('\n📈 Test 5: Folder counts');
    const countsStart = Date.now();
    const folderCounts = await db.getPhotoCountsByFolder();
    const countsDuration = Date.now() - countsStart;
    console.log(`✅ Folder counts: ${Object.keys(folderCounts).length} folders`);
    console.log(`⚡ Folder counts query: ${countsDuration}ms`);
    
    // Performance summary
    console.log('\n📊 Performance Summary:');
    console.log('─'.repeat(50));
    console.log(`Total photos in database: ${totalPhotos.toLocaleString()}`);
    console.log(`Count query: ${countDuration}ms`);
    console.log(`Folder pagination: ${folderDuration}ms`);
    console.log(`All photos pagination (with folders/tags): ${allDuration}ms`);
    console.log(`All photos pagination (fast): ${allFastDuration}ms`);
    console.log(`Search query: ${searchDuration}ms`);
    console.log(`Folder counts: ${countsDuration}ms`);
    
    // Calculate performance metrics
    const photosPerSecond = totalPhotos > 0 ? Math.round((totalPhotos / countDuration) * 1000) : 0;
    const speedImprovement = allDuration > 0 ? Math.round(((allDuration - allFastDuration) / allDuration) * 100) : 0;
    console.log(`\n⚡ Performance Metrics:`);
    console.log(`Photos per second (count): ${photosPerSecond.toLocaleString()}`);
    console.log(`Fast version improvement: ${speedImprovement}% faster`);
    console.log(`Average query time: ${Math.round((countDuration + folderDuration + allDuration + allFastDuration + searchDuration + countsDuration) / 6)}ms`);
    
    console.log('\n✅ Performance test completed successfully!');
    
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    console.error(error.stack);
  } finally {
    if (db.db) {
      db.db.close();
    }
  }
}

// Run the performance test
if (require.main === module) {
  testDatabasePerformance().catch(console.error);
}

module.exports = { testDatabasePerformance };