const Database = require('better-sqlite3');
const { getDatabasePath } = require('./config-loader');

const dbPath = getDatabasePath();

console.log('DB Path:', dbPath);

const db = new Database(dbPath);

function addNewColumns() {
  console.log('🔧 Adding new columns to photos table...');
  
  try {
    // Add btime column
    console.log('  ➕ Adding btime column...');
    db.prepare('ALTER TABLE photos ADD COLUMN btime TEXT').run();
    
    // Add url column
    console.log('  ➕ Adding url column...');
    db.prepare('ALTER TABLE photos ADD COLUMN url TEXT').run();
    
    // Add annotation column
    console.log('  ➕ Adding annotation column...');
    db.prepare('ALTER TABLE photos ADD COLUMN annotation TEXT').run();
    
    console.log('✅ Successfully added new columns to photos table');
    
    // Verify the columns were added
    const tableInfo = db.prepare("PRAGMA table_info(photos)").all();
    const columnNames = tableInfo.map(col => col.name);
    
    console.log('📊 Current photos table columns:');
    columnNames.forEach(col => console.log(`  - ${col}`));
    
    // Check if our new columns exist
    const hasBtime = columnNames.includes('btime');
    const hasUrl = columnNames.includes('url');
    const hasAnnotation = columnNames.includes('annotation');
    
    console.log('🔍 Column verification:');
    console.log(`  btime: ${hasBtime ? '✅' : '❌'}`);
    console.log(`  url: ${hasUrl ? '✅' : '❌'}`);
    console.log(`  annotation: ${hasAnnotation ? '✅' : '❌'}`);
    
    if (hasBtime && hasUrl && hasAnnotation) {
      console.log('🎉 All new columns successfully added!');
    } else {
      console.log('⚠️  Some columns may not have been added successfully');
    }
    
  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
    
    // Check if columns already exist
    try {
      const tableInfo = db.prepare("PRAGMA table_info(photos)").all();
      const columnNames = tableInfo.map(col => col.name);
      
      console.log('📊 Current photos table columns:');
      columnNames.forEach(col => console.log(`  - ${col}`));
      
      if (columnNames.includes('btime') && columnNames.includes('url') && columnNames.includes('annotation')) {
        console.log('✅ All required columns already exist');
      }
    } catch (checkError) {
      console.error('❌ Error checking table structure:', checkError.message);
    }
  }
}

// Run the migration
addNewColumns();

// Close the database
db.close();

console.log('🏁 Migration script completed'); 