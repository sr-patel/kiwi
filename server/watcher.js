const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const {
  upsertPhotoFromMetadata,
  deletePhotoById,
  photoIdFromInfoDirName,
  loadMtimeData,
  reconcileLibrary,
  isPhotoMtimeKey,
  photoInfoDirExists,
} = require('./librarySync');

const DEBOUNCE_MS = 200;
const RECONCILE_DEBOUNCE_MS = 1000;
const METADATA_RETRY_MS = 100;
const METADATA_RETRY_ATTEMPTS = 30;
const MAX_ACTIVITY_LOG = 200;

let watcher = null;
let activeDb = null;
let mtimeData = {};
let mtimeSnapshot = {};
const pendingPaths = new Map();
const pendingDeletes = new Set();
const activityLog = [];
let activityCounter = 0;
let debounceTimer = null;
let reconcileTimer = null;
let isProcessing = false;

const status = {
  running: false,
  libraryPath: null,
  lastEvent: null,
  lastEventTime: null,
  lastError: null,
  pendingCount: 0,
  processedCount: 0,
  lastReconcileTime: null,
};

function appendActivity(entry) {
  const record = {
    id: ++activityCounter,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  activityLog.unshift(record);
  if (activityLog.length > MAX_ACTIVITY_LOG) {
    activityLog.length = MAX_ACTIVITY_LOG;
  }

  const time = new Date(record.timestamp).toLocaleTimeString();
  console.log(`👁️  [watcher ${time}] ${record.type}: ${record.message}`);
  return record;
}

function logReconcileResult(result) {
  const upserted = result.upsertedPhotos || [];
  const deleted = result.deletedPhotos || [];

  for (const photo of upserted) {
    appendActivity({
      type: photo.isNew ? 'photo_added' : 'photo_updated',
      message: photo.isNew ? `Added "${photo.name}"` : `Updated "${photo.name}"`,
      photoId: photo.id,
      photoName: photo.name,
    });
  }
  for (const photo of deleted) {
    appendActivity({
      type: 'photo_removed',
      message: `Removed "${photo.name}"`,
      photoId: photo.id,
      photoName: photo.name,
    });
  }
  if ((result.upserted || 0) === 0 && (result.deleted || 0) === 0) {
    return;
  }
  appendActivity({
    type: 'reconcile',
    message: `Reconcile complete — ${result.upserted} upserted, ${result.deleted} removed`,
    details: { upserted: result.upserted, deleted: result.deleted, unchanged: result.unchanged },
  });
}

function queuePhotoDelete(photoId) {
  if (!photoId) return;
  pendingDeletes.add(photoId);
  status.pendingCount = pendingPaths.size + pendingDeletes.size;
  scheduleProcess();
}

async function removePhotoFromDb(photoId) {
  const existing = await activeDb.getPhotoById(photoId);
  if (!existing) return false;

  await deletePhotoById(activeDb, photoId);
  appendActivity({
    type: 'photo_removed',
    message: `Removed "${existing.name}"`,
    photoId,
    photoName: existing.name,
  });
  return true;
}

async function syncMtimeChanges(libraryPath) {
  let newMtime;
  try {
    const mtimePath = path.join(libraryPath, 'mtime.json');
    const raw = await fs.readFile(mtimePath, 'utf8');
    newMtime = JSON.parse(raw);
    if (!newMtime || typeof newMtime !== 'object' || Array.isArray(newMtime)) {
      throw new Error('mtime.json is not an object');
    }
  } catch (error) {
    appendActivity({
      type: 'error',
      message: `mtime.json read failed — skipping sync: ${error.message}`,
    });
    return;
  }

  const prevIds = Object.keys(mtimeSnapshot).filter(isPhotoMtimeKey);
  const newIdSet = new Set(Object.keys(newMtime).filter(isPhotoMtimeKey));
  const newPhotoIds = [...newIdSet].filter((photoId) => !prevIds.includes(photoId));
  const removedPhotoIds = prevIds.filter((photoId) => !newIdSet.has(photoId));

  // A failed/partial mtime write can look like every photo was removed — bail out.
  if (
    removedPhotoIds.length > 0 &&
    prevIds.length > 2 &&
    removedPhotoIds.length >= prevIds.length * 0.5
  ) {
    appendActivity({
      type: 'error',
      message: `mtime.json dropped ${removedPhotoIds.length}/${prevIds.length} ids — running reconcile instead of bulk delete`,
    });
    scheduleReconcile();
    return;
  }

  mtimeData = newMtime;
  mtimeSnapshot = { ...newMtime };

  if (removedPhotoIds.length > 0) {
    const confirmedRemoved = [];
    for (const photoId of removedPhotoIds) {
      if (!(await photoInfoDirExists(libraryPath, photoId))) {
        confirmedRemoved.push(photoId);
      }
    }

    if (confirmedRemoved.length > 0) {
      appendActivity({
        type: 'library_updated',
        message: `mtime.json — ${confirmedRemoved.length} photo(s) removed`,
        details: { photoIds: confirmedRemoved },
      });
      for (const photoId of confirmedRemoved) {
        await removePhotoFromDb(photoId);
      }
    }
  }

  if (newPhotoIds.length === 0) return;

  appendActivity({
    type: 'library_updated',
    message: `mtime.json — ${newPhotoIds.length} new photo(s) detected`,
    details: { photoIds: newPhotoIds },
  });

  for (const photoId of newPhotoIds) {
    const metadataPath = path.join(libraryPath, 'images', `${photoId}.info`, 'metadata.json');
    try {
      await fs.access(metadataPath);
      queuePath(metadataPath, 'upsert');
    } catch {
      // Photo dir may not exist yet; addDir handler will pick it up
    }
  }
}

function getWatcherStatus() {
  return {
    ...status,
    pendingCount: pendingPaths.size + pendingDeletes.size,
    activityLog: [...activityLog],
  };
}

function extractPhotoIdFromMetadataPath(filePath) {
  const dirName = path.basename(path.dirname(filePath));
  if (!dirName.endsWith('.info')) return null;
  return photoIdFromInfoDirName(dirName);
}

function queuePath(filePath, action) {
  pendingPaths.set(filePath, action);
  status.pendingCount = pendingPaths.size + pendingDeletes.size;
  scheduleProcess();
}

function scheduleReconcile() {
  if (reconcileTimer) clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(async () => {
    reconcileTimer = null;
    if (!activeDb || !status.libraryPath) return;

    try {
      mtimeData = await loadMtimeData(status.libraryPath);
      const result = await reconcileLibrary(activeDb, status.libraryPath);
      setLastReconcileTime(new Date().toISOString());
      status.lastEvent = 'reconcile';
      status.lastEventTime = new Date().toISOString();
      status.lastError = null;
      logReconcileResult(result);
    } catch (error) {
      status.lastError = error.message;
      appendActivity({ type: 'error', message: `Reconcile failed: ${error.message}` });
      console.error('❌ Watcher reconcile failed:', error.message);
    }
  }, RECONCILE_DEBOUNCE_MS);
}

async function queueNewInfoDir(dirPath) {
  const metadataPath = path.join(dirPath, 'metadata.json');

  for (let attempt = 0; attempt < METADATA_RETRY_ATTEMPTS; attempt++) {
    try {
      await fs.access(metadataPath);
      queuePath(metadataPath, 'upsert');
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, METADATA_RETRY_MS));
    }
  }

  console.log(`📁 New photo folder detected, scheduling reconcile: ${path.basename(dirPath)}`);
  scheduleReconcile();
}

