const fs = require('fs').promises;
const path = require('path');
const exifReader = require('exif-reader');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');

// Promisify ffprobe
const ffprobe = promisify(ffmpeg.ffprobe);

/**
 * Extract metadata from an image file using EXIF data and Sharp
 */
async function extractImageMetadata(filePath) {
  try {
    console.log(`    🖼️  Extracting image metadata from: ${path.basename(filePath)}`);
    
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath, ext);
    
    console.log(`    📄 File info: ${name}.${ext} (${(stats.size / 1024).toFixed(1)} KB)`);
    
    // Get basic file info
    const metadata = {
      name,
      ext: ext.substring(1), // Remove the dot
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      type: 'image',
      width: null,
      height: null,
      exif: null
    };

    // Try to get image dimensions and EXIF data using Sharp
    try {
      console.log(`    🔍 Analyzing image with Sharp...`);
      const image = sharp(filePath);
      const imageInfo = await image.metadata();
      
      metadata.width = imageInfo.width;
      metadata.height = imageInfo.height;
      
      console.log(`    📐 Dimensions: ${imageInfo.width}x${imageInfo.height}`);
      
      // Extract EXIF data if available
      if (imageInfo.exif) {
        try {
          console.log(`    📷 Extracting EXIF data...`);
          metadata.exif = exifReader(imageInfo.exif);
          
          // Extract common EXIF fields
          if (metadata.exif.exif) {
            metadata.dateTime = metadata.exif.exif.DateTimeOriginal || 
                               metadata.exif.exif.DateTime || 
                               metadata.exif.image?.DateTime;
            if (metadata.dateTime) {
              console.log(`    📅 Date/Time: ${metadata.dateTime}`);
            }
          }
          
          if (metadata.exif.gps) {
            metadata.gps = {
              latitude: metadata.exif.gps.GPSLatitude,
              longitude: metadata.exif.gps.GPSLongitude,
              altitude: metadata.exif.gps.GPSAltitude
            };
            console.log(`    🗺️  GPS data found`);
          }
          
          if (metadata.exif.image) {
            metadata.camera = metadata.exif.image.Make || metadata.exif.image.Model;
            if (metadata.camera) {
              console.log(`    📸 Camera: ${metadata.camera}`);
            }
          }
        } catch (exifError) {
          console.warn(`    ⚠️  Failed to parse EXIF data: ${exifError.message}`);
        }
      } else {
        console.log(`    ℹ️  No EXIF data found`);
      }
    } catch (sharpError) {
      console.warn(`    ⚠️  Failed to extract image metadata with Sharp: ${sharpError.message}`);
    }

    console.log(`    ✅ Image metadata extraction complete`);
    return metadata;
  } catch (error) {
    console.error(`    ❌ Error extracting image metadata: ${error.message}`);
    throw error;
  }
}

/**
 * Extract metadata from a video file using ffprobe
 */
async function extractVideoMetadata(filePath) {
  try {
    console.log(`    🎥 Extracting video metadata from: ${path.basename(filePath)}`);
    
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath, ext);
    
    console.log(`    📄 File info: ${name}.${ext} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    
    const metadata = {
      name,
      ext: ext.substring(1),
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      type: 'video',
      width: null,
      height: null,
      duration: null,
      fps: null,
      codec: null
    };

    try {
      console.log(`    🔍 Analyzing video with ffprobe...`);
      const probeData = await ffprobe(filePath);
      
      if (probeData.streams && probeData.streams.length > 0) {
        const videoStream = probeData.streams.find(stream => stream.codec_type === 'video');
        const audioStream = probeData.streams.find(stream => stream.codec_type === 'audio');
        
        if (videoStream) {
          metadata.width = videoStream.width;
          metadata.height = videoStream.height;
          metadata.codec = videoStream.codec_name;
          metadata.fps = videoStream.r_frame_rate;
          
          console.log(`    📐 Video: ${videoStream.width}x${videoStream.height}, ${videoStream.codec_name}, ${videoStream.r_frame_rate} fps`);
        }
        
        if (audioStream) {
          metadata.audioCodec = audioStream.codec_name;
          console.log(`    🔊 Audio: ${audioStream.codec_name}`);
        }
        
        if (probeData.format) {
          metadata.duration = parseFloat(probeData.format.duration);
          metadata.bitrate = parseInt(probeData.format.bit_rate);
          
          const minutes = Math.floor(metadata.duration / 60);
          const seconds = Math.floor(metadata.duration % 60);
          console.log(`    ⏱️  Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    } catch (ffprobeError) {
      console.warn(`    ⚠️  Failed to extract video metadata with ffprobe: ${ffprobeError.message}`);
      console.log(`    ℹ️  Continuing with basic file metadata`);
    }

    console.log(`    ✅ Video metadata extraction complete`);
    return metadata;
  } catch (error) {
    console.error(`    ❌ Error extracting video metadata: ${error.message}`);
    throw error;
  }
}

