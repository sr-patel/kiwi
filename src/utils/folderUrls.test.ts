import { describe, expect, it } from 'vitest';
import {
  findFolderByPath,
  generateFolderUrl,
  getFolderBreadcrumbs,
  getFolderPath,
  parseFolderPathFromUrl,
} from './folderUrls';
import type { FolderNode } from '../types';

const folder = (id: string, name: string, children: FolderNode[] = []): FolderNode => ({
  id,
  name,
  description: '',
  children,
  photos: [],
  photoCount: 0,
  modificationTime: 0,
  tags: [],
  path: [],
});
const grandchild = folder('3', 'Grand child');
const child = folder('2', 'Child', [grandchild]);
const tree = [folder('1', 'Root', [child]), folder('4', 'Other')];

describe('folder URL utilities', () => {
  it('finds nested paths and missing folders', () => {
    expect(getFolderPath(grandchild, tree)).toEqual(['Root', 'Child', 'Grand child']);
    expect(getFolderPath(folder('missing', 'Missing'), tree)).toEqual([]);
    expect(getFolderPath(grandchild, [])).toEqual([]);
  });

  it('round trips encoded folder URLs', () => {
    expect(generateFolderUrl(grandchild, tree)).toBe('/folder/Root|Child|Grand%2520child');
    expect(parseFolderPathFromUrl('Root|Child|Grand%2520child', tree)).toBe('3');
    expect(parseFolderPathFromUrl('Root/Child/Grand%20child', tree)).toBe('3');
    expect(parseFolderPathFromUrl('missing', tree)).toBeNull();
  });

  it('finds folders and constructs breadcrumbs', () => {
    expect(findFolderByPath(tree, ['Root', 'Child'])?.id).toBe('2');
    expect(findFolderByPath(tree, ['Root', 'Nope'])).toBeNull();
    expect(getFolderBreadcrumbs(grandchild, tree)).toEqual([
      { id: '1', name: 'Root', url: '/folder/Root' },
      { id: '2', name: 'Child', url: '/folder/Root|Child' },
      { id: '3', name: 'Grand child', url: '/folder/Root|Child|Grand%2520child' },
    ]);
  });
});
