const fs = require('fs');
const path = require('path');

/**
 * Load configuration from config.json file (server-side version)
 * @returns {Object} Configuration object
 */
function loadConfig() {
  // Look for config.json in the project root (one level up from server/)
  const configPath = path.join(__dirname, '..', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ config.json not found in project root');
    console.error('   Please create config.json with your library path');
    process.exit(1);
  }
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    if (!config.libraryPath) {
      console.error('❌ libraryPath not found in config.json');
      process.exit(1);
    }
    
    console.log('📁 Using library path from config:', config.libraryPath);
    return config;
  } catch (error) {
    console.error('❌ Error reading config.json:', error.message);
    process.exit(1);
  }
}

/**
 * Get the database path from the library path in config
 * @returns {string} Path to photo-library.db
 */
function getDatabasePath() {
  const config = loadConfig();
  const dbPath = path.join(config.libraryPath, 'photo-library.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at:', dbPath);
    console.error('   Please check your libraryPath in config.json');
    process.exit(1);
  }
  
  return dbPath;
}

/**
 * Get the library path from config
 * @returns {string} Library path
 */
function getLibraryPath() {
  const config = loadConfig();
  return config.libraryPath;
}

/**
 * Get the metadata cache path from the library path in config
 * @returns {string} Path to server-metadata-cache.json
 */
function getMetadataCachePath() {
  const config = loadConfig();
  return path.join(config.libraryPath, 'server-metadata-cache.json');
}

module.exports = {
  loadConfig,
  getDatabasePath,
  getLibraryPath,
  getMetadataCachePath
};

