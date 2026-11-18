const TERMINAL_EVENTS = ['JOB_DONE', 'JOB_FAILED'];

const createTarget = (payload) => ({
  index: payload.index,
  accountId: payload.accountId || null,
  containerId: payload.containerId,
  status: 'running',
  workspace: null,
  folders: [],
  elements: [],
  issues: [],
  publication: { status: 'not_requested', versionId: null }
});

const errorFields = ({ httpStatus = null, apiReason = null, apiMessage = null }) => ({ httpStatus, apiReason, apiMessage });

const aggregateStatus = (targets) => {
  if (targets.length === 0) return 'failed';
  if (targets.every(t => t.status === 'success')) return 'success';
  if (targets.every(t => t.status === 'failed')) return 'failed';
  return 'partial';
};

export const summarizeCopy = (events, { streamLost = false } = {}) => {
  const started = events.find(e => e.type === 'JOB_STARTED');
  const terminal = events.find(e => TERMINAL_EVENTS.includes(e.type));
  const targets = new Map();
  let pausedMs = 0;

  const targetFor = (containerId) => {
    if (!targets.has(containerId)) targets.set(containerId, createTarget({ containerId, index: targets.size }));
    return targets.get(containerId);
  };

  for (const { type, payload = {} } of events) {
    switch (type) {
      case 'TARGET_STARTED':
        targets.set(payload.containerId, createTarget(payload));
        break;
      case 'WORKSPACE_READY':
        targetFor(payload.containerId).workspace = { id: payload.workspaceId, name: payload.workspaceName, reused: !!payload.reused };
        break;
      case 'FOLDER_CREATED':
        targetFor(payload.containerId).folders.push({ name: payload.name, status: 'created' });
        break;
      case 'FOLDER_REUSED':
        targetFor(payload.containerId).folders.push({ name: payload.name, status: 'reused' });
        break;
      case 'FOLDER_FAILED':
        targetFor(payload.containerId).folders.push({ name: payload.name, status: 'failed', apiMessage: payload.apiMessage || null });
        break;
      case 'ELEMENT_OK':
        targetFor(payload.containerId).elements.push({ type: payload.type, name: payload.name, status: 'ok', folder: payload.folder || null });
        break;
      case 'ELEMENT_DELETED':
        targetFor(payload.containerId).elements.push({ type: payload.type, name: payload.name, status: payload.found ? 'deleted' : 'skipped' });
        break;
      case 'ELEMENT_FAILED':
        targetFor(payload.containerId).elements.push({
          type: payload.type,
          name: payload.name,
          status: 'failed',
          operation: payload.operation || 'copy',
          ...errorFields(payload)
        });
        break;
      case 'DEPENDENCY_FAILED':
        targetFor(payload.containerId).issues.push({ kind: 'dependency', type: payload.type, name: payload.name, ...errorFields(payload) });
        break;
      case 'CLEANUP_FAILED':
        targetFor(payload.containerId).issues.push({ kind: 'cleanup', workspaceId: payload.workspaceId, ...errorFields(payload) });
        break;
      case 'PUBLISH_STARTED':
        targetFor(payload.containerId).publication = { status: 'publishing', versionId: null };
        break;
      case 'PUBLISH_DONE':
        targetFor(payload.containerId).publication = { status: 'published', versionId: payload.versionId || null };
        break;
      case 'PUBLISH_FAILED':
        targetFor(payload.containerId).publication = {
          status: 'failed',
          code: payload.code,
          versionId: payload.versionId || null,
          ...errorFields(payload)
        };
        break;
      case 'TARGET_DONE': {
        const target = targetFor(payload.containerId);
        target.status = payload.status;
        if (payload.status === 'failed' && payload.apiMessage) target.error = payload.apiMessage;
        break;
      }
      case 'RETRY_SCHEDULED':
        if (payload.reason === 'QUOTA') pausedMs += payload.waitMs || 0;
        break;
      default:
        break;
    }
  }

  const finished = !!terminal;
  const targetList = [...targets.values()].sort((a, b) => a.index - b.index);
  if (finished || streamLost) {
    targetList.filter(t => t.status === 'running').forEach(t => { t.status = 'incomplete'; });
  }

  const allElements = targetList.flatMap(t => t.elements);
  const countStatus = (status) => allElements.filter(e => e.status === status).length;

  let status = 'running';
  if (terminal?.type === 'JOB_FAILED') status = 'failed';
  else if (finished) status = aggregateStatus(targetList);
  else if (streamLost) status = 'incomplete';

  const startedAt = started?.at ?? events[0]?.at ?? null;
  const finishedAt = terminal?.at ?? null;

  return {
    status,
    finished,
    error: terminal?.type === 'JOB_FAILED' ? terminal.payload?.apiMessage || null : null,
    autoPublish: !!started?.payload?.autoPublish,
    startedAt,
    finishedAt,
    durationMs: startedAt !== null && finishedAt !== null ? finishedAt - startedAt : null,
    pausedMs,
    targets: targetList,
    totals: {
      ok: countStatus('ok'),
      failed: countStatus('failed'),
      deleted: countStatus('deleted'),
      skipped: countStatus('skipped'),
      published: targetList.filter(t => t.publication.status === 'published').length,
      targets: started?.payload?.totalTargets ?? targetList.length
    }
  };
};
