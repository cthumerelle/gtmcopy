import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeCopy } from '../src/utils/copyReport.js';

let nextId = 1;
const ev = (type, payload = {}, at = 1000 + nextId * 1000) => ({ id: nextId++, type, at, payload });

const twoTargetCopy = () => {
  nextId = 1;
  return [
    ev('JOB_STARTED', { totalTargets: 2, elementsPerTarget: 3, autoPublish: true }, 1000),
    ev('TARGET_STARTED', { index: 0, accountId: 'a1', containerId: 'c1' }),
    ev('WORKSPACE_READY', { containerId: 'c1', workspaceId: 'w9', workspaceName: 'temp-copy-1', reused: false }),
    ev('FOLDER_CREATED', { containerId: 'c1', name: 'Framework Analytics' }),
    ev('ELEMENT_OK', { containerId: 'c1', type: 'tag', name: 'Piano Analytics' }),
    ev('ELEMENT_FAILED', { containerId: 'c1', type: 'variable', name: 'augmented_items', httpStatus: 400, apiMessage: 'bad' }),
    ev('ELEMENT_DELETED', { containerId: 'c1', type: 'trigger', name: 'old', found: true }),
    ev('TARGET_COPY_DONE', { index: 0, containerId: 'c1' }),
    ev('RETRY_SCHEDULED', { reason: 'QUOTA', waitMs: 5000 }),
    ev('PUBLISH_STARTED', { containerId: 'c1' }),
    ev('PUBLISH_DONE', { containerId: 'c1', versionId: '12' }),
    ev('TARGET_DONE', { index: 0, containerId: 'c1', status: 'partial', published: true }),
    ev('TARGET_STARTED', { index: 1, accountId: 'a1', containerId: 'c2' }),
    ev('WORKSPACE_READY', { containerId: 'c2', workspaceId: 'w3', workspaceName: 'temp-copy-2', reused: false }),
    ev('FOLDER_REUSED', { containerId: 'c2', name: 'Framework Analytics' }),
    ev('ELEMENT_OK', { containerId: 'c2', type: 'tag', name: 'Piano Analytics' }),
    ev('ELEMENT_DELETED', { containerId: 'c2', type: 'trigger', name: 'old', found: false }),
    ev('TARGET_COPY_DONE', { index: 1, containerId: 'c2' }),
    ev('PUBLISH_STARTED', { containerId: 'c2' }),
    ev('PUBLISH_FAILED', { containerId: 'c2', code: 'COMPILER_ERROR', versionId: '4', apiMessage: 'compile' }),
    ev('TARGET_DONE', { index: 1, containerId: 'c2', status: 'partial', published: false }),
    ev('JOB_DONE', { result: {} }, 60000)
  ];
};

test('a running copy has no end date and is running', () => {
  nextId = 1;
  const summary = summarizeCopy([ev('JOB_STARTED', { totalTargets: 1, elementsPerTarget: 1, autoPublish: false }, 1000)]);
  assert.equal(summary.status, 'running');
  assert.equal(summary.finished, false);
  assert.equal(summary.finishedAt, null);
  assert.equal(summary.autoPublish, false);
});

test('a finished copy reports its duration and overall status', () => {
  const summary = summarizeCopy(twoTargetCopy());
  assert.equal(summary.finished, true);
  assert.equal(summary.startedAt, 1000);
  assert.equal(summary.finishedAt, 60000);
  assert.equal(summary.durationMs, 59000);
  assert.equal(summary.status, 'partial');
});

test('groups elements per target with their outcome', () => {
  const [c1, c2] = summarizeCopy(twoTargetCopy()).targets;
  assert.deepEqual(c1.elements.map(e => [e.type, e.name, e.status]), [
    ['tag', 'Piano Analytics', 'ok'],
    ['variable', 'augmented_items', 'failed'],
    ['trigger', 'old', 'deleted']
  ]);
  assert.equal(c1.elements[1].apiMessage, 'bad');
  assert.equal(c1.elements[1].httpStatus, 400);
  assert.deepEqual(c2.elements.map(e => e.status), ['ok', 'skipped']);
});

