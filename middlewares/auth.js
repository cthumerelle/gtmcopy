import jwt from 'jsonwebtoken';
import { getUser } from '../services/storageService.js';

/**
 * Middleware to verify JWT authentication
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie or authorization header
    const token = req.cookies.auth_token || 
                 (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists in local storage
    const user = getUser(decoded.googleUserId);

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    // Check if token is expired and needs refresh
    const currentTime = new Date();
    const expiryDate = new Date(user.expiryDate);
    
    if (expiryDate < currentTime) {
      // Token is handled by the refresh mechanism in the auth service
      // This will be triggered on API calls by the frontend
      return res.status(401).json({ 
        message: 'Unauthorized: Token expired',
        code: 'TOKEN_EXPIRED' 
      });
    }

    // Add user to request object
    req.user = {
      id: user.id,
      googleUserId: user.googleUserId,
      email: user.userEmail,
      name: user.userName
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      message: 'Unauthorized: Invalid token',
      error: error.message 
    });
  }
};

export { authenticate };
