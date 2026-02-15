import test from 'node:test';
import assert from 'node:assert';
import { getFolderPath } from './folderUrls.ts';
import type { FolderNode } from '../types/index.ts';

// Helper to create a mock FolderNode
const createFolder = (id: string, name: string, children: FolderNode[] = []): FolderNode => {
  return {
    id,
    name,
    description: '',
    children,
    photos: [],
    photoCount: 0,
    modificationTime: Date.now(),
    tags: [],
    path: []
  };
};

test('getFolderPath - finding a folder at the root level', () => {
  const rootFolder = createFolder('1', 'Root');
  const tree = [rootFolder];

  const path = getFolderPath(rootFolder, tree);
  assert.deepStrictEqual(path, ['Root']);
});

test('getFolderPath - finding a deeply nested folder', () => {
  const grandchild = createFolder('3', 'Grandchild');
  const child = createFolder('2', 'Child', [grandchild]);
  const root = createFolder('1', 'Root', [child]);
  const tree = [root];

  const path = getFolderPath(grandchild, tree);
  assert.deepStrictEqual(path, ['Root', 'Child', 'Grandchild']);
});

test('getFolderPath - correctly traversing multiple branches', () => {
  const target = createFolder('4', 'Target');
  const other = createFolder('3', 'Other');
  const child1 = createFolder('2', 'Child1', [other]);
  const child2 = createFolder('5', 'Child2', [target]);
  const root = createFolder('1', 'Root', [child1, child2]);
  const tree = [root];

  const path = getFolderPath(target, tree);
  assert.deepStrictEqual(path, ['Root', 'Child2', 'Target']);
});

test('getFolderPath - folder not in the tree returns empty array', () => {
  const target = createFolder('99', 'NotFound');
  const root = createFolder('1', 'Root');
  const tree = [root];

  const path = getFolderPath(target, tree);
  assert.deepStrictEqual(path, []);
});

test('getFolderPath - empty folder tree returns empty array', () => {
  const target = createFolder('1', 'Root');
  const tree: FolderNode[] = [];

  const path = getFolderPath(target, tree);
  assert.deepStrictEqual(path, []);
});

test('getFolderPath - handling a tree with multiple root nodes', () => {
  const root1 = createFolder('1', 'Root1');
  const target = createFolder('2', 'Target');
  const tree = [root1, target];

  const path = getFolderPath(target, tree);
  assert.deepStrictEqual(path, ['Target']);
});

test('getFolderPath - complex tree with same names but different IDs', () => {
  const target = createFolder('target-id', 'SameName');
  const other = createFolder('other-id', 'SameName');

  const tree = [
    createFolder('r1', 'Root1', [other]),
    createFolder('r2', 'Root2', [target])
  ];

  const path = getFolderPath(target, tree);
  assert.deepStrictEqual(path, ['Root2', 'SameName']);

  const pathOther = getFolderPath(other, tree);
  assert.deepStrictEqual(pathOther, ['Root1', 'SameName']);
});
