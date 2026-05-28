/** Formats browsers cannot display natively; served via /api/photos/:id/preview. */
const SERVER_PREVIEW_EXTENSIONS = new Set(['jxl', 'heic', 'heif']);

export function needsServerPreview(ext: string): boolean {
  const normalized = ext.toLowerCase().replace(/^\./, '');
  return SERVER_PREVIEW_EXTENSIONS.has(normalized);
}
