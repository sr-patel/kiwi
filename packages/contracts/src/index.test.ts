import { describe, expect, it } from 'vitest';
import {
  KiwiConfigSchema,
  KiwiConfigUpdateSchema,
  PaginationQuerySchema,
  PhotoSchema,
  PhotosPageSchema,
  SearchQuerySchema,
  TagNetworkQuerySchema,
  toValidationIssues,
} from './index.js';

describe('shared runtime contracts', () => {
  it('applies defaults and preserves legacy keys', () => {
    const config = KiwiConfigSchema.parse({ legacySetting: 'kept' });
    expect(config.libraryPath).toBe('');
    expect(config.requestPageSize).toBe(50);
    expect(config.legacySetting).toBe('kept');
    expect(() => KiwiConfigSchema.parse({ requestPageSize: 2 })).toThrow();
    expect(KiwiConfigUpdateSchema.parse({ defaultTheme: 'light' })).toEqual({ defaultTheme: 'light' });
  });

  it('clamps pagination and graph complexity', () => {
    expect(PaginationQuerySchema.parse({ limit: '9999', offset: '-3' })).toMatchObject({
      limit: 500,
      offset: 0,
    });
    expect(
      TagNetworkQuerySchema.parse({
        maxNodes: 5000,
        megaTagPct: -2,
        minScore: 9,
        maxDegree: 0,
      }),
    ).toMatchObject({ maxNodes: 800, megaTagPct: 0, minScore: 1, maxDegree: 1 });
  });

  it('normalizes photos and additive page fields', () => {
    const photo = PhotoSchema.parse({
      id: 'a',
      name: 'one.jpg',
      ext: 'jpg',
      size: 1,
      mtime: '123',
      btime: 'bad',
      width: 4,
      height: 3,
    });
    expect(photo.mtime).toBe(123);
    expect(photo.btime).toBe(0);
    expect(PhotosPageSchema.parse({ photos: [photo], total: 1 })).toMatchObject({
      totalSize: 0,
      hasMore: false,
    });
  });

  it('reports malformed search fields', () => {
    const result = SearchQuerySchema.safeParse({ q: 'x'.repeat(501) });
    expect(result.success).toBe(false);
    if (!result.success) expect(toValidationIssues(result.error)[0]).toMatchObject({ path: 'q' });
  });
});
