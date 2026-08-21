import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const fixtureRoot = path.resolve(root, '.tmp', 'e2e');
const expectedParent = path.resolve(root, '.tmp');
if (path.dirname(fixtureRoot) !== expectedParent)
  throw new Error('Refusing to prepare fixtures outside .tmp');
await rm(fixtureRoot, { recursive: true, force: true });

const libraryPath = path.join(fixtureRoot, 'Acceptance.library');
const imagesPath = path.join(libraryPath, 'images');
await mkdir(imagesPath, { recursive: true });

const onePixelJpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=',
  'base64',
);
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zr9sAAAAASUVORK5CYII=',
  'base64',
);
const mtime = {};
for (let index = 1; index <= 75; index++) {
  const id = `bird-${index.toString().padStart(3, '0')}`;
  const name = `Bird ${index.toString().padStart(3, '0')}`;
  const infoPath = path.join(imagesPath, `${id}.info`);
  await mkdir(infoPath);
  await Promise.all([
    writeFile(path.join(infoPath, `${name}.jpg`), onePixelJpeg),
    writeFile(path.join(infoPath, `${name}_thumbnail.png`), onePixelPng),
    writeFile(
      path.join(infoPath, 'metadata.json'),
      JSON.stringify({
        id,
        name,
        ext: 'jpg',
        size: onePixelJpeg.length,
        mtime: index,
        width: 1,
        height: 1,
        folders: ['birds'],
        tags: ['bird', index % 2 ? 'odd' : 'even'],
      }),
    ),
  ]);
  mtime[id] = index;
}

await Promise.all([
  writeFile(
    path.join(libraryPath, 'metadata.json'),
    JSON.stringify({
      folders: [{ id: 'birds', name: 'Birds', children: [] }],
      modificationTime: Date.now(),
      applicationVersion: 'acceptance',
    }),
  ),
  writeFile(path.join(libraryPath, 'mtime.json'), JSON.stringify(mtime)),
  writeFile(path.join(libraryPath, 'tags.json'), JSON.stringify(['bird', 'odd', 'even'])),
  writeFile(
    path.join(fixtureRoot, 'setup-config.json'),
    JSON.stringify({ libraryPath: '', browseRoots: [fixtureRoot] }),
  ),
  writeFile(
    path.join(fixtureRoot, 'existing-config.json'),
    JSON.stringify({ libraryPath, browseRoots: [fixtureRoot] }),
  ),
]);

console.log(`Prepared Playwright library at ${libraryPath}`);
