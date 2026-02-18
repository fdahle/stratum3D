/**
 * Express server for serving geospatial data
 * Provides static file serving with CORS support and proper error handling
 */
import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import config, { isDevelopment } from './config.js';
import logger from './logger.js';

const app = express();

// Convert import.meta.url to __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (config.corsOrigins.includes(origin) || isDevelopment) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging in development
if (isDevelopment) {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Serve static data files
app.use('/data', express.static(path.join(__dirname, config.dataPath), {
  maxAge: isDevelopment ? 0 : '1d', // Cache in production
  etag: true,
  lastModified: true,
}));

// 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Server error:', err.message);
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack }),
  });
});

// Start server
app.listen(config.port, config.host, () => {
  logger.info('================================================');
  logger.info(`Server is running in ${config.nodeEnv} mode`);
  logger.info(`Listening on http://${config.host}:${config.port}`);
  logger.info(`Data directory: ${config.dataPath}`);
  logger.info(`CORS origins: ${config.corsOrigins.join(', ')}`);
  logger.info('================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server gracefully...');
  process.exit(0);
});
