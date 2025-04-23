<template>
  <nav class="bg-primary-600 text-white shadow-md">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center py-3">
        <!-- Logo and title -->
        <div class="flex items-center space-x-3">
          <router-link to="/dashboard" class="text-white font-bold text-xl flex items-center">
            <span class="mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </span>
            GTM Copy
          </router-link>
        </div>

        <!-- Navigation links -->
        <div class="hidden md:flex items-center space-x-4">
          <router-link 
            to="/dashboard" 
            class="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
            :class="{ 'bg-primary-700': isActive('/dashboard') }"
          >
            Dashboard
          </router-link>
          <router-link 
            to="/copy" 
            class="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
            :class="{ 'bg-primary-700': isActive('/copy') }"
          >
            Copy Elements
          </router-link>
          <router-link 
            to="/history" 
            class="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
            :class="{ 'bg-primary-700': isActive('/history') }"
          >
            History
          </router-link>
        </div>

        <!-- User menu -->
        <div class="flex items-center">
          <div class="relative" ref="userMenuContainer">
            <button 
              @click="toggleUserMenu" 
              class="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary-600 focus:ring-white"
            >
              <span class="sr-only">Open user menu</span>
              <div class="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center">
                <span class="font-medium">{{ userInitials }}</span>
              </div>
            </button>

            <!-- Dropdown menu -->
            <div 
              v-if="isUserMenuOpen" 
              class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
            >
              <div class="px-4 py-2 text-xs text-gray-500">
                Logged in as
              </div>
              <div class="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                {{ user?.email || 'User' }}
              </div>
              <button 
                @click="logout" 
                class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden flex items-center">
          <button 
            @click="toggleMobileMenu" 
            class="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
          >
            <span class="sr-only">Open main menu</span>
            <svg 
              class="h-6 w-6" 
              :class="{ 'hidden': isMobileMenuOpen, 'block': !isMobileMenuOpen }" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg 
              class="h-6 w-6" 
              :class="{ 'block': isMobileMenuOpen, 'hidden': !isMobileMenuOpen }" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile menu -->
      <div 
        v-if="isMobileMenuOpen" 
        class="md:hidden bg-primary-700 rounded-md mt-2 mb-2"
      >
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <router-link 
            to="/dashboard" 
            @click="closeMobileMenu"
            class="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-primary-800"
            :class="{ 'bg-primary-800': isActive('/dashboard') }"
          >
            Dashboard
          </router-link>
          <router-link 
            to="/copy" 
            @click="closeMobileMenu"
            class="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-primary-800"
            :class="{ 'bg-primary-800': isActive('/copy') }"
          >
            Copy Elements
          </router-link>
          <router-link 
            to="/history" 
            @click="closeMobileMenu"
            class="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-primary-800"
            :class="{ 'bg-primary-800': isActive('/history') }"
          >
            History
          </router-link>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../store/auth';

const route = useRoute();
const authStore = useAuthStore();

// User menu state
const isUserMenuOpen = ref(false);
const userMenuContainer = ref(null);

// Mobile menu state
const isMobileMenuOpen = ref(false);

// User information
const user = computed(() => authStore.user);
const userInitials = computed(() => {
  if (!user.value || !user.value.name) return '?';
  
  // Get initials from name
  return user.value.name
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
});

// Check if route is active
function isActive(path) {
  return route.path === path;
}

// Toggle user menu
function toggleUserMenu() {
  isUserMenuOpen.value = !isUserMenuOpen.value;
}

// Toggle mobile menu
function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}

// Close mobile menu
function closeMobileMenu() {
  isMobileMenuOpen.value = false;
}

// Logout user
function logout() {
  authStore.logout();
}

// Close user menu when clicking outside
function handleClickOutside(event) {
  if (userMenuContainer.value && !userMenuContainer.value.contains(event.target)) {
    isUserMenuOpen.value = false;
  }
}

// Add and remove click outside listener
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
