<template>
  <div class="copy-details">
    <!-- Modal Background -->
    <div 
      v-if="show" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="close"
    >
      <!-- Modal Content -->
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Modal Header -->
        <div class="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h2 class="text-xl font-bold text-gray-800">Copy Operation Details</h2>
          <button 
            @click="close"
            class="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Modal Body -->
        <div class="p-6 overflow-y-auto flex-grow">
          <div v-if="loading" class="text-center py-12">
            <div class="animate-spin h-10 w-10 mx-auto mb-4 text-primary-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p class="text-gray-600">Loading details...</p>
          </div>
          
          <div v-else-if="error" class="p-4 bg-red-100 text-red-800 rounded-md">
            {{ error }}
          </div>
          
          <div v-else-if="details">
            <!-- Summary information -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div class="bg-gray-50 p-4 rounded-md">
                <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Date</h3>
                <p class="text-gray-900">{{ formatDate(details.date) }}</p>
              </div>
              
              <div class="bg-gray-50 p-4 rounded-md">
                <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</h3>
                <span class="px-3 py-1 text-sm font-semibold rounded-full"
                  :class="{
                    'bg-green-100 text-green-800': details.status === 'success',
                    'bg-red-100 text-red-800': details.status === 'failed',
                    'bg-yellow-100 text-yellow-800': details.status === 'partial'
                  }"
                >
                  {{ details.status }}
                </span>
              </div>
              
              <div class="bg-gray-50 p-4 rounded-md">
                <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Element Count</h3>
                <p class="text-gray-900">{{ details.elements?.successful || 0 }} elements copied</p>
                <p v-if="details.elements?.failed > 0" class="text-red-600">
                  {{ details.elements.failed }} elements failed
                </p>
              </div>
            </div>
            
            <!-- Source and Destination -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <h3 class="text-lg font-semibold text-gray-800 mb-3">Source</h3>
                <div class="bg-gray-50 p-4 rounded-md">
                  <p class="mb-2">
                    <span class="font-medium text-gray-600">Account ID: </span>
                    <span class="text-gray-900">{{ details.source.accountId }}</span>
                  </p>
                  <p class="mb-2">
                    <span class="font-medium text-gray-600">Container ID: </span>
                    <span class="text-gray-900">{{ details.source.containerId }}</span>
                  </p>
                  <p>
                    <span class="font-medium text-gray-600">Workspace ID: </span>
                    <span class="text-gray-900">{{ details.source.workspaceId }}</span>
                  </p>
                </div>
              </div>
              
              <div>
                <h3 class="text-lg font-semibold text-gray-800 mb-3">Destination</h3>
                <div class="bg-gray-50 p-4 rounded-md">
                  <p class="mb-2">
                    <span class="font-medium text-gray-600">Container ID: </span>
                    <span class="text-gray-900">{{ details.destination.containerId }}</span>
                  </p>
                </div>
              </div>
            </div>
            
            <!-- Element Types -->
            <div class="mb-8">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">Element Types</h3>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="type in details.elements.elementTypes" 
                  :key="type"
                  class="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                  {{ type }}
                </span>
              </div>
            </div>
            
            <!-- Errors Section -->
            <div v-if="details.errors && details.errors.length > 0" class="mb-8">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">Errors</h3>
              <div class="bg-red-50 p-4 rounded-md">
                <div v-for="(error, index) in details.errors" :key="index" class="mb-3 last:mb-0">
                  <p class="font-medium text-red-800">
                    {{ error.type === 'publish' ? 'Publishing Error' : 
                       error.type === 'cleanup' ? 'Cleanup Error' : 
                       `${error.type}: ${error.name || ''}` }}
                  </p>
                  <p class="text-red-700">{{ error.error }}</p>
                </div>
              </div>
            </div>
            
            <!-- Elements Breakdown -->
            <div class="mb-6">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">Elements Breakdown</h3>
              <div class="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Failed
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="typeData in details.elements.byType" :key="typeData.type">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">{{ typeData.type }}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span v-if="typeData.total > 0">{{ typeData.total }}</span>
                        <span v-else>-</span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span v-if="typeData.failed > 0" class="text-red-600">{{ typeData.failed }}</span>
                        <span v-else class="text-green-600">0</span>
                        <div v-if="typeData.failedItems && typeData.failedItems.length > 0" class="mt-1">
                          <div v-for="item in typeData.failedItems" :key="item" class="text-xs text-red-500">
                            {{ item }}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div v-else class="text-center py-12">
            <p class="text-gray-600">No details available</p>
          </div>
        </div>
        
        <!-- Modal Footer -->
        <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button 
            @click="close" 
            class="btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useGtmStore } from '../store/gtm';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  copyId: {
    type: [Number, String],
    default: null
  }
});

const emit = defineEmits(['close']);

const gtmStore = useGtmStore();
const loading = ref(false);
const error = ref(null);
const details = ref(null);

function close() {
  emit('close');
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('default', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

async function fetchDetails() {
  if (!props.copyId) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    details.value = await gtmStore.fetchCopyDetails(props.copyId);
  } catch (err) {
    error.value = err.message || 'Failed to fetch copy details';
  } finally {
    loading.value = false;
  }
}

watch(() => props.show, (newValue) => {
  if (newValue) {
    fetchDetails();
  }
});

watch(() => props.copyId, (newValue) => {
  if (newValue && props.show) {
    fetchDetails();
  }
});

onMounted(() => {
  if (props.show && props.copyId) {
    fetchDetails();
  }
});
</script>
