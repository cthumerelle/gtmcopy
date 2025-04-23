import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import router from '../router';
import { api } from '../services/api';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null);
  const redirectPath = ref('/dashboard');
  const loading = ref(false);
  const error = ref(null);

  // Get user info from local storage if available
  const storedUser = localStorage.getItem('user');
  const storedToken = localStorage.getItem('auth_token');
  
  if (storedUser && storedToken) {
    try {
      user.value = JSON.parse(storedUser);
      // Setup token expiration check
      const tokenParts = storedToken.split('.');
      if (tokenParts.length === 3) {
        try {
          const payload = JSON.parse(atob(tokenParts[1]));
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            // Token is expired, clear it
            console.log('Token expired, clearing authentication');
            user.value = null;
            localStorage.removeItem('user');
            localStorage.removeItem('auth_token');
          }
        } catch (e) {
          console.error('Failed to parse JWT token:', e);
          user.value = null;
          localStorage.removeItem('user');
          localStorage.removeItem('auth_token');
        }
      }
    } catch (e) {
      console.error('Failed to parse stored user:', e);
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
    }
  } else {
    // If either the user or token is missing, clear both
    user.value = null;
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
  }

  // Computed properties
  const isAuthenticated = computed(() => !!user.value);

  // Actions
  function setRedirectPath(path) {
    redirectPath.value = path;
  }

  async function login() {
    loading.value = true;
    error.value = null;
    
    try {
      // Redirect to Google OAuth login
      window.location.href = '/api/auth/google';
    } catch (err) {
      console.error('Login error:', err);
      error.value = 'Authentication failed. Please try again.';
      loading.value = false;
    }
  }

  async function handleLoginCallback(loginStatus) {
    if (loginStatus === 'success') {
      await fetchUserInfo();
      router.push(redirectPath.value);
    } else {
      error.value = 'Authentication failed. Please try again.';
      loading.value = false;
    }
  }

  async function fetchUserInfo() {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.get('/api/auth/user');
      user.value = response.data.user;
      
      // Store user in localStorage for persistence
      localStorage.setItem('user', JSON.stringify(user.value));
      
      loading.value = false;
      return user.value;
    } catch (err) {
      console.error('Fetch user info error:', err);
      error.value = 'Failed to fetch user information';
      loading.value = false;
      
      // If unauthorized, clear user and redirect to login
      if (err.response && err.response.status === 401) {
        logout();
      }
    }
  }

  async function logout() {
    try {
      // Call logout API endpoint
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear user state and localStorage regardless of API response
      user.value = null;
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      router.push('/login');
    }
  }

  async function refreshToken() {
    try {
      await api.get('/api/auth/refresh');
      return true;
    } catch (err) {
      console.error('Token refresh error:', err);
      // If refresh fails, logout
      logout();
      return false;
    }
  }

  return {
    user,
    redirectPath,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
    fetchUserInfo,
    setRedirectPath,
    handleLoginCallback,
    refreshToken
  };
});
