const Database = require('better-sqlite3');
const { getDatabasePath } = require('./config-loader');

const dbPath = getDatabasePath();

console.log('DB Path:', dbPath);

const db = new Database(dbPath);

function checkDatabaseSchema() {
  console.log('🔍 Checking database schema...');
  
  try {
    // Get table info for photos table
    const tableInfo = db.prepare("PRAGMA table_info(photos)").all();
    
    console.log('📊 Photos table columns:');
    console.log('Column order:');
    tableInfo.forEach((col, index) => {
      console.log(`  ${index + 1}. ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
    });
    
    console.log('\n📋 Column names in order:');
    const columnNames = tableInfo.map(col => col.name);
    console.log(columnNames.join(', '));
    
    console.log('\n🔢 Total columns:', tableInfo.length);
    
    // Check for specific columns
    const hasFolderId = columnNames.includes('folder_id');
    const hasMetadataHash = columnNames.includes('metadata_hash');
    const hasBtime = columnNames.includes('btime');
    const hasUrl = columnNames.includes('url');
    const hasAnnotation = columnNames.includes('annotation');
    
    console.log('\n🔍 Column presence check:');
    console.log(`  folder_id: ${hasFolderId ? '✅' : '❌'}`);
    console.log(`  metadata_hash: ${hasMetadataHash ? '✅' : '❌'}`);
    console.log(`  btime: ${hasBtime ? '✅' : '❌'}`);
    console.log(`  url: ${hasUrl ? '✅' : '❌'}`);
    console.log(`  annotation: ${hasAnnotation ? '✅' : '❌'}`);
    
    // Generate the correct INSERT statement
    console.log('\n📝 Correct INSERT statement:');
    console.log(`INSERT OR REPLACE INTO photos (${columnNames.join(', ')}) VALUES (${columnNames.map(() => '?').join(', ')})`);
    
    console.log('\n📝 Number of placeholders needed:', columnNames.length);
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  }
}

// Run the check
checkDatabaseSchema();

// Close the database
db.close();

console.log('🏁 Schema check completed'); 