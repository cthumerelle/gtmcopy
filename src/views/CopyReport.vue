<template>
  <div class="container mx-auto px-4 py-8">
    <router-link to="/history" class="text-sm text-primary-600 hover:text-primary-900">← Copy History</router-link>

    <div v-if="loading" class="text-center my-12 text-gray-600">Loading…</div>

    <div v-else-if="!report" class="my-12 text-center">
      <h1 class="text-xl font-semibold text-gray-900 mb-2">Report not found</h1>
      <p class="text-gray-600">This copy report is not stored in this browser.</p>
    </div>

    <div v-else class="mt-4 space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Copy report</h1>
          <p class="text-sm text-gray-600 mt-1">{{ formatDate(report.createdAt) }}</p>
        </div>
        <button class="btn-secondary" @click="exportReport">Export JSON</button>
      </div>

      <div class="bg-gray-50 p-4 rounded-md text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-gray-500">Source</p>
          <p class="font-medium text-gray-900">
            {{ report.source?.accountName }} / {{ report.source?.containerName }} / {{ report.source?.workspaceName }}
          </p>
        </div>
        <div>
          <p class="text-gray-500">Selection</p>
          <p class="text-gray-900">{{ describeSelection(report) }}</p>
        </div>
        <div>
          <p class="text-gray-500">Targets</p>
          <p class="text-gray-900">{{ report.targets?.length || 0 }} container(s)</p>
        </div>
        <div>
          <p class="text-gray-500">Auto-publish</p>
          <p class="text-gray-900">{{ report.autoPublish ? 'yes' : 'no' }}</p>
        </div>
      </div>

      <CopyProgress :report="report" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import CopyProgress from '../components/CopyProgress.vue';
import { getReport, downloadJson } from '../services/copyHistory';
import { followCopyJob, getFollowedReport } from '../services/copyJobRecorder';

const route = useRoute();

const report = ref(null);
const loading = ref(true);

function describeSelection(current) {
  const parts = Object.entries(current.selection || {})
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${count} ${type}`);
  const deletions = Object.values(current.deletions || {}).reduce((sum, names) => sum + (names?.length || 0), 0);
  if (deletions) parts.push(`${deletions} deletion(s)`);
  return parts.join(', ') || '–';
}

function exportReport() {
  downloadJson(`gtm-copy-${report.value.id}.json`, report.value);
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat('default', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(isoDate));
}

async function loadReport(id) {
  loading.value = true;
  try {
    report.value = getFollowedReport(id) || await getReport(id) || null;
    if (report.value?.status === 'running' && !getFollowedReport(id)) {
      followCopyJob(report.value);
    }
  } catch (err) {
    console.error('Failed to load copy report:', err);
    report.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.id, id => { if (id) loadReport(id); }, { immediate: true });
</script>
