const fs = require('fs');
const Database = require('better-sqlite3');
const { getDatabasePath, getMetadataCachePath } = require('./config-loader');

const dbPath = getDatabasePath();
const metadataPath = getMetadataCachePath();

console.log('DB Path:', dbPath);
console.log('Metadata Path:', metadataPath);
console.log('DB Path exists:', fs.existsSync(dbPath));
console.log('Metadata Path exists:', fs.existsSync(metadataPath));

const db = new Database(dbPath);

// 1. Create the join table
console.log('Creating photo_folders table if not exists...');
db.prepare(`
  CREATE TABLE IF NOT EXISTS photo_folders (
    photo_id TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    PRIMARY KEY (photo_id, folder_id),
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
  )
`).run();

if (!fs.existsSync(metadataPath)) {
  console.error('❌ server-metadata-cache.json not found');
  process.exit(1);
}
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const metaById = {};
for (const entry of metadata) {
  metaById[entry.id] = entry;
}
const photos = db.prepare('SELECT id FROM photos').all();
const insertStmt = db.prepare('INSERT OR IGNORE INTO photo_folders (photo_id, folder_id) VALUES (?, ?)');
let inserted = 0, missing = 0, totalLinks = 0;
for (const photo of photos) {
  const meta = metaById[photo.id];
  if (meta && Array.isArray(meta.folders) && meta.folders.length > 0) {
    for (const folderId of meta.folders) {
      insertStmt.run(photo.id, folderId);
      inserted++;
    }
    totalLinks += meta.folders.length;
  } else {
    missing++;
  }
}
console.log(`✅ Inserted ${inserted} photo-folder links for ${photos.length} photos. ${missing} had no folder info.`);
db.close();
console.log('✅ Migration complete.'); 