function scheduleProcess() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    processQueue().catch((error) => {
      status.lastError = error.message;
      console.error('❌ Watcher queue processing failed:', error.message);
    });
  }, DEBOUNCE_MS);
}

async function processQueue() {
  if (isProcessing || !activeDb) return;
  if (pendingPaths.size === 0 && pendingDeletes.size === 0) return;

  isProcessing = true;
  const batch = new Map(pendingPaths);
  const deleteBatch = new Set(pendingDeletes);
  pendingPaths.clear();
  pendingDeletes.clear();
  status.pendingCount = 0;

  try {
    for (const photoId of deleteBatch) {
      try {
        if (await removePhotoFromDb(photoId)) {
          status.processedCount++;
          status.lastEvent = `delete:${photoId}`;
          status.lastEventTime = new Date().toISOString();
          status.lastError = null;
        }
      } catch (error) {
        status.lastError = error.message;
        appendActivity({ type: 'error', message: error.message, details: { photoId } });
        console.warn(`⚠️  Watcher failed to delete ${photoId}:`, error.message);
      }
    }

    for (const [filePath, action] of batch) {
      try {
        if (action === 'delete') {
          const photoId = extractPhotoIdFromMetadataPath(filePath);
          if (photoId) {
            await removePhotoFromDb(photoId);
          }
        } else {
          const photoId = extractPhotoIdFromMetadataPath(filePath);
          if (photoId) {
            const wasNew = !(await activeDb.getPhotoById(photoId));
            const result = await upsertPhotoFromMetadata(activeDb, photoId, filePath, { mtimeData });
            if (result.deleted) {
              if (result.hadPhoto) {
                appendActivity({
                  type: 'photo_removed',
                  message: `Removed "${result.name}"`,
                  photoId,
                  photoName: result.name,
                });
              }
            } else {
              appendActivity({
                type: wasNew ? 'photo_added' : 'photo_updated',
                message: wasNew ? `Added "${result.name}"` : `Synced "${result.name}"`,
                photoId,
                photoName: result.name,
              });
            }
          }
        }
        status.processedCount++;
        status.lastEvent = `${action}:${path.basename(path.dirname(filePath))}`;
        status.lastEventTime = new Date().toISOString();
        status.lastError = null;
      } catch (error) {
        status.lastError = error.message;
        appendActivity({
          type: 'error',
          message: error.message,
          details: { filePath },
        });
        console.warn(`⚠️  Watcher failed for ${filePath}:`, error.message);
      }
    }

    await activeDb.updateCacheInfo('last_refresh', new Date().toISOString());
  } finally {
    isProcessing = false;
    if (pendingPaths.size > 0) scheduleProcess();
  }
}

