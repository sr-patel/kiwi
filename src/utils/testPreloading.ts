import { imagePreloadingService } from '@/services/imagePreloadingService';
import { libraryService } from '@/services/libraryService';

// Test function to verify preloading works
export async function testPreloading() {
  console.log('🧪 Testing preloading service...');
  
  // Create a test photo
  const testPhoto = {
    id: 'test-photo-123',
    name: 'test-image.jpg',
    ext: 'jpg',
    size: 1024000,
    width: 1920,
    height: 1080,
    mtime: Date.now(),
    date_time: new Date().toISOString(),
    type: 'image',
    tags: [],
    folders: [],
  };

  try {
    // Test URL generation
    const thumbnailUrl = libraryService.getPhotoThumbnailUrl(testPhoto.id, testPhoto.name);
    const fileUrl = libraryService.getPhotoFileUrl(testPhoto.id, testPhoto.ext, testPhoto.name);
    
    console.log('📸 Thumbnail URL:', thumbnailUrl);
    console.log('📁 File URL:', fileUrl);
    
    // Test preloading
    console.log('⏳ Starting preload test...');
    imagePreloadingService.addToQueue([testPhoto], 'high');
    
    // Wait a bit and check stats
    setTimeout(() => {
      const stats = imagePreloadingService.getStats();
      console.log('📊 Preloading stats:', stats);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Preloading test failed:', error);
  }
}

// Test the thumbnail endpoint directly
export async function testThumbnailEndpoint(photoId: string, photoName: string) {
  try {
    const thumbnailUrl = libraryService.getPhotoThumbnailUrl(photoId, photoName);
    console.log('🔗 Testing thumbnail endpoint:', thumbnailUrl);
    
    const response = await fetch(thumbnailUrl);
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      console.log('✅ Thumbnail endpoint working');
    } else {
      console.log('❌ Thumbnail endpoint failed:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Thumbnail endpoint test failed:', error);
  }
}