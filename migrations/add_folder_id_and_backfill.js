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

function backfillFolderIds() {
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
  const updateStmt = db.prepare('UPDATE photos SET folder_id = ? WHERE id = ?');
  let updated = 0, missing = 0, multi = 0;
  for (const photo of photos) {
    const meta = metaById[photo.id];
    if (meta && Array.isArray(meta.folders)) {
      if (meta.folders.length === 1) {
        updateStmt.run(meta.folders[0], photo.id);
        updated++;
      } else if (meta.folders.length > 1) {
        console.warn(`⚠️  Photo ${photo.id} has multiple folder ids: ${JSON.stringify(meta.folders)}. Skipping.`);
        multi++;
      } else {
        missing++;
      }
    } else {
      missing++;
    }
  }
  console.log(`✅ Backfilled folder_id for ${updated} photos. ${multi} had multiple folder ids and were skipped. ${missing} had no folder info.`);
}

backfillFolderIds();
db.close();
console.log('✅ Migration complete.'); 