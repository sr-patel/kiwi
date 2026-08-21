export type FileCategory = 'image' | 'video' | 'audio' | 'ebook' | 'document' | 'other';

export interface FileTypeInfo {
  category: FileCategory;
  icon: string;
  displayName: string;
  canPreview: boolean;
}

const fileTypeMap: { [key: string]: FileTypeInfo } = {
  // Images
  jpg: { category: 'image', icon: '🖼️', displayName: 'JPEG Image', canPreview: true },
  jpeg: { category: 'image', icon: '🖼️', displayName: 'JPEG Image', canPreview: true },
  png: { category: 'image', icon: '🖼️', displayName: 'PNG Image', canPreview: true },
  gif: { category: 'image', icon: '🖼️', displayName: 'GIF Image', canPreview: true },
  webp: { category: 'image', icon: '🖼️', displayName: 'WebP Image', canPreview: true },
  bmp: { category: 'image', icon: '🖼️', displayName: 'BMP Image', canPreview: true },
  tiff: { category: 'image', icon: '🖼️', displayName: 'TIFF Image', canPreview: true },
  svg: { category: 'image', icon: '🖼️', displayName: 'SVG Image', canPreview: true },
  jxl: { category: 'image', icon: '🖼️', displayName: 'JPEG XL Image', canPreview: true },
  heic: { category: 'image', icon: '🖼️', displayName: 'HEIC Image', canPreview: true },
  heif: { category: 'image', icon: '🖼️', displayName: 'HEIF Image', canPreview: true },
  // Videos
  mp4: { category: 'video', icon: '🎥', displayName: 'MP4 Video', canPreview: true },
  avi: { category: 'video', icon: '🎥', displayName: 'AVI Video', canPreview: true },
  mov: { category: 'video', icon: '🎥', displayName: 'MOV Video', canPreview: true },
  mkv: { category: 'video', icon: '🎥', displayName: 'MKV Video', canPreview: true },
  wmv: { category: 'video', icon: '🎥', displayName: 'WMV Video', canPreview: true },
  flv: { category: 'video', icon: '🎥', displayName: 'FLV Video', canPreview: true },
  webm: { category: 'video', icon: '🎥', displayName: 'WebM Video', canPreview: true },

  // Audio
  mp3: { category: 'audio', icon: '🎵', displayName: 'MP3 Audio', canPreview: true },
  wav: { category: 'audio', icon: '🎵', displayName: 'WAV Audio', canPreview: true },
  flac: { category: 'audio', icon: '🎵', displayName: 'FLAC Audio', canPreview: true },
  aac: { category: 'audio', icon: '🎵', displayName: 'AAC Audio', canPreview: true },
  ogg: { category: 'audio', icon: '🎵', displayName: 'OGG Audio', canPreview: true },
  opus: { category: 'audio', icon: '🎵', displayName: 'Opus Audio', canPreview: true },
  m4a: { category: 'audio', icon: '🎵', displayName: 'M4A Audio', canPreview: true },
  wma: { category: 'audio', icon: '🎵', displayName: 'WMA Audio', canPreview: true },

  // Ebooks
  pdf: { category: 'ebook', icon: '📖', displayName: 'PDF Document', canPreview: true },
  epub: { category: 'ebook', icon: '📖', displayName: 'EPUB Book', canPreview: true },
  mobi: { category: 'ebook', icon: '📖', displayName: 'MOBI Book', canPreview: true },
  azw3: { category: 'ebook', icon: '📖', displayName: 'Kindle Book', canPreview: true },
  cbz: { category: 'ebook', icon: '📖', displayName: 'Comic Book', canPreview: true },
  cbr: { category: 'ebook', icon: '📖', displayName: 'Comic Book', canPreview: true },

  // Documents
  doc: { category: 'document', icon: '📄', displayName: 'Word Document', canPreview: false },
  docx: { category: 'document', icon: '📄', displayName: 'Word Document', canPreview: false },
  xls: { category: 'document', icon: '📊', displayName: 'Excel Spreadsheet', canPreview: false },
  xlsx: { category: 'document', icon: '📊', displayName: 'Excel Spreadsheet', canPreview: false },
  ppt: { category: 'document', icon: '📋', displayName: 'PowerPoint Presentation', canPreview: false },
  pptx: { category: 'document', icon: '📋', displayName: 'PowerPoint Presentation', canPreview: false },
  txt: { category: 'document', icon: '📝', displayName: 'Text Document', canPreview: true },
  rtf: { category: 'document', icon: '📝', displayName: 'Rich Text Document', canPreview: false },
};

export function getFileTypeInfo(ext: string): FileTypeInfo {
  const lowerExt = ext.toLowerCase();
  return (
    fileTypeMap[lowerExt] || {
      category: 'other',
      icon: '📁',
      displayName: `${ext.toUpperCase()} File`,
      canPreview: false,
    }
  );
}

export function isImageFile(ext: string): boolean {
  return getFileTypeInfo(ext).category === 'image';
}

export function isVideoFile(ext: string): boolean {
  return getFileTypeInfo(ext).category === 'video';
}

export function isAudioFile(ext: string): boolean {
  return getFileTypeInfo(ext).category === 'audio';
}

export function isEbookFile(ext: string): boolean {
  return getFileTypeInfo(ext).category === 'ebook';
}

export function isDocumentFile(ext: string): boolean {
  return getFileTypeInfo(ext).category === 'document';
}

export function shouldUseFileCard(ext: string): boolean {
  const category = getFileTypeInfo(ext).category;
  return category === 'audio' || category === 'ebook' || category === 'document';
}
