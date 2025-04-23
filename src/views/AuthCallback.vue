<template>
  <div class="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
    <div class="text-center">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Processing Authentication...</h2>
      <div class="animate-spin h-10 w-10 mx-auto text-primary-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <p class="mt-4 text-gray-600">Please wait while we complete your login...</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '../store/auth';
import { useRoute, useRouter } from 'vue-router';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

onMounted(async () => {
  // Check for login status in query parameters
  const loginStatus = route.query.login;
  const errorMessage = route.query.error;
  
  console.log('Auth callback - login status:', loginStatus, 'error:', errorMessage);
  
  if (errorMessage) {
    // Handle error
    authStore.error = decodeURIComponent(errorMessage);
    router.replace('/login');
    return;
  }
  
  if (loginStatus === 'success') {
    try {
      // Get cookies and store token in localStorage for frontend access
      // (Server sets it as httpOnly for security, but frontend needs it too)
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('auth_token='));
      
      if (tokenCookie) {
        const token = tokenCookie.split('=')[1];
        localStorage.setItem('auth_token', token);
      }
      
      // Fetch user info to update the auth store
      await authStore.fetchUserInfo();
      
      // Redirect to the dashboard or saved redirect path
      router.replace(authStore.redirectPath || '/dashboard');
    } catch (error) {
      console.error('Error processing authentication callback:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      router.replace('/login');
    }
  } else {
    // If no success status, redirect to login
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    router.replace('/login');
  }
});
</script>
