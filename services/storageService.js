/**
 * Local storage service for the GTM Copy application
 * Provides methods to interact with localStorage for user data, history, and settings
 */

// Storage keys
const STORAGE_KEYS = {
  USERS: 'gtm_copy_users',
  COPY_HISTORY: 'gtm_copy_history',
  USER_SETTINGS: 'gtm_copy_settings',
};

// User functions
export const getUsers = () => {
  try {
    const usersData = localStorage.getItem(STORAGE_KEYS.USERS);
    return usersData ? JSON.parse(usersData) : {};
  } catch (error) {
    console.error('Error getting users from localStorage:', error);
    return {};
  }
};

export const getUser = (googleUserId) => {
  const users = getUsers();
  return users[googleUserId];
};

export const saveUser = (userData) => {
  try {
    const users = getUsers();
    users[userData.googleUserId] = userData;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return userData;
  } catch (error) {
    console.error('Error saving user to localStorage:', error);
    return null;
  }
};

export const updateUser = (googleUserId, userData) => {
  try {
    const users = getUsers();
    const existingUser = users[googleUserId];
    
    if (!existingUser) {
      throw new Error('User not found');
    }
    
    // Update user data
    users[googleUserId] = {
      ...existingUser,
      ...userData,
    };
    
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return users[googleUserId];
  } catch (error) {
    console.error('Error updating user in localStorage:', error);
    return null;
  }
};

// Copy history functions
export const getCopyHistory = (googleUserId) => {
  try {
    const historyData = localStorage.getItem(STORAGE_KEYS.COPY_HISTORY);
    const allHistory = historyData ? JSON.parse(historyData) : {};
    
    // Get user-specific history or empty array
    return allHistory[googleUserId] || [];
  } catch (error) {
    console.error('Error getting copy history from localStorage:', error);
    return [];
  }
};

export const addCopyHistory = (googleUserId, historyItem) => {
  try {
    const historyData = localStorage.getItem(STORAGE_KEYS.COPY_HISTORY);
    const allHistory = historyData ? JSON.parse(historyData) : {};
    
    // Get user history or initialize empty array
    const userHistory = allHistory[googleUserId] || [];
    
    // Add new item with ID and timestamp
    const newItem = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...historyItem,
    };
    
    // Add to beginning of array (newest first)
    userHistory.unshift(newItem);
    
    // Update storage
    allHistory[googleUserId] = userHistory;
    localStorage.setItem(STORAGE_KEYS.COPY_HISTORY, JSON.stringify(allHistory));
    
    return newItem;
  } catch (error) {
    console.error('Error adding copy history to localStorage:', error);
    return null;
  }
};

export const getCopyDetail = (googleUserId, copyId) => {
  try {
    const userHistory = getCopyHistory(googleUserId);
    return userHistory.find(item => item.id === copyId);
  } catch (error) {
    console.error('Error getting copy detail from localStorage:', error);
    return null;
  }
};

// User settings functions
export const getUserSettings = (googleUserId) => {
  try {
    const settingsData = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const allSettings = settingsData ? JSON.parse(settingsData) : {};
    
    // Get user-specific settings or empty object
    return allSettings[googleUserId] || {
      defaultSource: null,
      defaultDestinations: [],
      recentDestinations: [],
    };
  } catch (error) {
    console.error('Error getting user settings from localStorage:', error);
    return {
      defaultSource: null,
      defaultDestinations: [],
      recentDestinations: [],
    };
  }
};

export const saveUserSettings = (googleUserId, settings) => {
  try {
    const settingsData = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const allSettings = settingsData ? JSON.parse(settingsData) : {};
    
    // Update user settings
    allSettings[googleUserId] = {
      ...allSettings[googleUserId],
      ...settings,
    };
    
    localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(allSettings));
    return allSettings[googleUserId];
  } catch (error) {
    console.error('Error saving user settings to localStorage:', error);
    return null;
  }
};

// Server-side compatibility for Node.js environment (no localStorage)
if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
  // Create in-memory storage for server-side
  console.log('Using in-memory storage for server-side');
  
  const inMemoryStorage = {
    [STORAGE_KEYS.USERS]: {},
    [STORAGE_KEYS.COPY_HISTORY]: {},
    [STORAGE_KEYS.USER_SETTINGS]: {},
  };
  
  // Mock localStorage for server-side
  global.localStorage = {
    getItem: (key) => {
      return inMemoryStorage[key] ? JSON.stringify(inMemoryStorage[key]) : null;
    },
    setItem: (key, value) => {
      try {
        inMemoryStorage[key] = JSON.parse(value);
      } catch (e) {
        inMemoryStorage[key] = value;
      }
    },
    removeItem: (key) => {
      delete inMemoryStorage[key];
    },
    clear: () => {
      Object.keys(inMemoryStorage).forEach(key => {
        delete inMemoryStorage[key];
      });
    },
  };
}