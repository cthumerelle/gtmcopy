<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Copy History</h1>
    
    <div v-if="error" class="mb-6 p-4 bg-red-100 text-red-800 rounded-md">
      {{ error }}
    </div>
    
    <div v-if="loading" class="flex justify-center my-12">
      <div class="animate-spin h-10 w-10 text-primary-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
    
    <div v-else>
      <!-- Empty state -->
      <div v-if="gtmStore.copyHistory.length === 0" class="text-center my-12">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No copy history yet</h3>
        <p class="text-gray-600 mb-6">You haven't performed any GTM copy operations yet.</p>
        <router-link to="/copy" class="btn-primary">Start a Copy</router-link>
      </div>
      
      <!-- History table -->
      <div v-else>
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-800">Recent Operations</h2>
          <router-link to="/copy" class="btn-primary">New Copy</router-link>
        </div>
        
        <!-- Filter options -->
        <div class="mb-6 p-4 bg-gray-50 rounded-md">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="form-group mb-0">
              <label for="status-filter" class="form-label">Status</label>
              <select
                id="status-filter"
                v-model="filters.status"
                class="form-input"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            
            <div class="form-group mb-0">
              <label for="date-sort" class="form-label">Sort By</label>
              <select
                id="date-sort"
                v-model="filters.sortBy"
                class="form-input"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
            
            <div class="form-group mb-0">
              <label for="limit" class="form-label">Show</label>
              <select
                id="limit"
                v-model="filters.limit"
                class="form-input"
              >
                <option :value="10">10 entries</option>
                <option :value="25">25 entries</option>
                <option :value="50">50 entries</option>
                <option :value="100">100 entries</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Main data table -->
        <div class="overflow-x-auto bg-white rounded-lg shadow">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destination
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Elements
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Element Types
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr 
                v-for="(item, index) in filteredHistory" 
                :key="index" 
                class="hover:bg-gray-50 cursor-pointer"
                @click="viewDetails(item.id)"
              >
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(item.createdAt) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ shortenId(item.sourceAccount) }}</div>
                  <div class="text-sm text-gray-500">{{ shortenId(item.sourceContainer) }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ shortenId(item.destContainer) }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.elementCount }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">
                    {{ formatElementTypes(item.elementTypes) }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="{
                      'bg-green-100 text-green-800': item.status === 'success',
                      'bg-red-100 text-red-800': item.status === 'failed',
                      'bg-yellow-100 text-yellow-800': item.status === 'partial'
                    }"
                  >
                    {{ item.status }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <button 
                    @click.stop="viewDetails(item.id)" 
                    class="text-primary-600 hover:text-primary-900"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-4 flex justify-center">
          <nav class="flex items-center">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
            >
              <span class="sr-only">Previous</span>
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
            
            <div v-for="page in pageNumbers" :key="page" class="relative inline-flex items-center">
              <button
                v-if="page !== '...'"
                @click="goToPage(page)"
                class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
                :class="{ 'text-primary-600 border-primary-500 bg-primary-50': currentPage === page, 'text-gray-700': currentPage !== page }"
              >
                {{ page }}
              </button>
              <span
                v-else
                class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
              >
                ...
              </span>
            </div>
            
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
            >
              <span class="sr-only">Next</span>
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
    
    <!-- Copy Details Modal -->
    <CopyDetails 
      :show="showDetailsModal" 
      :copy-id="selectedCopyId" 
      @close="closeDetailsModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useGtmStore } from '../store/gtm';
import CopyDetails from '../components/CopyDetails.vue';

const gtmStore = useGtmStore();
const selectedCopyId = ref(null);
const showDetailsModal = ref(false);

// State
const loading = ref(false);
const error = ref(null);
const currentPage = ref(1);
const filters = ref({
  status: '',
  sortBy: 'newest',
  limit: 10
});

// Computed properties
const filteredHistory = computed(() => {
  let result = [...gtmStore.copyHistory];
  
  // Apply status filter
  if (filters.value.status) {
    result = result.filter(item => item.status === filters.value.status);
  }
  
  // Apply sorting
  result.sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    
    if (filters.value.sortBy === 'newest') {
      return dateB - dateA;
    } else {
      return dateA - dateB;
    }
  });
  
  // Pagination
  const startIndex = (currentPage.value - 1) * filters.value.limit;
  const endIndex = startIndex + filters.value.limit;
  
  return result.slice(startIndex, endIndex);
});

const totalItems = computed(() => {
  if (!filters.value.status) return gtmStore.copyHistory.length;
  
  return gtmStore.copyHistory.filter(item => item.status === filters.value.status).length;
});

const totalPages = computed(() => {
  return Math.ceil(totalItems.value / filters.value.limit);
});

const pageNumbers = computed(() => {
  const pages = [];
  
  // For smaller page counts, show all pages
  if (totalPages.value <= 7) {
    for (let i = 1; i <= totalPages.value; i++) {
      pages.push(i);
    }
    return pages;
  }
  
  // For larger page counts, show first, last, current, and some surrounding pages
  pages.push(1);
  
  if (currentPage.value > 3) {
    pages.push('...');
  }
  
  const startPage = Math.max(2, currentPage.value - 1);
  const endPage = Math.min(totalPages.value - 1, currentPage.value + 1);
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  if (currentPage.value < totalPages.value - 2) {
    pages.push('...');
  }
  
  if (totalPages.value > 1) {
    pages.push(totalPages.value);
  }
  
  return pages;
});

// Methods
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

function shortenId(id) {
  if (!id) return 'N/A';
  
  // If ID is longer than 10 characters, truncate it
  if (id.length > 10) {
    return `${id.substring(0, 5)}...${id.substring(id.length - 5)}`;
  }
  
  return id;
}

function formatElementTypes(types) {
  if (!types) return 'N/A';
  
  try {
    const parsed = JSON.parse(types);
    return parsed.join(', ');
  } catch (e) {
    return types;
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

function goToPage(page) {
  currentPage.value = page;
}

function viewDetails(id) {
  selectedCopyId.value = id;
  showDetailsModal.value = true;
}

function closeDetailsModal() {
  showDetailsModal.value = false;
}

// Watchers
watch(filters, () => {
  // Reset to first page when filters change
  currentPage.value = 1;
}, { deep: true });

// Initialize component
onMounted(async () => {
  loading.value = true;
  
  try {
    await gtmStore.fetchCopyHistory();
  } catch (err) {
    error.value = `Failed to fetch copy history: ${err.message}`;
  } finally {
    loading.value = false;
  }
});
</script>
