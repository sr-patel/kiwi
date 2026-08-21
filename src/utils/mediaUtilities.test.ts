import { describe, expect, it } from 'vitest';
import { formatBytes } from './formatBytes';
import {
  getFileTypeInfo,
  isAudioFile,
  isDocumentFile,
  isEbookFile,
  isImageFile,
  isVideoFile,
  shouldUseFileCard,
} from './fileTypes';
import { needsServerPreview } from './imageFormats';
import { generateTagUrl, getTagBreadcrumb, parseTagFromUrl } from './tagUrls';

describe('media utilities', () => {
  it('classifies supported and unknown media', () => {
    expect(isImageFile('JPG')).toBe(true);
    expect(isVideoFile('mp4')).toBe(true);
    expect(isAudioFile('flac')).toBe(true);
    expect(isEbookFile('epub')).toBe(true);
    expect(isDocumentFile('docx')).toBe(true);
    expect(shouldUseFileCard('mp3')).toBe(true);
    expect(getFileTypeInfo('xyz')).toMatchObject({ category: 'other', canPreview: false });
  });

  it('selects server-only preview formats', () => {
    expect(needsServerPreview('.HEIC')).toBe(true);
    expect(needsServerPreview('jpg')).toBe(false);
  });

  it('formats sizes and tag URLs', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(parseTagFromUrl('red%20bird')).toBe('red bird');
    expect(parseTagFromUrl('')).toBeNull();
    expect(generateTagUrl('red bird')).toBe('/tag/red%20bird');
    expect(getTagBreadcrumb('red bird')).toEqual({ name: 'Tag: red bird', url: '/tag/red%20bird' });
  });
});
