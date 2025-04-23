<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full text-center">
      <div class="mb-6">
        <h1 class="text-9xl font-bold text-primary-600">404</h1>
      </div>
      <h2 class="text-3xl font-extrabold text-gray-900 mb-4">Page Not Found</h2>
      <p class="text-gray-600 mb-8">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <div>
        <router-link to="/dashboard" class="btn-primary">
          Back to Dashboard
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
// No additional logic needed for this view
</script>
