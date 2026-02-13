import axios from 'axios';

// Create an axios instance with default config
export const api = axios.create({
  baseURL: '',  // No base URL needed since frontend and backend are now together
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for cookies
});

// Intercept responses to handle expired tokens
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If unauthorized and not already retrying
    if (error.response?.status === 401 && 
        error.response?.data?.code === 'TOKEN_EXPIRED' && 
        !originalRequest._retry) {
      
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        await axios.get('/api/auth/refresh', { withCredentials: true });
        
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default {
  // Auth methods
  auth: {
    getUser() {
      return api.get('/api/auth/user');
    },
    logout() {
      return api.post('/api/auth/logout');
    },
    refreshToken() {
      return api.get('/api/auth/refresh');
    }
  },
  
  // GTM methods
  gtm: {
    // Accounts
    getAccounts() {
      return api.get('/api/gtm/accounts');
    },
    
    // Containers
    getContainers(accountId) {
      return api.get(`/api/gtm/accounts/${accountId}/containers`);
    },
    
    // Workspaces
    getWorkspaces(accountId, containerId) {
      return api.get(`/api/gtm/accounts/${accountId}/containers/${containerId}/workspaces`);
    },
    
    // Templates
    getTemplates(accountId, containerId, workspaceId) {
      return api.get(`/api/gtm/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates`);
    },
    
    // Tags
    getTags(accountId, containerId, workspaceId) {
      return api.get(`/api/gtm/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags`);
    },
    
    // Triggers
    getTriggers(accountId, containerId, workspaceId) {
      return api.get(`/api/gtm/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers`);
    },
    
    // Variables
    getVariables(accountId, containerId, workspaceId) {
      return api.get(`/api/gtm/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables`);
    },
    
    // Transformations
    getTransformations(accountId, containerId, workspaceId) {
      return api.get(`/api/gtm/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations`);
    },
    
    // Copy elements
    copyElements(source, targets, elementTypes, selectedElements = null, autoPublish = true) {
      return api.post('/api/gtm/copy', { source, targets, elementTypes, selectedElements, autoPublish });
    },
    
    // History
    getCopyHistory() {
      return api.get('/api/gtm/history');
    },
    
    // Copy details
    getCopyDetails(id) {
      return api.get(`/api/gtm/history/${id}`);
    }
  }
};
