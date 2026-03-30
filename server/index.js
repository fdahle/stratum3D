/**
 * Express server for serving geospatial data
 * Provides static file serving with CORS support and proper error handling
 */
import 'dotenv/config';   // loads server/.env before anything else
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import cors from 'cors';
import compression from 'compression';
import yaml from 'js-yaml';
import multer from 'multer';
import { fileURLToPath } from 'url';
import config, { isDevelopment } from './config.js';
import logger from './logger.js';
import { processBatchUpload, relinkGeojson } from './processors/uploadProcessor.js';

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
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(compression());        // gzip/deflate — shrinks large GeoJSON responses ~85-90%
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

// Path to the config file served to clients
const configFilePath = path.join(__dirname, config.dataPath, 'config.yaml');

// Admin authentication middleware (HTTP Basic Auth, timing-safe)
function requireAdminAuth(req, res, next) {
  if (!config.adminPassword) {
    return res.status(503).json({ error: 'Admin access not configured. Set ADMIN_PASSWORD environment variable.' });
  }
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Hist Map Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
  const colonIndex = decoded.indexOf(':');
  const password = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : '';
  const expectedBuf = Buffer.from(config.adminPassword);
  const actualBuf = Buffer.alloc(expectedBuf.length);
  Buffer.from(password).copy(actualBuf);
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return res.status(403).json({ error: 'Invalid credentials' });
  }
  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Serve the app config (read by the client on startup)
app.get('/config', async (req, res) => {
  try {
    const yamlText = await fs.readFile(configFilePath, 'utf8');
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.send(yamlText);
  } catch (err) {
    logger.error('Failed to read config file:', err.message);
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

// Update the app config (admin only)
app.put('/config', requireAdminAuth, express.text({ type: 'text/yaml', limit: '256kb' }), async (req, res) => {
  try {
    // Validate it is parseable YAML before writing
    yaml.load(req.body);
    await fs.writeFile(configFilePath, req.body, 'utf8');
    logger.info('Config updated via admin API');
    res.json({ success: true });
  } catch (err) {
    if (err.name === 'YAMLException') {
      return res.status(400).json({ error: `Invalid YAML: ${err.message}` });
    }
    logger.error('Failed to write config file:', err.message);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// Upload data files (admin only)
const dataDir = path.join(__dirname, config.dataPath);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.geojson', '.json', '.tif', '.tiff', '.obj', '.ply', '.stl', '.las', '.laz', '.mtl',
                     '.jpg', '.jpeg', '.png', '.bmp', '.tga', '.webp'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}`));
  },
});

function runUploadMiddleware(req, res, next) {
  upload.array('files', 30)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

app.post('/admin/upload', requireAdminAuth, runUploadMiddleware, async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files provided.' });
  try {
    const results = await processBatchUpload(req.files, dataDir, __dirname);
    for (const r of results) logger.info(`Upload processed: ${r.dataPath} (${r.type})`);
    res.json(results);
  } catch (err) {
    logger.error('Upload processing error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Re-link a GeoJSON file against currently stored 3D/pointcloud assets (admin only)
app.post('/admin/relink', requireAdminAuth, async (req, res) => {
  const { filename } = req.body;
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'filename is required.' });
  }
  if (!filename.endsWith('.geojson')) {
    return res.status(400).json({ error: 'Only .geojson files can be re-linked.' });
  }
  try {
    const result = await relinkGeojson(filename, dataDir);
    logger.info(`Re-linked ${result.filename}: ${result.linkedCount} feature(s) linked`);
    res.json(result);
  } catch (err) {
    logger.error('Re-link error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// List uploaded data files (admin only)
app.get('/admin/uploads', requireAdminAuth, async (req, res) => {
  try {
    const [shapes, geotiffs, models, pointclouds] = await Promise.all([
      fs.readdir(path.join(dataDir, 'shapes')).catch(() => []),
      fs.readdir(path.join(dataDir, 'geotiffs')).catch(() => []),
      fs.readdir(path.join(dataDir, '3D')).catch(() => []),
      fs.readdir(path.join(dataDir, 'pointclouds')).catch(() => []),
    ]);
    res.json({
      shapes:      shapes.filter(f => f.endsWith('.geojson')).map(f => ({ filename: f, dataPath: `data/shapes/${f}`,      type: 'geojson'    })),
      geotiffs:    geotiffs.filter(f => /\.tiff?$/i.test(f)).map(f => ({ filename: f, dataPath: `data/geotiffs/${f}`,    type: 'geotiff'    })),
      models:      models.filter(f => /\.(obj|ply|stl)$/i.test(f)).map(f => ({ filename: f, dataPath: `data/3D/${f}`,         type: 'model'      })),
      pointclouds: pointclouds.filter(f => /\.(las|laz)$/i.test(f)).map(f => ({ filename: f, dataPath: `data/pointclouds/${f}`, type: 'pointcloud' })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
