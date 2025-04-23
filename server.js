import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configure CORS - not needed since frontend and backend are now together
app.use(cors({
  origin: '*',
  credentials: true,
}));

// Configure sessions
app.use(session({
  secret: process.env.JWT_SECRET || 'your_jwt_secret_here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }
}));

// API routes setup
const setupRoutes = async () => {
  try {
    const authRoutes = (await import('./routes/auth.js')).default;
    const gtmRoutes = (await import('./routes/gtm.js')).default;
    
    app.use('/api/auth', authRoutes);
    app.use('/api/gtm', gtmRoutes);
  } catch (error) {
    console.error('Error loading routes:', error);
  }
};

// Default route for API health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create Vite server
const setupVite = async () => {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
    configFile: path.resolve(__dirname, 'vite.config.js'),
    root: __dirname,
  });
  
  app.use(vite.middlewares);
  
  // Fallback (handles Vue routes)
  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl;
      // Read the raw index.html
      const templatePath = path.resolve(__dirname, 'index.html');
      let template = await vite.transformIndexHtml(url, await import('fs').then(fs => fs.readFileSync(templatePath, 'utf-8')));
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      if (vite.ssrFixStacktrace) {
        vite.ssrFixStacktrace(e);
      }
      console.error(e);
      res.status(500).end(e.message);
    }
  });
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Since top-level await isn't reliable in all environments, 
// wrap the entire application in an async IIFE
const startServer = async () => {
  // Setup API routes first
  await setupRoutes();
  
  // Then initialize Vite
  await setupVite();
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at: http://localhost:${PORT}/api`);
  });
};

// Execute the async server startup
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});