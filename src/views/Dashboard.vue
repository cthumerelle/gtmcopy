<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
    
    <div v-if="authStore.loading" class="flex justify-center my-12">
      <div class="animate-spin h-10 w-10 text-primary-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>

    <div v-else>
      <!-- Welcome section -->
      <div class="card mb-8">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-xl font-semibold text-gray-800">Welcome, {{ user?.name || 'User' }}!</h2>
            <p class="text-gray-600 mt-1">Use GTM Copy to efficiently manage your Google Tag Manager elements.</p>
          </div>
          <div class="mt-4 md:mt-0">
            <router-link to="/copy" class="btn-primary">Start Copy Process</router-link>
          </div>
        </div>
      </div>
      
      <!-- Quick actions -->
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <!-- Copy elements card -->
        <div class="card hover:shadow-lg transition-shadow">
          <div class="flex justify-center mb-4 text-primary-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2 text-center">Copy Elements</h3>
          <p class="text-gray-600 text-sm text-center mb-4">
            Copy templates, tags, triggers, and variables between GTM containers.
          </p>
          <div class="flex justify-center">
            <router-link to="/copy" class="btn-primary">Start Copy</router-link>
          </div>
        </div>
        
        <!-- View history card -->
        <div class="card hover:shadow-lg transition-shadow">
          <div class="flex justify-center mb-4 text-primary-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2 text-center">Copy History</h3>
          <p class="text-gray-600 text-sm text-center mb-4">
            View your past copy operations and their results.
          </p>
          <div class="flex justify-center">
            <router-link to="/history" class="btn-primary">View History</router-link>
          </div>
        </div>
        
        <!-- GTM accounts card -->
        <div 
          class="card hover:shadow-lg transition-shadow cursor-pointer"
          @click="fetchAndShowAccounts"
        >
          <div class="flex justify-center mb-4 text-primary-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2 text-center">GTM Accounts</h3>
          <p class="text-gray-600 text-sm text-center mb-4">
            View your accessible Google Tag Manager accounts.
          </p>
          <div class="flex justify-center">
            <button @click="fetchAndShowAccounts" class="btn-primary">View Accounts</button>
          </div>
        </div>
      </div>

      <!-- GTM Accounts section (conditionally shown) -->
      <div v-if="showAccounts" class="mb-8">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Your GTM Accounts</h2>
        
        <div v-if="gtmStore.loading" class="flex justify-center my-6">
          <div class="animate-spin h-6 w-6 text-primary-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
        
        <div v-else-if="gtmStore.accounts.length === 0" class="card bg-gray-50">
          <p class="text-gray-600 text-center">No GTM accounts found. Make sure you have proper access permissions.</p>
        </div>
        
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account ID</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="account in gtmStore.accounts" :key="account.accountId">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ account.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ account.accountId }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <router-link
                    :to="`/copy?accountId=${account.accountId}`" 
                    class="text-primary-600 hover:text-primary-900"
                  >
                    Start Copy
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Recent copy history -->
      <div v-if="gtmStore.copyHistory.length > 0" class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-800">Recent Copy Operations</h2>
          <router-link to="/history" class="text-primary-600 hover:text-primary-900 text-sm">View All</router-link>
        </div>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Elements</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="(item, index) in recentHistory" :key="index">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(item.createdAt) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ shortenId(item.sourceContainer) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ shortenId(item.destContainer) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.elementCount }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="{
                      'bg-green-100 text-green-800': item.status === 'success',
                      'bg-red-100 text-red-800': item.status === 'failed',
                      'bg-yellow-100 text-yellow-800': item.status === 'partial'
                    }"
                  >
                    {{ item.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../store/auth';
import { useGtmStore } from '../store/gtm';

const authStore = useAuthStore();
const gtmStore = useGtmStore();

// User data
const user = computed(() => authStore.user);

// Control display of GTM accounts
const showAccounts = ref(false);

// Computed for recent history
const recentHistory = computed(() => {
  return gtmStore.copyHistory.slice(0, 5);
});

// Format date helper
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

// Shorten container ID for display
function shortenId(id) {
  if (!id) return 'N/A';
  
  // If ID is longer than 10 characters, truncate it
  if (id.length > 10) {
    return `${id.substring(0, 5)}...${id.substring(id.length - 5)}`;
  }
  
  return id;
}

// Fetch GTM accounts and show them
async function fetchAndShowAccounts() {
  if (gtmStore.accounts.length === 0) {
    await gtmStore.fetchAccounts();
  }
  
  showAccounts.value = true;
}

// On mount, fetch copy history for the dashboard
onMounted(async () => {
  await gtmStore.fetchCopyHistory();
});
</script>
