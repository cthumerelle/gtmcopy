<template>
  <div class="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <!-- Logo -->
      <div class="flex justify-center">
        <div class="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        </div>
      </div>
      
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        GTM Copy
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Copy Google Tag Manager elements between containers
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div v-if="authStore.error" class="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
          {{ authStore.error }}
        </div>
        
        <div class="space-y-6">
          <div>
            <p class="text-sm text-gray-700 mb-4">
              GTM Copy enables you to easily copy Google Tag Manager elements (templates, tags, triggers, variables) 
              between containers in your Google Tag Manager accounts.
            </p>
            
            <p class="text-sm text-gray-700 mb-6">
              Sign in with your Google account to get started.
            </p>
          </div>

          <div>
            <button
              type="button"
              @click="login"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              :disabled="authStore.loading"
            >
              <span v-if="authStore.loading" class="mr-2">
                <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
              <span>Sign in with Google</span>
            </button>
          </div>
          
          <div class="mt-6">
            <p class="text-xs text-gray-500 text-center">
              This app requires access to your Google Tag Manager accounts.
              You'll be redirected to Google to authorize this application.
            </p>
          </div>
          
          <!-- Logout button for users stuck in redirect loops -->
          <div class="mt-8 pt-4 border-t border-gray-200">
            <p class="text-xs text-gray-500 mb-2 text-center">Having trouble? Try clearing your session:</p>
            <button
              type="button"
              @click="forceLogout"
              class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Force Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '../store/auth';
import { useRoute } from 'vue-router';

const authStore = useAuthStore();
const route = useRoute();

function login() {
  authStore.login();
}

function forceLogout() {
  // Clear user state and localStorage
  localStorage.removeItem('user');
  localStorage.removeItem('auth_token');
  document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Reset any errors
  authStore.error = null;
  
  // Force page reload to clear any cached state
  window.location.reload();
}

onMounted(() => {
  // Check if there's an error from the OAuth callback
  if (route.query.error) {
    authStore.error = route.query.error;
  }
});
</script>