test('reports workspace, folders and publication per target', () => {
  const [c1, c2] = summarizeCopy(twoTargetCopy()).targets;
  assert.deepEqual(c1.workspace, { id: 'w9', name: 'temp-copy-1', reused: false });
  assert.equal(c1.accountId, 'a1');
  assert.deepEqual(c1.folders, [{ name: 'Framework Analytics', status: 'created' }]);
  assert.deepEqual(c2.folders, [{ name: 'Framework Analytics', status: 'reused' }]);
  assert.deepEqual(c1.publication, { status: 'published', versionId: '12' });
  assert.equal(c2.publication.status, 'failed');
  assert.equal(c2.publication.code, 'COMPILER_ERROR');
  assert.equal(c2.publication.versionId, '4');
});

test('counts outcomes across targets', () => {
  const { totals } = summarizeCopy(twoTargetCopy());
  assert.deepEqual(totals, { ok: 2, failed: 1, deleted: 1, skipped: 1, published: 1, targets: 2 });
});

test('sums quota pauses', () => {
  assert.equal(summarizeCopy(twoTargetCopy()).pausedMs, 5000);
});

test('a target without TARGET_DONE is incomplete once the job is over', () => {
  nextId = 1;
  const summary = summarizeCopy([
    ev('JOB_STARTED', { totalTargets: 1, elementsPerTarget: 1, autoPublish: true }, 1000),
    ev('TARGET_STARTED', { index: 0, accountId: 'a1', containerId: 'c1' }),
    ev('JOB_FAILED', { apiMessage: 'boom' }, 5000)
  ]);
  assert.equal(summary.status, 'failed');
  assert.equal(summary.error, 'boom');
  assert.equal(summary.targets[0].status, 'incomplete');
});

test('a copy whose stream was lost is incomplete', () => {
  nextId = 1;
  const summary = summarizeCopy([
    ev('JOB_STARTED', { totalTargets: 1, elementsPerTarget: 1, autoPublish: true }, 1000),
    ev('TARGET_STARTED', { index: 0, accountId: 'a1', containerId: 'c1' })
  ], { streamLost: true });
  assert.equal(summary.status, 'incomplete');
  assert.equal(summary.targets[0].status, 'incomplete');
});

test('all targets successful gives a successful copy', () => {
  nextId = 1;
  const summary = summarizeCopy([
    ev('JOB_STARTED', { totalTargets: 1, elementsPerTarget: 1, autoPublish: false }, 1000),
    ev('TARGET_STARTED', { index: 0, accountId: 'a1', containerId: 'c1' }),
    ev('ELEMENT_OK', { containerId: 'c1', type: 'tag', name: 't' }),
    ev('TARGET_DONE', { index: 0, containerId: 'c1', status: 'success', published: false }),
    ev('JOB_DONE', { result: {} })
  ]);
  assert.equal(summary.status, 'success');
  assert.deepEqual(summary.targets[0].publication, { status: 'not_requested', versionId: null });
});

test('keeps the destination folder of each copied element', () => {
  nextId = 1;
  const [target] = summarizeCopy([
    ev('JOB_STARTED', { totalTargets: 1, elementsPerTarget: 2, autoPublish: false }, 1000),
    ev('TARGET_STARTED', { index: 0, accountId: 'a1', containerId: 'c1' }),
    ev('ELEMENT_OK', { containerId: 'c1', type: 'client', name: 'Piano Analytics - Client', folder: 'Framework Analytics' }),
    ev('ELEMENT_OK', { containerId: 'c1', type: 'client', name: 'GA4' })
  ]).targets;
  assert.deepEqual(target.elements.map(e => e.folder), ['Framework Analytics', null]);
});

test('dependency and cleanup failures are kept as target issues', () => {
  nextId = 1;
  const [target] = summarizeCopy([
    ev('JOB_STARTED', { totalTargets: 1, elementsPerTarget: 1, autoPublish: true }, 1000),
    ev('TARGET_STARTED', { index: 0, accountId: 'a1', containerId: 'c1' }),
    ev('DEPENDENCY_FAILED', { containerId: 'c1', type: 'template', name: 'tpl', apiMessage: 'x' }),
    ev('FOLDER_FAILED', { containerId: 'c1', name: 'F', apiMessage: 'y' }),
    ev('CLEANUP_FAILED', { containerId: 'c1', workspaceId: 'w1', apiMessage: 'z' })
  ]).targets;
  assert.deepEqual(target.issues.map(i => i.kind), ['dependency', 'cleanup']);
  assert.deepEqual(target.folders, [{ name: 'F', status: 'failed', apiMessage: 'y' }]);
});