async function startWatcher(libraryPath, db) {
  await stopWatcher();

  if (!libraryPath || !db) {
    throw new Error('libraryPath and db are required to start watcher');
  }

  activeDb = db;
  mtimeData = await loadMtimeData(libraryPath);
  mtimeSnapshot = { ...mtimeData };
  status.libraryPath = libraryPath;
  status.running = true;
  status.lastError = null;

  appendActivity({
    type: 'watcher_started',
    message: `Watching ${libraryPath}`,
  });

  const imagesGlob = path.join(libraryPath, 'images', '**', 'metadata.json').replace(/\\/g, '/');
  const libraryMetadata = path.join(libraryPath, 'metadata.json');
  const libraryTags = path.join(libraryPath, 'tags.json');
  const libraryMtime = path.join(libraryPath, 'mtime.json');

  watcher = chokidar.watch([imagesGlob, libraryMetadata, libraryTags, libraryMtime], {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
    persistent: true,
  });

  watcher.on('add', (filePath) => handleWatchEvent(filePath, 'upsert', libraryPath, libraryMetadata, libraryTags, libraryMtime));
  watcher.on('change', (filePath) => handleWatchEvent(filePath, 'upsert', libraryPath, libraryMetadata, libraryTags, libraryMtime));

  watcher.on('addDir', (dirPath) => {
    if (dirPath.endsWith('.info')) {
      appendActivity({
        type: 'folder_detected',
        message: `Detected new folder "${path.basename(dirPath)}"`,
        photoId: photoIdFromInfoDirName(path.basename(dirPath)),
      });
      queueNewInfoDir(dirPath).catch((error) => {
        status.lastError = error.message;
        console.warn(`⚠️  Watcher failed to queue new info dir ${dirPath}:`, error.message);
      });
    }
  });

  watcher.on('unlink', (filePath) => {
    if (path.basename(filePath) === 'metadata.json' && filePath.includes('.info')) {
      const photoId = extractPhotoIdFromMetadataPath(filePath);
      queuePhotoDelete(photoId);
    }
  });

  watcher.on('unlinkDir', (dirPath) => {
    if (dirPath.endsWith('.info')) {
      queuePhotoDelete(photoIdFromInfoDirName(path.basename(dirPath)));
    }
  });

  watcher.on('error', (error) => {
    status.lastError = error.message;
    appendActivity({ type: 'error', message: error.message });
    console.error('❌ Watcher error:', error.message);
  });

  console.log(`👁️  File watcher started on ${libraryPath}/images`);
  return watcher;
}

function handleWatchEvent(filePath, action, libraryPath, libraryMetadata, libraryTags, libraryMtime) {
  if (path.basename(filePath) === 'metadata.json' && filePath.includes('.info')) {
    queuePath(filePath, action);
    return;
  }

  if (filePath === libraryMetadata || filePath === libraryTags) {
    const label = filePath === libraryMetadata ? 'Library folders' : 'Tags';
    appendActivity({
      type: 'library_updated',
      message: `${label} updated (${path.basename(filePath)})`,
    });
    return;
  }

  if (filePath === libraryMtime) {
    syncMtimeChanges(libraryPath).catch((error) => {
      status.lastError = error.message;
      appendActivity({ type: 'error', message: `mtime sync failed: ${error.message}` });
    });
  }
}

async function stopWatcher() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (reconcileTimer) {
    clearTimeout(reconcileTimer);
    reconcileTimer = null;
  }

  if (watcher) {
    await watcher.close();
    watcher = null;
  }

  pendingPaths.clear();
  pendingDeletes.clear();
  activeDb = null;
  status.running = false;
  status.pendingCount = 0;

  appendActivity({ type: 'watcher_stopped', message: 'File watcher stopped' });
}

function setLastReconcileTime(isoString) {
  status.lastReconcileTime = isoString;
}

module.exports = {
  startWatcher,
  stopWatcher,
  getWatcherStatus,
  setLastReconcileTime,
};
