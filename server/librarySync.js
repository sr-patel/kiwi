const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

function determineTypeFromExt(ext) {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'heic', 'heif', 'avif', 'svg', 'jxl'];
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

/** Fields Eagle rewrites often without meaningful content changes */
const HASH_IGNORE_FIELDS = ['lastModified', 'modificationTime', 'palettes'];

function metadataForHash(metadata, photoId, mtimeData = {}) {
  const copy = { ...metadata };
  if (!copy.id) copy.id = photoId;
  if (mtimeData[photoId] !== undefined) copy.mtime = mtimeData[photoId];
  for (const field of HASH_IGNORE_FIELDS) delete copy[field];
  return copy;
}

function computeMetadataHash(metadata, photoId, mtimeData = {}) {
  return hashMetadata(metadataForHash(metadata, photoId, mtimeData));
}

function normalizeMetadataForDb(metadata, photoId, mtimeData = {}) {
  if (!metadata.id) metadata.id = photoId;
  if (mtimeData[photoId] !== undefined) metadata.mtime = mtimeData[photoId];

  const metadataHash = computeMetadataHash(metadata, photoId, mtimeData);

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

const MTIME_RESERVED_KEYS = new Set(['all']);

function isPhotoMtimeKey(key) {
  return typeof key === 'string' && key.length > 0 && !MTIME_RESERVED_KEYS.has(key);
}

async function photoInfoDirExists(libraryPath, photoId) {
  try {
    await fs.access(path.join(libraryPath, 'images', `${photoId}.info`));
    return true;
  } catch {
    return false;
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

  if (metadata.isDeleted) {
    const hadPhoto = await db.getPhotoById(photoId);
    if (hadPhoto) {
      await deletePhotoById(db, photoId);
    }
    return {
      photoId,
      deleted: true,
      name: metadata.name || photoId,
      hadPhoto: Boolean(hadPhoto),
    };
  }

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

  return { photoId, deleted: false, metadataHash: cleanMetadata.metadata_hash, name: metadata.name };
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
  const upsertedPhotos = [];
  const deletedPhotos = [];

  for (const entry of photoDirs) {
    const photoId = photoIdFromInfoDirName(entry.name);
    const metadataPath = path.join(libraryPath, 'images', entry.name, 'metadata.json');

    try {
      const raw = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(raw);

      if (metadata.isDeleted) {
        if (existingIds.has(photoId)) {
          await deletePhotoById(db, photoId);
          deleted++;
          deletedPhotos.push({ id: photoId, name: metadata.name || photoId });
        }
        continue;
      }

      const currentHash = computeMetadataHash(metadata, photoId, mtimeData);
      const storedHash = photoIdToHash.get(photoId);
      const isNew = !existingIds.has(photoId);
      const isChanged = storedHash !== currentHash;

      if (isNew || isChanged) {
        await upsertPhotoFromMetadata(db, photoId, metadataPath, { mtimeData });
        upserted++;
        upsertedPhotos.push({
          id: photoId,
          name: metadata.name || photoId,
          isNew,
        });
      } else {
        unchanged++;
      }
    } catch (error) {
      console.warn(`⚠️  Reconcile failed for ${photoId}:`, error.message);
      errors++;
    }
  }

  const deletedIds = [...existingIds].filter((id) => !diskIds.has(id));
  const existingNameById = new Map(existingPhotos.map((p) => [p.id, p.name]));
  if (deletedIds.length > 0) {
    for (const id of deletedIds) {
      deletedPhotos.push({ id, name: existingNameById.get(id) || id });
    }
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

  return { upserted, deleted, unchanged, errors, elapsed, totalPhotos, upsertedPhotos, deletedPhotos };
}

module.exports = {
  determineTypeFromExt,
  hashMetadata,
  computeMetadataHash,
  normalizeMetadataForDb,
  upsertPhotoFromMetadata,
  deletePhotoById,
  reconcileLibrary,
  listPhotoDirs,
  photoIdFromInfoDirName,
  loadMtimeData,
  isPhotoMtimeKey,
  photoInfoDirExists,
};