/**
 * Extract metadata from an audio file using ffprobe
 */
async function extractAudioMetadata(filePath) {
  try {
    console.log(`    🎵 Extracting audio metadata from: ${path.basename(filePath)}`);
    
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath, ext);
    
    console.log(`    📄 File info: ${name}.${ext} (${(stats.size / 1024).toFixed(1)} KB)`);
    
    const metadata = {
      name,
      ext: ext.substring(1),
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      type: 'audio',
      duration: null,
      bitrate: null,
      codec: null,
      sampleRate: null,
      channels: null
    };

    try {
      console.log(`    🔍 Analyzing audio with ffprobe...`);
      const probeData = await ffprobe(filePath);
      
      if (probeData.streams && probeData.streams.length > 0) {
        const audioStream = probeData.streams.find(stream => stream.codec_type === 'audio');
        
        if (audioStream) {
          metadata.codec = audioStream.codec_name;
          metadata.sampleRate = audioStream.sample_rate;
          metadata.channels = audioStream.channels;
          
          console.log(`    🔊 Audio: ${audioStream.codec_name}, ${audioStream.sample_rate}Hz, ${audioStream.channels} channels`);
        }
        
        if (probeData.format) {
          metadata.duration = parseFloat(probeData.format.duration);
          metadata.bitrate = parseInt(probeData.format.bit_rate);
          
          const minutes = Math.floor(metadata.duration / 60);
          const seconds = Math.floor(metadata.duration % 60);
          console.log(`    ⏱️  Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    } catch (ffprobeError) {
      console.warn(`    ⚠️  Failed to extract audio metadata with ffprobe: ${ffprobeError.message}`);
      console.log(`    ℹ️  Continuing with basic file metadata`);
    }

    console.log(`    ✅ Audio metadata extraction complete`);
    return metadata;
  } catch (error) {
    console.error(`    ❌ Error extracting audio metadata: ${error.message}`);
    throw error;
  }
}

/**
 * Extract metadata from a document file (basic info only)
 */
async function extractDocumentMetadata(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath, ext);
    
    const metadata = {
      name,
      ext: ext.substring(1),
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      type: 'document'
    };

    return metadata;
  } catch (error) {
    console.error(`Error extracting document metadata from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Main function to extract metadata from any media file
 */
async function extractMediaMetadata(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    console.log(`    🔍 Detected file type: ${ext}`);
    
    // Image formats
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.svg'];
    if (imageExtensions.includes(ext)) {
      return await extractImageMetadata(filePath);
    }
    
    // Video formats
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp'];
    if (videoExtensions.includes(ext)) {
      return await extractVideoMetadata(filePath);
    }
    
    // Audio formats
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.opus', '.wma', '.m4a'];
    if (audioExtensions.includes(ext)) {
      return await extractAudioMetadata(filePath);
    }
    
    // Document formats
    const documentExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.epub', '.mobi'];
    if (documentExtensions.includes(ext)) {
      return await extractDocumentMetadata(filePath);
    }
    
    // Default to document type for unknown extensions
    console.log(`    📄 Unknown extension, treating as document`);
    return await extractDocumentMetadata(filePath);
    
  } catch (error) {
    console.error(`    ❌ Error extracting media metadata: ${error.message}`);
    throw error;
  }
}

/**
 * Find the actual media file in a photo directory
 */
async function findMediaFile(photoDir) {
  try {
    console.log(`    🔍 Searching for media files in directory...`);
    const files = await fs.readdir(photoDir);
    
    // Look for media files (exclude metadata.json, thumbnails, etc.)
    const mediaFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      const isThumbnail = file.includes('_thumbnail');
      const isMetadata = file === 'metadata.json' || file === 'mtime.json' || file === 'tags.json';
      
      return !isThumbnail && !isMetadata && !file.startsWith('.');
    });
    
    console.log(`    📁 Found ${files.length} total files, ${mediaFiles.length} media files`);
    
    if (mediaFiles.length === 0) {
      throw new Error('No media files found in directory');
    }
    
    const selectedFile = mediaFiles[0];
    console.log(`    📄 Selected media file: ${selectedFile}`);
    
    // Return the first media file found
    return path.join(photoDir, selectedFile);
  } catch (error) {
    console.error(`    ❌ Error finding media file: ${error.message}`);
    throw error;
  }
}

/**
 * Generate basic fallback metadata when media file cannot be read
 */
async function generateBasicFallbackMetadata(photoId, photoDir) {
  try {
    console.log(`  🔧 Generating basic fallback metadata for ${photoId}`);
    
    // Try to find any file in the directory
    console.log(`    🔍 Searching for any files in directory...`);
    const files = await fs.readdir(photoDir);
    const mediaFiles = files.filter(file => {
      const isThumbnail = file.includes('_thumbnail');
      const isMetadata = file === 'metadata.json' || file === 'mtime.json' || file === 'tags.json';
      return !isThumbnail && !isMetadata && !file.startsWith('.');
    });
    
    console.log(`    📁 Found ${files.length} total files, ${mediaFiles.length} potential media files`);
    
    if (mediaFiles.length === 0) {
      throw new Error('No media files found in directory');
    }
    
    const fileName = mediaFiles[0];
    const ext = path.extname(fileName).toLowerCase();
    const name = path.basename(fileName, ext);
    
    console.log(`    📄 Using file: ${fileName}`);
    
    // Try to get basic file stats
    const filePath = path.join(photoDir, fileName);
    let stats;
    try {
      stats = await fs.stat(filePath);
      console.log(`    📊 File stats: ${(stats.size / 1024).toFixed(1)} KB, modified: ${stats.mtime.toISOString()}`);
    } catch (statError) {
      // If we can't read the file stats, create minimal metadata
      console.warn(`    ⚠️  Could not read file stats: ${statError.message}`);
      stats = { size: 0, mtime: new Date() };
    }
    
    const now = Date.now();
    
    console.log(`    📝 Creating basic metadata object...`);
    
    const basicMetadata = {
      id: photoId,
      name,
      size: stats.size || 0,
      btime: now,
      mtime: stats.mtime ? stats.mtime.getTime() : now,
      ext: ext.substring(1),
      tags: [],
      folders: [],
      isDeleted: false,
      url: "",
      annotation: "",
      modificationTime: now,
      height: null,
      width: null,
      lastModified: now,
      palettes: []
    };
    
    console.log(`    💾 Saving basic metadata to file...`);
    
    // Try to save the basic metadata for future use
    try {
      const metadataPath = path.join(photoDir, 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(basicMetadata));
      console.log(`    ✅ Successfully saved basic fallback metadata for ${photoId}`);
    } catch (saveError) {
      console.warn(`    ⚠️  Failed to save basic fallback metadata for ${photoId}: ${saveError.message}`);
    }
    
    return basicMetadata;
  } catch (error) {
    console.error(`    ❌ Error generating basic fallback metadata for ${photoId}: ${error.message}`);
    throw error;
  }
}


module.exports = {
  extractMediaMetadata,
  generateBasicFallbackMetadata,
  findMediaFile
};
 