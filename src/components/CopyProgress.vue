<template>
  <div class="space-y-6">
    <div v-if="isRunning">
      <div class="flex justify-between items-baseline mb-2">
        <h3 class="text-lg font-medium text-gray-800">
          {{ headline }}
        </h3>
        <span class="text-sm text-gray-600">{{ processed }} / {{ total || '…' }}</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          class="h-3 rounded-full transition-all duration-500"
          :class="summary.totals.failed > 0 ? 'bg-yellow-500' : 'bg-primary-600'"
          :style="{ width: `${percent}%` }"
        ></div>
      </div>
      <div class="flex flex-wrap gap-4 mt-2 text-xs text-gray-600">
        <span>✓ {{ summary.totals.ok + summary.totals.deleted }} OK</span>
        <span :class="summary.totals.failed > 0 ? 'text-red-600 font-medium' : ''">✗ {{ summary.totals.failed }} failed</span>
        <span v-if="summary.pausedMs > 0">⏸ {{ formatDuration(summary.pausedMs) }} paused</span>
        <span>⏱ {{ formatDuration(elapsedMs) }} elapsed</span>
      </div>
    </div>

    <div v-else class="p-4 rounded-md border" :class="statusPanelClass(summary.status)">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-lg font-medium">{{ statusHeadline(summary.status) }}</h3>
        <span class="text-sm">{{ formatDuration(elapsedMs) }}</span>
      </div>
      <div class="flex flex-wrap gap-4 mt-2 text-sm">
        <span>✓ {{ summary.totals.ok }} copied</span>
        <span v-if="summary.totals.deleted">🗑 {{ summary.totals.deleted }} deleted</span>
        <span :class="summary.totals.failed > 0 ? 'text-red-700 font-medium' : ''">✗ {{ summary.totals.failed }} failed</span>
        <span>🚀 {{ summary.totals.published }} / {{ summary.totals.targets }} published</span>
        <span v-if="summary.pausedMs > 0">⏸ {{ formatDuration(summary.pausedMs) }} paused by GTM quota</span>
      </div>
      <p v-if="summary.error" class="mt-2 text-sm font-mono">{{ summary.error }}</p>
      <p v-if="summary.status === 'incomplete'" class="mt-2 text-sm">
        The server stopped reporting before the end of the copy. What happened after the last event below is unknown: check the containers in GTM.
      </p>
    </div>

    <div v-if="isRunning && report.reconnecting" class="p-3 bg-orange-50 text-orange-800 rounded-md text-sm">
      Connection to the server interrupted, reconnecting…
    </div>

    <div
      v-for="publishStatus in publishStatuses"
      :key="publishStatus.containerId"
      class="p-3 rounded-md bg-indigo-50 text-indigo-900 flex items-start gap-3"
    >
      <svg class="animate-spin h-5 w-5 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <div class="text-sm flex-1">
        <p class="font-medium">{{ getContainerName(publishStatus.containerId) }}</p>
        <p class="mt-1">{{ publishStepLabel(publishStatus.step, publishStatus.versionId) }}</p>
        <p class="text-xs mt-1">Waiting for GTM for {{ formatDuration(publishStatus.elapsedMs) }}</p>
        <p v-if="publishStatus.stillProcessing" class="text-xs mt-1">
          GTM did not answer within {{ Math.round(publishStatus.lastWaitDurationMs / 1000) }}s but keeps processing in the background.
          This is common on large containers: waiting for confirmation<template v-if="publishStatus.nextCheckIn">, next check in {{ publishStatus.nextCheckIn }}s</template>.
        </p>
      </div>
    </div>

    <div
      v-if="activePause"
      class="p-3 rounded-md flex items-center justify-between bg-orange-50 text-orange-800"
    >
      <div class="text-sm">
        <p class="font-medium">{{ pauseTitle(activePause) }}</p>
        <p class="text-xs mt-1">
          {{ activePause.payload.request }} · attempt {{ activePause.payload.attempt }}/{{ activePause.payload.maxRetries }}
        </p>
      </div>
      <div class="text-2xl font-mono tabular-nums">{{ pauseRemaining }}s</div>
    </div>

    <div v-if="summary.targets.length > 0">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-sm font-medium text-gray-700">Targets ({{ summary.targets.length }}<template v-if="summary.totals.targets > summary.targets.length"> / {{ summary.totals.targets }}</template>)</h4>
        <label class="flex items-center gap-2 text-xs text-gray-600">
          <input v-model="failuresOnly" type="checkbox" class="rounded">
          Failures only
        </label>
      </div>
      <div class="space-y-3">
        <div
          v-for="target in summary.targets"
          :key="target.containerId"
          class="p-3 bg-white border border-gray-200 rounded-md"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-medium text-gray-900">{{ getContainerName(target.containerId) }}</p>
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="statusBadgeClass(target.status)">
              {{ target.status }}
            </span>
          </div>

          <dl class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
            <div v-if="target.workspace">
              <dt class="inline">Workspace:</dt>
              <dd class="inline ml-1">
                <a
                  v-if="target.accountId && target.publication.status !== 'published'"
                  :href="workspaceUrl(target)"
                  target="_blank"
                  rel="noopener"
                  class="text-primary-600 hover:underline"
                >{{ target.workspace.name }}</a>
                <span v-else>{{ target.workspace.name }}</span>
                ({{ target.workspace.reused ? 'reused' : 'created' }})
              </dd>
            </div>
            <div>
              <dt class="inline">Publication:</dt>
              <dd class="inline ml-1" :class="target.publication.status === 'failed' ? 'text-red-700' : ''">
                <template v-if="target.publication.status === 'published'">
                  <a
                    v-if="target.accountId && target.publication.versionId"
                    :href="versionUrl(target)"
                    target="_blank"
                    rel="noopener"
                    class="text-primary-600 hover:underline"
                  >version {{ target.publication.versionId }}</a>
                  <span v-else>published</span>
                </template>
                <template v-else-if="target.publication.status === 'failed'">
                  {{ publishFailureLabel(target.publication.code) }}<template v-if="target.publication.versionId"> (version {{ target.publication.versionId }})</template>
                </template>
                <template v-else-if="target.publication.status === 'publishing'">in progress…</template>
                <template v-else>{{ summary.autoPublish ? 'not published' : 'not requested, workspace kept for review' }}</template>
              </dd>
            </div>
            <div v-if="target.folders.length > 0" class="md:col-span-2">
              <dt class="inline">Folders:</dt>
              <dd class="inline ml-1">
                <span
                  v-for="folder in target.folders"
                  :key="folder.name"
                  class="inline-block mr-2"
                  :class="folder.status === 'failed' ? 'text-red-700' : ''"
                  :title="folder.apiMessage || ''"
                >📁 {{ folder.name }} ({{ folder.status }}<template v-if="folderElementCount(target, folder.name)">, {{ folderElementCount(target, folder.name) }} element(s)</template>)</span>
              </dd>
            </div>
          </dl>

          <p v-if="target.error" class="mt-2 text-xs text-red-700 font-mono">{{ target.error }}</p>
          <ul v-if="target.issues.length > 0" class="mt-2 space-y-1">
            <li v-for="(issue, index) in target.issues" :key="index" class="text-xs text-red-700">
              {{ describeIssue(issue) }}<span v-if="issue.apiMessage" class="font-mono">: {{ issue.apiMessage }}</span>
            </li>
          </ul>

          <details v-if="visibleElements(target).length > 0" class="mt-2" :open="failuresOnly">
            <summary class="text-xs text-gray-600 cursor-pointer select-none">
              {{ elementSummary(target) }}
            </summary>
            <table class="mt-2 w-full text-xs">
              <tbody class="divide-y divide-gray-100">
                <tr v-for="(element, index) in visibleElements(target)" :key="index">
                  <td class="py-1 pr-2 w-6">{{ elementIcon(element.status) }}</td>
                  <td class="py-1 pr-2 text-gray-500 whitespace-nowrap">{{ element.type }}</td>
                  <td class="py-1 pr-2 text-gray-900">{{ element.name }}</td>
                  <td class="py-1 pr-2 text-gray-500 whitespace-nowrap">{{ element.folder ? `📁 ${element.folder}` : '' }}</td>
                  <td class="py-1 text-right" :class="element.status === 'failed' ? 'text-red-700' : 'text-gray-500'">
                    <template v-if="element.status === 'failed'">
                      <span v-if="element.httpStatus" class="mr-1 px-1 bg-red-100 rounded">HTTP {{ element.httpStatus }}</span>
                      <span class="font-mono">{{ element.apiMessage }}</span>
                    </template>
                    <template v-else>{{ elementStatusLabel(element.status) }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </details>
        </div>
      </div>
    </div>

    <details :open="isRunning">
      <summary class="text-sm font-medium text-gray-700 cursor-pointer select-none">Activity ({{ events.length }} events)</summary>
      <ul ref="feedEl" class="mt-2 max-h-72 overflow-y-auto bg-gray-50 rounded-md p-3 space-y-1 text-xs font-mono">
        <li v-for="event in events" :key="event.id" :class="eventClass(event)">
          <span class="text-gray-400">{{ formatTime(event.at) }}</span>
          {{ eventIcon(event) }} {{ describeEvent(event) }}
        </li>
      </ul>
    </details>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

import { summarizeCopy } from '../utils/copyReport';

const props = defineProps({
  report: { type: Object, required: true }
});

const PROCESSED_EVENTS = ['ELEMENT_OK', 'ELEMENT_FAILED', 'ELEMENT_DELETED'];
const FAILURE_EVENTS = ['ELEMENT_FAILED', 'DEPENDENCY_FAILED', 'FOLDER_FAILED', 'PUBLISH_FAILED', 'CLEANUP_FAILED', 'JOB_FAILED'];
const PUBLISH_PHASE_EVENTS = ['PUBLISH_STARTED', 'PUBLISH_STEP', 'PUBLISH_DONE', 'PUBLISH_FAILED'];
const GTM_URL = 'https://tagmanager.google.com/#';

const now = ref(Date.now());
const feedEl = ref(null);
const failuresOnly = ref(false);

let ticker = null;

const events = computed(() => props.report.events || []);
const summary = computed(() => summarizeCopy(events.value, { streamLost: props.report.status === 'incomplete' }));
const isRunning = computed(() => props.report.status === 'running' && !summary.value.finished);

const jobStarted = computed(() => events.value.find(e => e.type === 'JOB_STARTED')?.payload);
const total = computed(() => jobStarted.value ? jobStarted.value.totalTargets * jobStarted.value.elementsPerTarget : 0);
const processed = computed(() => events.value.filter(e => PROCESSED_EVENTS.includes(e.type)).length);
const percent = computed(() => total.value ? Math.min(100, Math.round((processed.value / total.value) * 100)) : 0);

const startedAt = computed(() => summary.value.startedAt ?? Date.parse(props.report.createdAt));
const endedAt = computed(() => {
  if (isRunning.value) return now.value;
  return summary.value.finishedAt ?? events.value[events.value.length - 1]?.at ?? startedAt.value;
});
const elapsedMs = computed(() => Math.max(0, endedAt.value - startedAt.value));

const currentTarget = computed(() => [...events.value].reverse().find(e => e.type === 'TARGET_STARTED')?.payload);

const publishStatuses = computed(() => {
  if (!isRunning.value) return [];
  const lastPhaseByContainer = new Map();
  events.value
    .filter(e => PUBLISH_PHASE_EVENTS.includes(e.type))
    .forEach(e => lastPhaseByContainer.set(e.payload.containerId, e));

  return [...lastPhaseByContainer.entries()]
    .filter(([, phase]) => ['PUBLISH_STARTED', 'PUBLISH_STEP'].includes(phase.type))
    .map(([containerId, phase]) => {
      const step = phase.type === 'PUBLISH_STEP' ? phase : null;
      const waits = step
        ? events.value.filter(e => e.id > step.id && isStillProcessing(e) && e.payload.containerId === containerId)
        : [];
      const lastWait = waits[waits.length - 1];
      return {
        containerId,
        step: step?.payload.step || null,
        versionId: step?.payload.versionId || null,
        elapsedMs: now.value - phase.at,
        stillProcessing: waits.length > 0,
        lastWaitDurationMs: lastWait?.payload.durationMs || 0,
        nextCheckIn: lastWait && lastWait.payload.resumeAt > now.value
          ? Math.ceil((lastWait.payload.resumeAt - now.value) / 1000)
          : 0
      };
    });
});

const currentTargetCopied = computed(() => currentTarget.value && events.value.some(e =>
  e.type === 'TARGET_COPY_DONE' && e.payload.containerId === currentTarget.value.containerId));

const headline = computed(() => {
  if (!jobStarted.value) return 'Preparing copy…';
  if (!currentTarget.value) return 'Reading source workspace…';
  const isLastTarget = currentTarget.value.index + 1 === jobStarted.value.totalTargets;
  if (currentTargetCopied.value && isLastTarget && publishStatuses.value.length > 0) {
    return `All targets copied, waiting for GTM to publish ${publishStatuses.value.length} container(s)`;
  }
  const position = `${currentTarget.value.index + 1}/${jobStarted.value.totalTargets}`;
  return `Copying to ${getContainerName(currentTarget.value.containerId)} (${position})`;
});

const activePause = computed(() => {
  if (!isRunning.value) return null;
  const last = [...events.value].reverse().find(e => e.type === 'RETRY_SCHEDULED' && !isStillProcessing(e));
  return last && last.payload.resumeAt > now.value ? last : null;
});

const pauseRemaining = computed(() => activePause.value
  ? Math.ceil((activePause.value.payload.resumeAt - now.value) / 1000)
  : 0);

function getContainerName(containerId) {
  return props.report.containerNames?.[containerId] || containerId;
}

function workspaceUrl(target) {
  return `${GTM_URL}/container/accounts/${target.accountId}/containers/${target.containerId}/workspaces/${target.workspace.id}`;
}

function versionUrl(target) {
  return `${GTM_URL}/versions/accounts/${target.accountId}/containers/${target.containerId}/versions/${target.publication.versionId}`;
}

function statusHeadline(status) {
  return {
    success: 'Copy completed successfully',
    partial: 'Copy completed with errors',
    failed: 'Copy failed',
    incomplete: 'Copy interrupted'
  }[status] || status;
}

function statusPanelClass(status) {
  return {
    success: 'bg-green-50 border-green-200 text-green-900',
    partial: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    failed: 'bg-red-50 border-red-200 text-red-900',
    incomplete: 'bg-gray-50 border-gray-300 text-gray-900'
  }[status] || 'bg-gray-50 border-gray-200 text-gray-900';
}

function statusBadgeClass(status) {
  return {
    success: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    running: 'bg-blue-100 text-blue-800',
    incomplete: 'bg-gray-200 text-gray-800'
  }[status] || 'bg-gray-100 text-gray-800';
}

function visibleElements(target) {
  return failuresOnly.value ? target.elements.filter(e => e.status === 'failed') : target.elements;
}

function elementSummary(target) {
  const count = status => target.elements.filter(e => e.status === status).length;
  const parts = [`${count('ok')} copied`];
  if (count('deleted')) parts.push(`${count('deleted')} deleted`);
  if (count('skipped')) parts.push(`${count('skipped')} not found for deletion`);
  if (count('failed')) parts.push(`${count('failed')} failed`);
  return `Elements: ${parts.join(', ')}`;
}

function folderElementCount(target, folderName) {
  return target.elements.filter(e => e.folder === folderName).length;
}

function elementIcon(status) {
  return { ok: '✓', deleted: '🗑', skipped: '–', failed: '✗' }[status] || '•';
}

function elementStatusLabel(status) {
  return { ok: 'copied', deleted: 'deleted', skipped: 'not in target' }[status] || status;
}

function describeIssue(issue) {
  if (issue.kind === 'dependency') return `Required ${issue.type} "${issue.name}" could not be copied`;
  if (issue.kind === 'cleanup') return 'Temporary workspace could not be deleted';
  return issue.kind;
}

/**
 * @param {Object} event
 * @returns {boolean}
 */
function isStillProcessing(event) {
  return event.type === 'RETRY_SCHEDULED' && event.payload.reason === 'STILL_PROCESSING';
}

/**
 * @param {string} step
 * @param {string|null} versionId
 * @returns {string}
 */
function publishStepLabel(step, versionId) {
  if (step === 'CREATE_VERSION') return 'GTM is creating the container version…';
  if (step === 'PUBLISH_VERSION') return `GTM is publishing version ${versionId} to production…`;
  return 'Preparing publication…';
}

/**
 * @param {Object} event
 * @returns {string}
 */
function pauseTitle(event) {
  const status = event.payload.httpStatus ? ` (HTTP ${event.payload.httpStatus})` : '';
  return event.payload.reason === 'QUOTA'
    ? `GTM quota exceeded${status}, all requests paused`
    : `GTM server error${status}, retrying`;
}

/**
 * @param {Object} event
 * @returns {string}
 */
function describeFailureTarget(event) {
  const { type, name, containerId, code, operation } = event.payload;
  const container = containerId ? getContainerName(containerId) : '';
  switch (event.type) {
    case 'ELEMENT_FAILED':
      return `${container} · ${operation === 'delete' ? 'delete ' : ''}${type} "${name}"`;
    case 'DEPENDENCY_FAILED':
      return `${container} · required ${type} "${name}"`;
    case 'FOLDER_FAILED':
      return `${container} · folder "${name}" could not be created`;
    case 'PUBLISH_FAILED':
      return `${container} · publish failed: ${publishFailureLabel(code)}`;
    case 'CLEANUP_FAILED':
      return `${container} · temporary workspace could not be deleted`;
    case 'JOB_FAILED':
      return 'Copy aborted';
    default:
      return event.type;
  }
}

/**
 * @param {string} code
 * @returns {string}
 */
function publishFailureLabel(code) {
  return {
    COMPILER_ERROR: 'version has compiler errors (missing dependencies)',
    VERSION_NOT_PUBLISHED: 'version created but not published',
    VERSION_NOT_CREATED: 'version could not be created'
  }[code] || code;
}

/**
 * @param {Object} event
 * @returns {string}
 */
function describeEvent(event) {
  const p = event.payload;
  const container = p.containerId ? getContainerName(p.containerId) : '';
  switch (event.type) {
    case 'JOB_STARTED':
      return `Copy started: ${p.elementsPerTarget} element(s) × ${p.totalTargets} target(s)`;
    case 'TARGET_STARTED':
      return `Target ${p.index + 1}: ${container}`;
    case 'WORKSPACE_READY':
      return `${p.reused ? 'Reusing' : 'Created'} workspace "${p.workspaceName}"`;
    case 'FOLDER_CREATED':
      return `Created folder "${p.name}"`;
    case 'FOLDER_REUSED':
      return `Using existing folder "${p.name}"`;
    case 'DEPENDENCY_OK':
      return `Required ${p.type} "${p.name}" copied`;
    case 'ELEMENT_OK':
      return `${p.type} "${p.name}"${p.folder ? ` → folder "${p.folder}"` : ''}`;
    case 'ELEMENT_DELETED':
      return p.found ? `Deleted ${p.type} "${p.name}"` : `${p.type} "${p.name}" not in target, skipped`;
    case 'PUBLISH_STEP':
      return `${container}: ${publishStepLabel(p.step, p.versionId)}`;
    case 'TARGET_COPY_DONE':
      return `${container}: copy finished${jobStarted.value?.autoPublish ? ', publishing in background' : ''}`;
    case 'RETRY_SCHEDULED':
      if (isStillProcessing(event)) {
        return `GTM still processing (no answer after ${Math.round(p.durationMs / 1000)}s), checking again in ${Math.round(p.waitMs / 1000)}s`;
      }
      return `${pauseTitle(event)} in ${Math.round(p.waitMs / 1000)}s (attempt ${p.attempt}/${p.maxRetries})`;
    case 'PUBLISH_STARTED':
      return `${container}: publishing…`;
    case 'VERSION_RECOVERED':
      return `Version ${p.versionId} was created despite the GTM error, reusing it`;
    case 'PUBLISH_CONFIRMED':
      return `Version ${p.versionId} is live despite the GTM error`;
    case 'PUBLISH_DONE':
      return `${container}: published version ${p.versionId || ''}`;
    case 'TARGET_DONE':
      return `${container}: ${p.status}${p.published ? ', published' : ''}`;
    case 'JOB_DONE':
      return 'Copy finished';
    default:
      return FAILURE_EVENTS.includes(event.type) ? describeFailureTarget(event) : event.type;
  }
}

/**
 * @param {Object} event
 * @returns {string}
 */
function eventIcon(event) {
  if (FAILURE_EVENTS.includes(event.type)) return '✗';
  if (isStillProcessing(event)) return '…';
  if (event.type === 'RETRY_SCHEDULED') return '↻';
  if (['ELEMENT_OK', 'ELEMENT_DELETED', 'DEPENDENCY_OK', 'FOLDER_CREATED', 'FOLDER_REUSED', 'PUBLISH_DONE', 'VERSION_RECOVERED', 'PUBLISH_CONFIRMED'].includes(event.type)) return '✓';
  return '•';
}

/**
 * @param {Object} event
 * @returns {string}
 */
function eventClass(event) {
  if (FAILURE_EVENTS.includes(event.type)) return 'text-red-700';
  if (isStillProcessing(event)) return 'text-blue-700';
  if (event.type === 'RETRY_SCHEDULED') return 'text-orange-700';
  if (['TARGET_STARTED', 'TARGET_DONE', 'JOB_STARTED', 'JOB_DONE'].includes(event.type)) return 'text-gray-900 font-semibold';
  return 'text-gray-700';
}

/**
 * @param {number} timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
}

async function scrollFeedToBottom() {
  await nextTick();
  if (feedEl.value) feedEl.value.scrollTop = feedEl.value.scrollHeight;
}

function stopTicker() {
  clearInterval(ticker);
  ticker = null;
}

watch(() => events.value.length, () => {
  if (isRunning.value) scrollFeedToBottom();
});

watch(isRunning, running => {
  if (!running) stopTicker();
});

onMounted(() => {
  if (isRunning.value) {
    ticker = setInterval(() => { now.value = Date.now(); }, 250);
    scrollFeedToBottom();
  }
});

onBeforeUnmount(stopTicker);
</script>
