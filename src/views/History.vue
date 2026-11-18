<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Copy History</h1>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" :disabled="reports.length === 0" @click="exportAll">Export JSON</button>
        <button class="btn-secondary text-red-700" :disabled="reports.length === 0" @click="clearAll">Clear history</button>
        <router-link to="/copy" class="btn-primary">New Copy</router-link>
      </div>
    </div>

    <p class="mb-6 text-sm text-gray-600">
      Copy reports are stored only in this browser. They are not sent to any server and are lost if the browser data is cleared.
    </p>

    <div v-if="error" class="mb-6 p-4 bg-red-100 text-red-800 rounded-md">
      {{ error }}
    </div>

    <div v-if="loading" class="text-center my-12 text-gray-600">Loading…</div>

    <div v-else-if="reports.length === 0" class="text-center my-12">
      <h3 class="text-lg font-medium text-gray-900 mb-2">No copy history yet</h3>
      <p class="text-gray-600 mb-6">Copies made from this browser will appear here.</p>
      <router-link to="/copy" class="btn-primary">Start a Copy</router-link>
    </div>

    <div v-else>
      <div class="mb-4 flex flex-wrap items-end gap-4">
        <div class="form-group mb-0">
          <label for="status-filter" class="form-label">Status</label>
          <select id="status-filter" v-model="statusFilter" class="form-input">
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
            <option value="incomplete">Incomplete</option>
            <option value="running">Running</option>
          </select>
        </div>
        <p class="text-sm text-gray-600 pb-2">{{ filteredRows.length }} cop{{ filteredRows.length > 1 ? 'ies' : 'y' }}</p>
      </div>

      <div class="overflow-x-auto bg-white rounded-lg shadow">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th v-for="column in columns" :key="column" scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {{ column }}
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="row in visibleRows"
              :key="row.report.id"
              class="hover:bg-gray-50 cursor-pointer"
              @click="openReport(row.report.id)"
            >
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ formatDate(row.report.createdAt) }}</td>
              <td class="px-4 py-3 text-sm">
                <div class="font-medium text-gray-900">{{ row.report.source?.containerName }}</div>
                <div class="text-gray-500">{{ row.report.source?.workspaceName }}</div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">{{ describeTargets(row.report) }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span class="text-gray-900">{{ row.summary.totals.ok + row.summary.totals.deleted }} ok</span>
                <span v-if="row.summary.totals.failed" class="ml-2 text-red-700">{{ row.summary.totals.failed }} failed</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                <template v-if="row.report.autoPublish">{{ row.summary.totals.published }} / {{ row.summary.totals.targets }}</template>
                <template v-else>off</template>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="statusBadgeClass(row.status)">
                  {{ row.status }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ formatDuration(row) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filteredRows.length > visibleCount" class="mt-4 text-center">
        <button class="btn-secondary" @click="visibleCount += PAGE_SIZE">Show more</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { listReports, clearReports, downloadJson } from '../services/copyHistory';
import { followCopyJob, getFollowedReport } from '../services/copyJobRecorder';
import { summarizeCopy } from '../utils/copyReport';

const PAGE_SIZE = 25;
const columns = ['Date', 'Source', 'Targets', 'Elements', 'Published', 'Status', 'Duration'];

const router = useRouter();

const reports = ref([]);
const loading = ref(false);
const error = ref(null);
const statusFilter = ref('');
const visibleCount = ref(PAGE_SIZE);

const rows = computed(() => reports.value.map(report => {
  const summary = summarizeCopy(report.events || [], { streamLost: report.status === 'incomplete' });
  return { report, summary, status: report.status === 'running' ? 'running' : summary.status };
}));

const filteredRows = computed(() => statusFilter.value
  ? rows.value.filter(row => row.status === statusFilter.value)
  : rows.value);

const visibleRows = computed(() => filteredRows.value.slice(0, visibleCount.value));

async function loadReports() {
  loading.value = true;
  error.value = null;
  try {
    reports.value = (await listReports()).map(report => getFollowedReport(report.id) || report);
    reports.value
      .filter(report => report.status === 'running' && !getFollowedReport(report.id))
      .forEach(report => followCopyJob(report));
  } catch (err) {
    console.error('Failed to load copy history:', err);
    error.value = 'Copy history could not be read from this browser.';
  } finally {
    loading.value = false;
  }
}

function openReport(id) {
  router.push({ name: 'history-report', params: { id } });
}

function exportAll() {
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(`gtm-copy-history-${date}.json`, reports.value);
}

async function clearAll() {
  if (!window.confirm('Delete all copy reports stored in this browser? This cannot be undone.')) return;
  try {
    await clearReports();
    reports.value = [];
  } catch (err) {
    console.error('Failed to clear copy history:', err);
    error.value = 'Copy history could not be cleared.';
  }
}

function describeTargets(report) {
  const names = (report.targets || []).map(target => report.containerNames?.[target.containerId] || target.containerId);
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
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

function formatDate(isoDate) {
  return new Intl.DateTimeFormat('default', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(isoDate));
}

function formatDuration(row) {
  if (row.status === 'running') return '…';
  const end = row.summary.finishedAt ?? row.report.events?.[row.report.events.length - 1]?.at;
  const start = row.summary.startedAt;
  if (!end || !start) return '–';
  const seconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
}

onMounted(loadReports);
</script>
