/** Maps file extensions and DB type values to dashboard media-type groups. */

const EXTENSION_GROUPS = {
  // Images
  jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', webp: 'Image',
  bmp: 'Image', tiff: 'Image', tif: 'Image', avif: 'Image', svg: 'Image',
  heic: 'Image', heif: 'Image', jxl: 'Image', ico: 'Image', psd: 'Image',
  // Camera RAW
  raw: 'Image', cr2: 'Image', cr3: 'Image', nef: 'Image', arw: 'Image',
  dng: 'Image', orf: 'Image', rw2: 'Image', pef: 'Image', raf: 'Image',
  srw: 'Image', nrw: 'Image', sr2: 'Image', '3fr': 'Image', mrw: 'Image',
  // Video
  mp4: 'Video', avi: 'Video', mov: 'Video', mkv: 'Video', webm: 'Video',
  m4v: 'Video', flv: 'Video', wmv: 'Video', mpg: 'Video', mpeg: 'Video',
  '3gp': 'Video', ts: 'Video', m2ts: 'Video', vob: 'Video', ogv: 'Video',
  // Audio
  mp3: 'Audio', wav: 'Audio', flac: 'Audio', aac: 'Audio', ogg: 'Audio',
  opus: 'Audio', m4a: 'Audio', wma: 'Audio', aiff: 'Audio', alac: 'Audio',
  // Ebooks & comics
  pdf: 'Ebook', epub: 'Ebook', mobi: 'Ebook', azw: 'Ebook', azw3: 'Ebook',
  cbz: 'Ebook', cbr: 'Ebook', fb2: 'Ebook',
  // Office & text documents
  txt: 'Document', rtf: 'Document', doc: 'Document', docx: 'Document',
  xls: 'Document', xlsx: 'Document', ppt: 'Document', pptx: 'Document',
  odt: 'Document', ods: 'Document', odp: 'Document', md: 'Document',
};

const TYPE_TO_GROUP = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
};

function normalizeExt(ext) {
  return String(ext || '').toLowerCase().replace(/^\./, '').trim();
}

function getMediaGroup(ext, type) {
  const key = normalizeExt(ext);
  if (key && EXTENSION_GROUPS[key]) return EXTENSION_GROUPS[key];
  if (type && TYPE_TO_GROUP[type]) return TYPE_TO_GROUP[type];
  return 'Other';
}

module.exports = { EXTENSION_GROUPS, getMediaGroup, normalizeExt };
