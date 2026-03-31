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

// ── Runtime admin password ─────────────────────────────────────
// Priority: ADMIN_PASSWORD env var  >  data/.credentials file
const credentialsFilePath = path.join(__dirname, config.dataPath, '.credentials');

let runtimeAdminPassword = config.adminPassword ?? null;

try {
  const stored = (await fs.readFile(credentialsFilePath, 'utf8').catch(() => null))?.trim();
  if (stored && !runtimeAdminPassword) runtimeAdminPassword = stored;
} catch { /* ignore */ }

function getAdminPassword() { return runtimeAdminPassword; }

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
  const pwd = getAdminPassword();
  if (!pwd) {
    return res.status(503).json({ error: 'Admin access not configured. Use the setup wizard to set a password.' });
  }
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Hist Map Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
  const colonIndex = decoded.indexOf(':');
  const password = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : '';
  const expectedBuf = Buffer.from(pwd);
  const actualBuf = Buffer.alloc(expectedBuf.length);
  Buffer.from(password).copy(actualBuf);
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return res.status(403).json({ error: 'Invalid credentials' });
  }
  next();
}

// Setup status — public, tells the client what first-run steps remain
app.get('/admin/setup-status', async (req, res) => {
  const hasPassword = !!getAdminPassword();
  let hasConfig = false;
  try { await fs.access(configFilePath); hasConfig = true; } catch { /* no config */ }
  res.json({ hasPassword, hasConfig });
});

// Set admin password — only usable during initial setup (no password configured yet)
app.post('/admin/set-password', express.json(), async (req, res) => {
  if (getAdminPassword()) {
    return res.status(409).json({ error: 'Admin password is already configured.' });
  }
  const { password } = req.body ?? {};
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    await fs.writeFile(credentialsFilePath, password, { mode: 0o600 });
    runtimeAdminPassword = password;
    logger.info('Admin password set via setup wizard');
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to save credentials:', err.message);
    res.status(500).json({ error: 'Failed to save password.' });
  }
});

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
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'No configuration found. Use the admin panel to create one.' });
    }
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

// Delete the app config (admin only) — triggers first-run setup on next visit
app.delete('/config', requireAdminAuth, async (req, res) => {
  try {
    await fs.unlink(configFilePath);
    logger.info('Config deleted via admin API');
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'No config file to delete.' });
    logger.error('Failed to delete config file:', err.message);
    res.status(500).json({ error: 'Failed to delete configuration' });
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

// Manually assign 3D assets to specific features by feature ID (admin only)
app.post('/admin/manual-link', requireAdminAuth, async (req, res) => {
  const { filename, assignments } = req.body ?? {};

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'filename is required.' });
  }
  if (!filename.endsWith('.geojson')) {
    return res.status(400).json({ error: 'Only .geojson files can be linked.' });
  }
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
    return res.status(400).json({ error: 'assignments must be a plain object.' });
  }

  // Validate that every asset URL is under an allowed data directory
  const allowedPrefixes = ['data/3D/', 'data/pointclouds/'];
  for (const assign of Object.values(assignments)) {
    for (const url of [...(assign.models ?? []), ...(assign.pointclouds ?? [])]) {
      if (typeof url !== 'string' || !allowedPrefixes.some(p => url.startsWith(p))) {
        return res.status(400).json({ error: `Invalid asset URL: ${url}` });
      }
      // Prevent path traversal
      const rel = url.slice('data/'.length);
      if (rel.includes('..') || rel.includes('//') || path.isAbsolute(rel)) {
        return res.status(400).json({ error: `Invalid asset URL: ${url}` });
      }
    }
  }

  const safe = path.basename(filename);
  const filePath = path.join(dataDir, 'shapes', safe);

  let geojson;
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    geojson = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found.' });
    return res.status(400).json({ error: 'Could not parse GeoJSON.' });
  }

  let linkedCount = 0;
  geojson.features = geojson.features.map((feature) => {
    if (!feature.properties) feature.properties = {};
    const fid = feature.properties._featureId;
    if (fid && Object.prototype.hasOwnProperty.call(assignments, fid)) {
      const assign = assignments[fid];
      feature.properties._model3dUrls   = Array.isArray(assign.models)      ? assign.models      : [];
      feature.properties._pointcloudUrls = Array.isArray(assign.pointclouds) ? assign.pointclouds : [];
      if (feature.properties._model3dUrls.length + feature.properties._pointcloudUrls.length > 0) {
        linkedCount++;
      }
    }
    return feature;
  });

  await fs.writeFile(filePath, JSON.stringify(geojson), 'utf8');
  logger.info(`Manual link: ${safe} — ${linkedCount} feature(s) with assets`);
  res.json({ success: true, filename: safe, linkedCount });
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

// Delete all uploaded data files (admin only) — keeps directory structure intact
app.delete('/admin/uploads', requireAdminAuth, async (req, res) => {
  const subdirs = ['shapes', 'geotiffs', '3D', 'pointclouds'];
  let deleted = 0;
  for (const sub of subdirs) {
    const dir = path.join(dataDir, sub);
    const files = await fs.readdir(dir).catch(() => []);
    for (const file of files) {
      if (file.startsWith('.')) continue;
      await fs.unlink(path.join(dir, file)).catch(() => {});
      deleted++;
    }
  }
  logger.info(`Admin deleted all uploaded files: ${deleted} file(s) removed`);
  res.json({ success: true, deleted });
});

// Delete a single uploaded file (admin only)
app.delete('/admin/uploads/:category/:filename', requireAdminAuth, async (req, res) => {
  const CATEGORY_DIRS = { shapes: 'shapes', geotiffs: 'geotiffs', models: '3D', pointclouds: 'pointclouds' };
  const { category, filename } = req.params;

  const subdir = CATEGORY_DIRS[category];
  if (!subdir) return res.status(400).json({ error: 'Invalid category.' });

  // Reject filenames containing path separators to prevent traversal
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  const resolved = path.resolve(dataDir, subdir, filename);
  const allowed  = path.resolve(dataDir, subdir) + path.sep;
  if (!resolved.startsWith(allowed)) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  try {
    await fs.unlink(resolved);
    logger.info(`Admin deleted file: ${category}/${filename}`);
    res.json({ success: true, deleted: filename });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found.' });
    logger.error('Delete file error:', err);
    res.status(500).json({ error: 'Failed to delete file.' });
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
