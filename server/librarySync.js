const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

function determineTypeFromExt(ext) {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'heic', 'heif', 'avif', 'svg'];
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'opus', 'wma', 'm4a'];
  const documentExts = ['pdf', 'epub', 'mobi', 'doc', 'docx', 'txt'];

  const extLower = String(ext || '').toLowerCase();
  if (imageExts.includes(extLower)) return 'image';
  if (videoExts.includes(extLower)) return 'video';
  if (audioExts.includes(extLower)) return 'audio';
  if (documentExts.includes(extLower)) return 'document';
  return 'unknown';
}

function hashMetadata(metadata) {
  return crypto.createHash('sha1').update(JSON.stringify(metadata)).digest('hex');
}

function normalizeMetadataForDb(metadata, photoId, mtimeData = {}) {
  if (!metadata.id) metadata.id = photoId;
  if (mtimeData[photoId]) metadata.mtime = mtimeData[photoId];

  const metadataHash = hashMetadata(metadata);

  return {
    cleanMetadata: {
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
      metadata_hash: metadataHash,
      created_at: metadata.btime ? new Date(metadata.btime).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    folders: Array.isArray(metadata.folders) ? metadata.folders : [],
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((t) => t && typeof t === 'string' && t.trim()) : [],
    metadataHash,
  };
}

async function loadMtimeData(libraryPath) {
  const mtimePath = path.join(libraryPath, 'mtime.json');
  try {
    const raw = await fs.readFile(mtimePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function upsertPhotoFromMetadata(db, photoId, metadataPath, options = {}) {
  const { mtimeData = {} } = options;

  let raw;
  try {
    raw = await fs.readFile(metadataPath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read metadata for ${photoId}: ${error.message}`);
  }

  const metadata = JSON.parse(raw);
  const { cleanMetadata, folders, tags } = normalizeMetadataForDb(metadata, photoId, mtimeData);

  await db.removePhotoTagRelationships(photoId);
  await db.removePhotoFolderRelationships(photoId);
  await db.upsertPhoto(cleanMetadata);

  if (folders.length > 0) {
    await db.insertPhotoFolderRelationships(
      folders.map((folderId) => ({ photoId, folderId }))
    );
  }

  if (tags.length > 0) {
    await db.insertPhotoTagRelationships(
      tags.map((tag) => ({ photoId, tag: tag.trim() }))
    );
  }

  return { photoId, metadataHash: cleanMetadata.metadata_hash };
}

async function deletePhotoById(db, photoId) {
  await db.removePhotoTagRelationships(photoId);
  await db.removePhotoFolderRelationships(photoId);
  await db.deletePhoto(photoId);
}

async function listPhotoDirs(libraryPath) {
  const imagesDir = path.join(libraryPath, 'images');
  const entries = await fs.readdir(imagesDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && entry.name.endsWith('.info'));
}

function photoIdFromInfoDirName(dirName) {
  return dirName.replace(/\.info$/, '');
}

async function reconcileLibrary(db, libraryPath) {
  const startTime = Date.now();
  const mtimeData = await loadMtimeData(libraryPath);
  const photoDirs = await listPhotoDirs(libraryPath);
  const diskIds = new Set(photoDirs.map((entry) => photoIdFromInfoDirName(entry.name)));

  const existingPhotos = await db.getPhotos();
  const existingIds = new Set(existingPhotos.map((p) => p.id));
  const photoIdToHash = new Map(
    existingPhotos.filter((p) => p.metadata_hash).map((p) => [p.id, p.metadata_hash])
  );

  let upserted = 0;
  let deleted = 0;
  let unchanged = 0;
  let errors = 0;

  for (const entry of photoDirs) {
    const photoId = photoIdFromInfoDirName(entry.name);
    const metadataPath = path.join(libraryPath, 'images', entry.name, 'metadata.json');

    try {
      const raw = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(raw);
      const currentHash = hashMetadata(metadata);
      const storedHash = photoIdToHash.get(photoId);
      const isNew = !existingIds.has(photoId);
      const isChanged = storedHash !== currentHash;

      if (isNew || isChanged) {
        await upsertPhotoFromMetadata(db, photoId, metadataPath, { mtimeData });
        upserted++;
      } else {
        unchanged++;
      }
    } catch (error) {
      console.warn(`⚠️  Reconcile failed for ${photoId}:`, error.message);
      errors++;
    }
  }

  const deletedIds = [...existingIds].filter((id) => !diskIds.has(id));
  if (deletedIds.length > 0) {
    await db.removePhotoTagRelationshipsBatch(deletedIds);
    await db.removePhotoFolderRelationshipsBatch(deletedIds);
    await db.removePhotosBatch(deletedIds);
    deleted = deletedIds.length;
  }

  await db.updateCacheInfo('last_refresh', new Date().toISOString());
  const totalPhotos = await db.getPhotoCount();
  await db.updateCacheInfo('total_photos', totalPhotos.toString());

  const elapsed = Date.now() - startTime;
  console.log(
    `✅ Library reconcile complete in ${elapsed}ms — upserted: ${upserted}, deleted: ${deleted}, unchanged: ${unchanged}, errors: ${errors}`
  );

  return { upserted, deleted, unchanged, errors, elapsed, totalPhotos };
}

module.exports = {
  determineTypeFromExt,
  hashMetadata,
  normalizeMetadataForDb,
  upsertPhotoFromMetadata,
  deletePhotoById,
  reconcileLibrary,
  listPhotoDirs,
  photoIdFromInfoDirName,
  loadMtimeData,
};
