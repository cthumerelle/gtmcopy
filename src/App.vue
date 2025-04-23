<template>
  <div class="min-h-screen flex flex-col">
    <Navbar v-if="isAuthenticated" />
    
    <main class="flex-grow">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    
    <footer class="bg-gray-100 py-4 border-t border-gray-200">
      <div class="container mx-auto px-4 text-center text-gray-500 text-sm">
        <p>GTM Copy &copy; {{ currentYear }}</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, provide, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './store/auth';
import Navbar from './components/Navbar.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Provide auth store to all components
provide('authStore', authStore);

// Current year for copyright
const currentYear = computed(() => new Date().getFullYear());

// Compute authentication status
const isAuthenticated = computed(() => authStore.isAuthenticated);

// Check login callback status on mount
onMounted(() => {
  // Check for login callback
  if (route.path === '/dashboard' && route.query.login === 'success') {
    authStore.handleLoginCallback('success');
  } else if (route.path === '/login' && route.query.error) {
    // Error handling from login
    authStore.error = route.query.error;
  }
});
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
