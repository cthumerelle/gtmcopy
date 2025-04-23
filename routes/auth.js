import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middlewares/auth.js';
import * as googleAuth from '../services/googleAuth.js';

const router = express.Router();

/**
 * @route   GET /api/auth/google
 * @desc    Redirect to Google OAuth login
 * @access  Public
 */
router.get('/google', (req, res) => {
  try {
    const authUrl = googleAuth.getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('Google auth redirect error:', error);
    res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
});

/**
 * @route   GET /api/auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code missing' });
    }
    
    // Exchange code for tokens
    const authData = await googleAuth.handleCallback(code);
    
    // Set cookie with JWT token
    res.cookie('auth_token', authData.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });
    
    // Redirect to frontend callback with successful login
    res.redirect(`/auth/callback?login=success`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`/auth/callback?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * @route   GET /api/auth/refresh
 * @desc    Refresh access token
 * @access  Private
 */
router.get('/refresh', authenticate, async (req, res) => {
  try {
    const googleUserId = req.user.googleUserId;
    
    // Refresh Google token
    const newAccessToken = await googleAuth.refreshAccessToken(googleUserId);
    
    // Generate new JWT token
    const token = jwt.sign(
      { 
        id: req.user.id, 
        googleUserId: req.user.googleUserId,
        email: req.user.email 
      }, 
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Set new cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });
    
    res.status(200).json({ message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: 'Failed to refresh token', error: error.message });
  }
});

/**
 * @route   GET /api/auth/user
 * @desc    Get current user info
 * @access  Private
 */
router.get('/user', authenticate, (req, res) => {
  try {
    res.status(200).json({
      user: {
        id: req.user.id,
        googleUserId: req.user.googleUserId,
        email: req.user.email,
        name: req.user.name
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user info', error: error.message });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', (req, res) => {
  try {
    // Clear auth cookie
    res.clearCookie('auth_token');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed', error: error.message });
  }
});

export default router;
