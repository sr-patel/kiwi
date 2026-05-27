const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Cached config - read once, updated via API
let cachedConfig = null;

/**
 * Writable Kiwi data root (config + database).
 * Docker: /app/data  →  host ./data
 * Local dev: project/data
 */
function getDataRoot() {
  if (process.env.KIWI_DATA_DIR) return process.env.KIWI_DATA_DIR;
  if (fs.existsSync('/app/data') && path.basename(__dirname) !== 'server') {
    return '/app/data';
  }
  return path.join(__dirname, '..', 'data');
}

/** SQLite and cache files live under data/databases/ */
function getDatabaseDir() {
  return path.join(getDataRoot(), 'databases');
}

function ensureDataDirs() {
  fs.mkdirSync(getDatabaseDir(), { recursive: true });
}

/**
 * Resolve config.json for reading (unified data dir first, then legacy paths).
 */
function getConfigReadPath() {
  if (process.env.CONFIG_PATH) return process.env.CONFIG_PATH;

  const candidates = [
    path.join(getDataRoot(), 'config.json'),
    path.join(__dirname, '..', 'config.json'),
    path.join(__dirname, 'config.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.join(getDataRoot(), 'config.json');
}

/** Config is always written into the unified data directory. */
function getConfigWritePath() {
  if (process.env.CONFIG_PATH) return process.env.CONFIG_PATH;
  return path.join(getDataRoot(), 'config.json');
}

function librarySlug(libraryPath) {
  const base = path.basename(libraryPath, '.library') || 'library';
  const hash = crypto.createHash('sha256').update(path.resolve(libraryPath)).digest('hex').slice(0, 8);
  return `${base}-${hash}`;
}

function isDirectoryWritable(dir) {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_CONFIG = {
  libraryPath: '',
  browseRoots: [],
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

  const configPath = getConfigReadPath();

  if (!fs.existsSync(configPath)) {
    console.warn('⚠️  config.json not found – running in setup mode');
    cachedConfig = { ...DEFAULT_CONFIG };
    return cachedConfig;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
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

  ensureDataDirs();
  fs.writeFileSync(getConfigWritePath(), JSON.stringify(merged, null, 2), 'utf8');
  cachedConfig = merged;
  return merged;
}

/**
 * Validate that a given library path points to a valid Eagle-style library.
 * @param {string} libraryPath
 * @returns {{ valid: boolean, reason?: string, hint?: string }}
 */
function validateLibraryPath(libraryPath) {
  if (!libraryPath || typeof libraryPath !== 'string') {
    return {
      valid: false,
      reason: 'Please choose or enter a library folder.',
      hint: 'In Eagle, open Library → Manage library to see where your library folder is stored.',
    };
  }

  const trimmed = libraryPath.trim();
  if (!trimmed) {
    return {
      valid: false,
      reason: 'Please choose or enter a library folder.',
      hint: 'In Eagle, open Library → Manage library to see where your library folder is stored.',
    };
  }

  if (!fs.existsSync(trimmed)) {
    return {
      valid: false,
      reason: 'We could not find that folder.',
      hint: 'Check the path is correct, or use Browse to pick your .library folder. If you use Docker, select the folder inside the container (under /app/data/libraries).',
    };
  }

  const metadataPath = path.join(trimmed, 'metadata.json');
  const imagesDir = path.join(trimmed, 'images');

  if (!fs.existsSync(metadataPath)) {
    return {
      valid: false,
      reason: 'This folder does not look like an Eagle library.',
      hint: 'Pick the folder that ends in .library — the same one shown in Eagle under Library → Manage library.',
    };
  }

  if (!fs.existsSync(imagesDir)) {
    return {
      valid: false,
      reason: 'This library folder is missing its photos.',
      hint: 'Try opening the library in Eagle first. If the problem continues, your library folder may be incomplete.',
    };
  }

  return { valid: true };
}

/**
 * Default directory browse roots for the setup folder picker.
 */
function getBrowseRoots() {
  const config = loadConfig();
  if (Array.isArray(config.browseRoots) && config.browseRoots.length > 0) {
    return config.browseRoots.filter((p) => p && fs.existsSync(p));
  }

  const roots = [];
  const dockerLib = '/app/data/libraries';
  if (fs.existsSync(dockerLib)) {
    roots.push(dockerLib);
  }
  const home = os.homedir();
  if (home && fs.existsSync(home)) {
    roots.push(home);
  }
  return roots.length > 0 ? roots : [process.cwd()];
}

function resolveSafePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return null;
  const resolved = path.resolve(inputPath);
  const roots = getBrowseRoots().map((r) => path.resolve(r));

  for (const root of roots) {
    if (resolved === root || resolved.startsWith(root + path.sep)) {
      return resolved;
    }
  }
  return null;
}

/**
 * List subdirectories at a path (must be under browse roots).
 * @returns {{ path: string, name: string, isLibrary: boolean, libraryValid: boolean }[]}
 */
function browseDirectories(requestedPath) {
  const roots = getBrowseRoots();
  let targetPath;

  if (!requestedPath) {
    // Return virtual root listing of browse roots
    return {
      path: null,
      parent: null,
      entries: roots.map((root) => {
        const name = path.basename(root) || root;
        const validation = validateLibraryPath(root);
        return {
          name,
          path: root,
          isLibrary: root.endsWith('.library') || validation.valid,
          libraryValid: validation.valid,
        };
      }),
    };
  }

  targetPath = resolveSafePath(requestedPath);
  if (!targetPath) {
    return { error: 'Path is not accessible', path: requestedPath, parent: null, entries: [] };
  }

  let stat;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    return { error: 'Cannot read folder', path: targetPath, parent: null, entries: [] };
  }

  if (!stat.isDirectory()) {
    return { error: 'Not a folder', path: targetPath, parent: null, entries: [] };
  }

  const parent = path.dirname(targetPath);
  const parentResolved = resolveSafePath(parent);
  const parentPath = parentResolved && parentResolved !== targetPath ? parentResolved : null;

  let names;
  try {
    names = fs.readdirSync(targetPath, { withFileTypes: true });
  } catch {
    return { error: 'Cannot read folder contents', path: targetPath, parent: parentPath, entries: [] };
  }

  const entries = names
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => {
      const fullPath = path.join(targetPath, d.name);
      const validation = validateLibraryPath(fullPath);
      return {
        name: d.name,
        path: fullPath,
        isLibrary: d.name.endsWith('.library') || validation.valid,
        libraryValid: validation.valid,
      };
    })
    .sort((a, b) => {
      if (a.libraryValid !== b.libraryValid) return a.libraryValid ? -1 : 1;
      if (a.isLibrary !== b.isLibrary) return a.isLibrary ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return { path: targetPath, parent: parentPath, entries };
}

/**
 * Get the database path derived from the library path.
 * Uses a writable data directory when the library folder is read-only (Docker :ro mounts).
 */
function getDatabasePath() {
  const config = loadConfig();
  if (!config.libraryPath) return null;
  if (config.databasePath) return config.databasePath;

  const legacyPath = path.join(config.libraryPath, 'photo-library.db');
  if (isDirectoryWritable(config.libraryPath)) {
    return legacyPath;
  }

  return path.join(getDatabaseDir(), `${librarySlug(config.libraryPath)}.db`);
}

/**
 * Get the metadata cache path from the library path.
 * Mirrors getDatabasePath() — keeps caches out of read-only library mounts.
 */
function getMetadataCachePath() {
  const config = loadConfig();
  if (!config.libraryPath) return null;
  if (config.metadataCachePath) return config.metadataCachePath;

  const legacyPath = path.join(config.libraryPath, 'server-metadata-cache.json');
  if (isDirectoryWritable(config.libraryPath)) {
    return legacyPath;
  }

  return path.join(getDatabaseDir(), `${librarySlug(config.libraryPath)}-metadata.json`);
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
  getBrowseRoots,
  browseDirectories,
  resolveSafePath,
  getDatabasePath,
  getLibraryPath,
  getMetadataCachePath,
  reloadConfig,
  DEFAULT_CONFIG,
};
