const path = require('path');
const chokidar = require('chokidar');
const {
  upsertPhotoFromMetadata,
  deletePhotoById,
  photoIdFromInfoDirName,
  loadMtimeData,
} = require('./librarySync');

const DEBOUNCE_MS = 200;

let watcher = null;
let activeDb = null;
let mtimeData = {};
const pendingPaths = new Map();
let debounceTimer = null;
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

function getWatcherStatus() {
  return {
    ...status,
    pendingCount: pendingPaths.size,
  };
}

function extractPhotoIdFromMetadataPath(filePath) {
  const dirName = path.basename(path.dirname(filePath));
  if (!dirName.endsWith('.info')) return null;
  return photoIdFromInfoDirName(dirName);
}

function queuePath(filePath, action) {
  pendingPaths.set(filePath, action);
  status.pendingCount = pendingPaths.size;
  scheduleProcess();
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
  if (isProcessing || pendingPaths.size === 0 || !activeDb) return;

  isProcessing = true;
  const batch = new Map(pendingPaths);
  pendingPaths.clear();
  status.pendingCount = 0;

  try {
    for (const [filePath, action] of batch) {
      try {
        if (action === 'delete') {
          const photoId = extractPhotoIdFromMetadataPath(filePath);
          if (photoId) {
            await deletePhotoById(activeDb, photoId);
            console.log(`🗑️  Watcher removed photo ${photoId}`);
          }
        } else {
          const photoId = extractPhotoIdFromMetadataPath(filePath);
          if (photoId) {
            await upsertPhotoFromMetadata(activeDb, photoId, filePath, { mtimeData });
            console.log(`🔄 Watcher synced photo ${photoId}`);
          }
        }
        status.processedCount++;
        status.lastEvent = `${action}:${path.basename(path.dirname(filePath))}`;
        status.lastEventTime = new Date().toISOString();
        status.lastError = null;
      } catch (error) {
        status.lastError = error.message;
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
  status.libraryPath = libraryPath;
  status.running = true;
  status.lastError = null;

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

  watcher.on('unlink', (filePath) => {
    if (path.basename(filePath) === 'metadata.json' && filePath.includes('.info')) {
      queuePath(filePath, 'delete');
    }
  });

  watcher.on('unlinkDir', (dirPath) => {
    if (dirPath.endsWith('.info')) {
      queuePath(path.join(dirPath, 'metadata.json'), 'delete');
    }
  });

  watcher.on('error', (error) => {
    status.lastError = error.message;
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
    console.log(`📁 Library taxonomy changed: ${path.basename(filePath)}`);
    return;
  }

  if (filePath === libraryMtime) {
    loadMtimeData(libraryPath).then((data) => { mtimeData = data; });
  }
}

async function stopWatcher() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (watcher) {
    await watcher.close();
    watcher = null;
  }

  pendingPaths.clear();
  activeDb = null;
  status.running = false;
  status.pendingCount = 0;
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
