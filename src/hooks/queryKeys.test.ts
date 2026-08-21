import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('query keys', () => {
  it('sorts tag selections without mutating input', () => {
    const tags = ['zebra', 'apple'];
    expect(queryKeys.multiTagPhotos(tags, 'mtime', 'desc')).toEqual([
      'kiwi',
      'photos',
      'tags',
      ['apple', 'zebra'],
      'mtime',
      'desc',
      null,
    ]);
    expect(tags).toEqual(['zebra', 'apple']);
  });

  it('normalizes absent seeds and search whitespace', () => {
    expect(queryKeys.photoPage(null, 'random', 'asc')).toContain(null);
    expect(queryKeys.search('  bird  ', null, null, null, 'name', 'asc')).toContain('bird');
    expect(queryKeys.tagPhotos('bird', 'name', 'asc', 7)).toContain('bird');
    expect(queryKeys.folderCounts(true)).toEqual(['kiwi', 'folder-counts', true]);
    expect(queryKeys.tags()).toEqual(['kiwi', 'tags']);
    expect(queryKeys.dashboard()).toEqual(['kiwi', 'dashboard']);
    expect(queryKeys.sync()).toEqual(['kiwi', 'sync']);
  });
});
