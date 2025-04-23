import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { getUser, saveUser, updateUser } from './storageService.js';

// Configure Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// For debugging OAuth issues - don't include this in production
console.log('OAuth client configured with:');
console.log('- Redirect URI:', process.env.GOOGLE_REDIRECT_URI);
console.log('- Client ID (first 5 chars):', process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 5) + '...' : 'undefined');
console.log('- Client Secret is set:', !!process.env.GOOGLE_CLIENT_SECRET);

// Required scopes for Google Tag Manager API
const SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
  'https://www.googleapis.com/auth/tagmanager.publish',
  'https://www.googleapis.com/auth/tagmanager.delete.containers',
  'https://www.googleapis.com/auth/tagmanager.manage.accounts',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Generate OAuth URL for Google authentication
 */
const getAuthUrl = () => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force prompt to ensure we get a refresh token
  });
  
  // Log the generated auth URL (for debugging only)
  console.log('Generated auth URL:', authUrl);
  
  return authUrl;
};

/**
 * Handle Google OAuth callback and save tokens
 * @param {string} code - Authorization code from Google
 * @returns {object} - User info and JWT token
 */
const handleCallback = async (code) => {
  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Save or update tokens in the database
    // Always calculate expiry date from current time, not from the token which can be unreliable
    // Set expiry to 1 hour (3600 seconds) from now if expires_in is not valid
    const expiresInSeconds = (tokens.expires_in && !isNaN(tokens.expires_in)) 
      ? parseInt(tokens.expires_in, 10) 
      : 3600;
    
    // Create a new Date object for now, then add the expiry seconds
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + expiresInSeconds);
    
    // Double-check the date is valid
    if (isNaN(expiryDate.getTime())) {
      console.error('Failed to create valid expiry date, using fixed 1-hour expiry');
      // Create a new Date directly with time offset in milliseconds
      expiryDate = new Date(Date.now() + (3600 * 1000)); // 1 hour fallback
    }
    
    console.log('OAuth tokens received:', {
      access_token: tokens.access_token ? 'Received (truncated)' : 'Missing',
      refresh_token: tokens.refresh_token ? 'Received (truncated)' : 'Missing',
      expires_in: tokens.expires_in,
      calculatedExpiryDate: expiryDate,
      user_id: data.id,
      email: data.email
    });
    
    // Get existing user or create new one
    let user = getUser(data.id);
    
    if (user) {
      // Update existing user
      user = updateUser(data.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || user.refreshToken, // Only update if we got a new refresh token
        expiryDate: expiryDate.toISOString(),
        userEmail: data.email,
        userName: data.name
      });
    } else {
      // Create new user
      user = saveUser({
        id: Date.now().toString(), // Generate a unique ID
        googleUserId: data.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: expiryDate.toISOString(),
        userEmail: data.email,
        userName: data.name
      });
    }

    // Generate JWT token for frontend
    const jwtToken = jwt.sign(
      { 
        id: user.id, 
        googleUserId: user.googleUserId,
        email: user.userEmail 
      }, 
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      user: {
        id: user.id,
        googleUserId: user.googleUserId,
        email: user.userEmail,
        name: user.userName
      },
      token: jwtToken
    };
  } catch (error) {
    console.error('Google callback error:', error);
    throw error;
  }
};

/**
 * Refresh Google access token if expired
 * @param {string} googleUserId - Google user ID
 * @returns {string} - New access token
 */
const refreshAccessToken = async (googleUserId) => {
  try {
    // Get user from local storage
    const user = getUser(googleUserId);

    if (!user) {
      throw new Error('User not found');
    }

    // Set credentials and refresh token
    oauth2Client.setCredentials({
      refresh_token: user.refreshToken
    });

    // Refresh token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update token in storage using the same reliable approach as in handleCallback
    const expiresInSeconds = (credentials.expires_in && !isNaN(credentials.expires_in)) 
      ? parseInt(credentials.expires_in, 10) 
      : 3600;
    
    // Create a new Date object for now, then add the expiry seconds
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + expiresInSeconds);
    
    // Double-check the date is valid
    if (isNaN(expiryDate.getTime())) {
      console.error('Failed to create valid expiry date during refresh, using fixed 1-hour expiry');
      // Create a new Date directly with time offset in milliseconds
      expiryDate = new Date(Date.now() + (3600 * 1000)); // 1 hour fallback
    }
    
    console.log('Token refreshed:', {
      access_token: credentials.access_token ? 'Received (truncated)' : 'Missing',
      expires_in: credentials.expires_in,
      calculatedExpiryDate: expiryDate
    });
    
    // Update user in local storage
    updateUser(googleUserId, {
      accessToken: credentials.access_token,
      expiryDate: expiryDate.toISOString()
    });

    return credentials.access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
};

/**
 * Get authenticated Google API client for a user
 * @param {string} googleUserId - Google user ID
 * @returns {Object} - Authenticated Google client
 */
const getAuthenticatedClient = async (googleUserId) => {
  try {
    // Get user from local storage
    const user = getUser(googleUserId);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if token is expired
    const currentTime = new Date();
    const expiryDate = new Date(user.expiryDate);
    
    if (expiryDate < currentTime) {
      // Refresh the token
      await refreshAccessToken(googleUserId);
      
      // Get updated user data
      const updatedUser = getUser(googleUserId);
      
      // Set credentials with new token
      oauth2Client.setCredentials({
        access_token: updatedUser.accessToken,
        refresh_token: updatedUser.refreshToken
      });
    } else {
      // Set credentials with existing token
      oauth2Client.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken
      });
    }

    return oauth2Client;
  } catch (error) {
    console.error('Get authenticated client error:', error);
    throw error;
  }
};
export {
  getAuthUrl,
  handleCallback,
  refreshAccessToken,
  getAuthenticatedClient
};
