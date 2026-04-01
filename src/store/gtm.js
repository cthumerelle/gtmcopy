import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';

export const useGtmStore = defineStore('gtm', () => {
  // State
  const accounts = ref([]);
  const containers = ref([]);
  const workspaces = ref([]);
  const templates = ref([]);
  const tags = ref([]);
  const triggers = ref([]);
  const variables = ref([]);
  const clients = ref([]);
  const transformations = ref([]);
  const copyHistory = ref([]);
  const copyDetails = ref(null);
  const loading = ref(false);
  const error = ref(null);
  
  // Selected items state
  const selectedSource = ref({
    accountId: null,
    containerId: null,
    workspaceId: null,
    workspaceName: null
  });
  
  const selectedTargets = ref([]);
  const selectedElementTypes = ref(['templates', 'tags', 'triggers', 'variables', 'clients', 'transformations']);
  
  // Copy operation state
  const copyStatus = ref({
    inProgress: false,
    completed: false,
    results: null
  });

  const workspaceChanges = ref({
    tags: {},
    triggers: {},
    variables: {},
    templates: {},
    clients: {},
    transformations: {}
  });

  // Load previously selected sources and targets from local storage
  const initializeFromLocalStorage = () => {
    try {
      // Source
      const storedSource = localStorage.getItem('gtmcopy_source');
      if (storedSource) {
        selectedSource.value = JSON.parse(storedSource);
      }
      
      // Targets
      const storedTargets = localStorage.getItem('gtmcopy_targets');
      if (storedTargets) {
        selectedTargets.value = JSON.parse(storedTargets);
      }
      
      // Element types
      const storedElementTypes = localStorage.getItem('gtmcopy_element_types');
      if (storedElementTypes) {
        selectedElementTypes.value = JSON.parse(storedElementTypes);
      }
    } catch (e) {
      console.error('Failed to load GTM selections from local storage:', e);
    }
  };
  
  // Initialize from localStorage
  initializeFromLocalStorage();
  
  // Computed properties
  const hasSourceSelected = computed(() => {
    return selectedSource.value.accountId && 
           selectedSource.value.containerId && 
           selectedSource.value.workspaceId;
  });
  
  const hasTargetsSelected = computed(() => {
    return selectedTargets.value && selectedTargets.value.length > 0;
  });
  
  const hasElementTypesSelected = computed(() => {
    return selectedElementTypes.value && selectedElementTypes.value.length > 0;
  });
  
  const canPerformCopy = computed(() => {
    return hasSourceSelected.value && 
           hasTargetsSelected.value && 
           hasElementTypesSelected.value;
  });
  
  // Actions
  async function fetchAccounts() {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.gtm.getAccounts();
      accounts.value = response.data.accounts;
      loading.value = false;
    } catch (err) {
      console.error('Fetch accounts error:', err);
      error.value = 'Failed to fetch GTM accounts';
      loading.value = false;
    }
  }
  
  async function fetchContainers(accountId) {
    if (!accountId) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.gtm.getContainers(accountId);
      containers.value = response.data.containers;
      loading.value = false;
    } catch (err) {
      console.error('Fetch containers error:', err);
      error.value = 'Failed to fetch GTM containers';
      loading.value = false;
    }
  }
  
  async function fetchWorkspaces(accountId, containerId) {
    if (!accountId || !containerId) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.gtm.getWorkspaces(accountId, containerId);
      workspaces.value = response.data.workspaces;
      loading.value = false;
    } catch (err) {
      console.error('Fetch workspaces error:', err);
      error.value = 'Failed to fetch GTM workspaces';
      loading.value = false;
    }
  }
  
  async function fetchTemplates(accountId, containerId, workspaceId) {
    if (!accountId || !containerId || !workspaceId) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.gtm.getTemplates(accountId, containerId, workspaceId);
      templates.value = response.data.templates || [];
      loading.value = false;
    } catch (err) {
      console.error('Fetch templates error:', err);
      error.value = 'Failed to fetch GTM templates';
      loading.value = false;
    }
  }
  
  async function fetchTags(accountId, containerId, workspaceId) {
    if (!accountId || !containerId || !workspaceId) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.gtm.getTags(accountId, containerId, workspaceId);
      tags.value = response.data.tags || [];
      loading.value = false;
    } catch (err) {
      console.error('Fetch tags error:', err);
      error.value = 'Failed to fetch GTM tags';
      loading.value = false;
    }
  }
  
  async function fetchTriggers(accountId, containerId, workspaceId) {
    if (!accountId || !containerId || !workspaceId) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.gtm.getTriggers(accountId, containerId, workspaceId);
      triggers.value = response.data.triggers || [];
      loading.value = false;
    } catch (err) {
      console.error('Fetch triggers error:', err);
      error.value = 'Failed to fetch GTM triggers';
      loading.value = false;
    }
  }
  
  async function fetchVariables(accountId, containerId, workspaceId) {
    if (!accountId || !containerId || !workspaceId) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.gtm.getVariables(accountId, containerId, workspaceId);
      variables.value = response.data.variables || [];
      loading.value = false;
    } catch (err) {
      console.error('Fetch variables error:', err);
      error.value = 'Failed to fetch GTM variables';
      loading.value = false;
    }
  }
  
  async function fetchTransformations(accountId, containerId, workspaceId) {
    if (!accountId || !containerId || !workspaceId) return;

    loading.value = true;
    error.value = null;

    try {
      const response = await api.gtm.getTransformations(accountId, containerId, workspaceId);
      transformations.value = response.data.transformations || [];
      loading.value = false;
    } catch (err) {
      console.error('Fetch transformations error:', err);
      error.value = 'Failed to fetch GTM transformations';
      loading.value = false;
    }
  }

  async function fetchClients(accountId, containerId, workspaceId) {
    if (!accountId || !containerId || !workspaceId) return;

    loading.value = true;
    error.value = null;

    try {
      const response = await api.gtm.getClients(accountId, containerId, workspaceId);
      clients.value = response.data.clients || [];
      loading.value = false;
    } catch (err) {
      console.error('Fetch clients error:', err);
      // Clients are only available in server-side containers; don't block on error
      clients.value = [];
      loading.value = false;
    }
  }
  
  async function fetchCopyHistory() {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.gtm.getCopyHistory();
      copyHistory.value = response.data.history;
      loading.value = false;
    } catch (err) {
      console.error('Fetch copy history error:', err);
      error.value = 'Failed to fetch copy history';
      loading.value = false;
    }
  }
  
  async function fetchCopyDetails(id) {
    if (!id) return;
    
    loading.value = true;
    error.value = null;
    copyDetails.value = null;
    
    try {
      const response = await api.gtm.getCopyDetails(id);
      copyDetails.value = response.data.details;
      loading.value = false;
      return response.data.details;
    } catch (err) {
      console.error('Fetch copy details error:', err);
      error.value = 'Failed to fetch copy operation details';
      loading.value = false;
    }
  }
  
  async function fetchSourceElements() {
    if (!selectedSource.value.accountId ||
        !selectedSource.value.containerId ||
        !selectedSource.value.workspaceId) {
      return;
    }

    const { accountId, containerId, workspaceId } = selectedSource.value;

    // fetchWorkspaceStatus catches its own errors and never rejects — safe to include in Promise.all
    await Promise.all([
      fetchTemplates(accountId, containerId, workspaceId),
      fetchTags(accountId, containerId, workspaceId),
      fetchTriggers(accountId, containerId, workspaceId),
      fetchVariables(accountId, containerId, workspaceId),
      fetchClients(accountId, containerId, workspaceId),
      fetchTransformations(accountId, containerId, workspaceId),
      fetchWorkspaceStatus(accountId, containerId, workspaceId)
    ]);
  }

  /**
   * Fetches workspace change status and stores it in `workspaceChanges`.
   * Intentionally swallows errors and resets to empty state on failure
   * (suggestions become unavailable but the copy flow is not blocked).
   * Does NOT set the store-level `loading` or `error` refs.
   */
  async function fetchWorkspaceStatus(accountId, containerId, workspaceId) {
    try {
      const response = await api.gtm.getWorkspaceStatus(accountId, containerId, workspaceId);
      workspaceChanges.value = response.data.status;
    } catch (err) {
      console.warn('Could not fetch workspace status, suggestions disabled:', err);
      workspaceChanges.value = { tags: {}, triggers: {}, variables: {}, templates: {}, clients: {}, transformations: {} };
    }
  }

  function setSelectedSource(source) {
    selectedSource.value = source;
    localStorage.setItem('gtmcopy_source', JSON.stringify(source));
  }
  
  function addTarget(target) {
    // Check if target is already selected (prevent duplicates)
    const exists = selectedTargets.value.some(t => 
      t.accountId === target.accountId && 
      t.containerId === target.containerId
    );
    
    if (!exists) {
      selectedTargets.value.push(target);
      localStorage.setItem('gtmcopy_targets', JSON.stringify(selectedTargets.value));
    }
  }
  
  function removeTarget(target) {
    selectedTargets.value = selectedTargets.value.filter(t => 
      !(t.accountId === target.accountId && 
        t.containerId === target.containerId)
    );
    localStorage.setItem('gtmcopy_targets', JSON.stringify(selectedTargets.value));
  }
  
  function clearTargets() {
    selectedTargets.value = [];
    localStorage.setItem('gtmcopy_targets', JSON.stringify(selectedTargets.value));
  }
  
  function setSelectedElementTypes(types) {
    selectedElementTypes.value = types;
    localStorage.setItem('gtmcopy_element_types', JSON.stringify(types));
  }
  
  // Store selected elements
  const selectedElements = ref(null);
  
  function setSelectedElements(elements) {
    selectedElements.value = elements;
    // Don't store in localStorage as it could be a large amount of data
  }
  
  async function performCopy() {
    if (!canPerformCopy.value) {
      error.value = 'Cannot perform copy: Missing required selections';
      return;
    }
    
    loading.value = true;
    error.value = null;
    copyStatus.value = {
      inProgress: true,
      completed: false,
      results: null
    };
    
    try {
      const response = await api.gtm.copyElements(
        selectedSource.value,
        selectedTargets.value,
        selectedElementTypes.value,
        selectedElements.value  // Pass the selected elements
      );
      
      copyStatus.value = {
        inProgress: false,
        completed: true,
        results: response.data.result
      };
      
      loading.value = false;
      return response.data.result;
    } catch (err) {
      console.error('Copy error:', err);
      error.value = 'Failed to copy GTM elements: ' + (err.response?.data?.message || err.message);
      loading.value = false;
      
      copyStatus.value = {
        inProgress: false,
        completed: true,
        results: null,
        error: error.value
      };
    }
  }
  
  function resetCopyStatus() {
    copyStatus.value = {
      inProgress: false,
      completed: false,
      results: null
    };
  }
  
  return {
    // State
    accounts,
    containers,
    workspaces,
    templates,
    tags,
    triggers,
    variables,
    clients,
    transformations,
    copyHistory,
    copyDetails,
    loading,
    error,
    selectedSource,
    selectedTargets,
    selectedElementTypes,
    selectedElements,
    copyStatus,
    workspaceChanges,

    // Computed
    hasSourceSelected,
    hasTargetsSelected,
    hasElementTypesSelected,
    canPerformCopy,

    // Actions
    fetchAccounts,
    fetchContainers,
    fetchWorkspaces,
    fetchTemplates,
    fetchTags,
    fetchTriggers,
    fetchVariables,
    fetchClients,
    fetchTransformations,
    fetchCopyHistory,
    fetchCopyDetails,
    fetchSourceElements,
    fetchWorkspaceStatus,
    setSelectedSource,
    addTarget,
    removeTarget,
    clearTargets,
    setSelectedElementTypes,
    setSelectedElements,
    performCopy,
    resetCopyStatus
  };
});
