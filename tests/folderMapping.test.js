import test from 'node:test';
import assert from 'node:assert/strict';
import { planFolderMapping, withTargetFolder } from '../services/folderMapping.js';

const sourceFolders = [
  { folderId: '141', name: 'Framework Analytics' },
  { folderId: '98', name: 'LMFR' },
  { folderId: '200', name: 'Unused' },
];

test('maps a source folder to the destination folder with the same name', () => {
  const { folderMap, foldersToCreate } = planFolderMapping(
    sourceFolders,
    [{ name: 'Piano Analytics', parentFolderId: '141' }],
    [{ folderId: '7', name: 'Framework Analytics' }]
  );
  assert.deepEqual(folderMap, { 141: '7' });
  assert.deepEqual(foldersToCreate, []);
});

test('plans creation of a folder missing in the destination', () => {
  const { folderMap, foldersToCreate } = planFolderMapping(
    sourceFolders,
    [{ name: 'Piano Analytics', parentFolderId: '141' }],
    [{ folderId: '141', name: 'Something else' }]
  );
  assert.deepEqual(folderMap, {});
  assert.deepEqual(foldersToCreate.map(f => f.name), ['Framework Analytics']);
});

test('ignores source folders not used by any copied element', () => {
  const { folderMap, foldersToCreate } = planFolderMapping(
    sourceFolders,
    [{ name: 'Piano Analytics', parentFolderId: '141' }, { name: 'GA4' }],
    []
  );
  assert.deepEqual(folderMap, {});
  assert.deepEqual(foldersToCreate.map(f => f.folderId), ['141']);
});

test('rewrites the folder id to the destination one', () => {
  const el = withTargetFolder({ name: 'x', parentFolderId: '141', elementType: 'tag' }, { 141: '7' });
  assert.deepEqual(el, { name: 'x', parentFolderId: '7', elementType: 'tag' });
});

test('drops a source folder id that has no destination mapping', () => {
  const el = withTargetFolder({ name: 'x', parentFolderId: '141' }, {});
  assert.equal('parentFolderId' in el, false);
});

test('leaves elements without folder untouched', () => {
  assert.deepEqual(withTargetFolder({ name: 'x' }, { 141: '7' }), { name: 'x' });
});
