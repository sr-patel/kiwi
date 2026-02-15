const fs = require('fs');
const path = require('path');

// Cached config - read once, updated via API
let cachedConfig = null;
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

const DEFAULT_CONFIG = {
  libraryPath: '',
  requestPageSize: 50,
  defaultTheme: 'dark',
  defaultAccentColor: 'kiwi',
  enableCache: true,
  cacheValidityHours: 24,
  enablePodcastMode: false,
  enableColorIntegration: true,
  useFolderThumbnails: true,
  autoplayGifsInGrid: false,
  hideControlsWithInfoBox: false,
  infoBoxSize: 100,
  sidebarWidth: 256,
  defaultSidebarOpen: false,
};

/**
 * Load configuration from config.json file.
 * Returns config object or null if not found / invalid.
 * Never calls process.exit - callers decide what to do.
 */
function loadConfig() {
  if (cachedConfig) return cachedConfig;

  if (!fs.existsSync(CONFIG_PATH)) {
    console.warn('⚠️  config.json not found – running in setup mode');
    cachedConfig = { ...DEFAULT_CONFIG };
    return cachedConfig;
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    return cachedConfig;
  } catch (error) {
    console.error('⚠️  Error reading config.json:', error.message);
    cachedConfig = { ...DEFAULT_CONFIG };
    return cachedConfig;
  }
}

/**
 * Check whether the server has a valid, usable library configured.
 * @returns {boolean}
 */
function isConfigured() {
  const config = loadConfig();
  return !!(config.libraryPath && fs.existsSync(config.libraryPath));
}

/**
 * Persist updated config to disk and refresh the in-memory cache.
 * @param {Object} updates - Partial config object to merge
 * @returns {Object} The full updated config
 */
function updateConfig(updates) {
  const current = loadConfig();
  const merged = { ...current, ...updates };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  cachedConfig = merged;
  return merged;
}

/**
 * Validate that a given library path points to a valid Eagle-style library.
 * @param {string} libraryPath
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateLibraryPath(libraryPath) {
  if (!libraryPath || typeof libraryPath !== 'string') {
    return { valid: false, reason: 'Library path is empty' };
  }

  if (!fs.existsSync(libraryPath)) {
    return { valid: false, reason: 'Path does not exist' };
  }

  // Check for expected Eagle library structure
  const metadataPath = path.join(libraryPath, 'metadata.json');
  const imagesDir = path.join(libraryPath, 'images');

  if (!fs.existsSync(metadataPath)) {
    return { valid: false, reason: 'No metadata.json found – not a valid Eagle library' };
  }

  if (!fs.existsSync(imagesDir)) {
    return { valid: false, reason: 'No images/ directory found – not a valid Eagle library' };
  }

  return { valid: true };
}

/**
 * Get the database path derived from the library path.
 * Returns the path string, or null if library is not configured.
 */
function getDatabasePath() {
  const config = loadConfig();
  if (!config.libraryPath) return null;
  return path.join(config.libraryPath, 'photo-library.db');
}

/**
 * Get the library path from config.
 * Returns the path string, or null if not configured.
 */
function getLibraryPath() {
  const config = loadConfig();
  return config.libraryPath || null;
}

/**
 * Get the metadata cache path from the library path.
 * Returns the path string, or null if library is not configured.
 */
function getMetadataCachePath() {
  const config = loadConfig();
  if (!config.libraryPath) return null;
  return path.join(config.libraryPath, 'server-metadata-cache.json');
}

/**
 * Force-reload config from disk (e.g. after external edits).
 */
function reloadConfig() {
  cachedConfig = null;
  return loadConfig();
}

module.exports = {
  loadConfig,
  isConfigured,
  updateConfig,
  validateLibraryPath,
  getDatabasePath,
  getLibraryPath,
  getMetadataCachePath,
  reloadConfig,
  DEFAULT_CONFIG,
};
