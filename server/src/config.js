/**
 * Environment configuration for the server
 * Reads from environment variables with sensible defaults
 */

export const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS configuration
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [
        'http://localhost:8080',
        'http://localhost:5173',
        'http://localhost:4173',
      ],

  // Data paths
  dataPath: process.env.DATA_PATH || './data',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Security
  enableHelmet: process.env.ENABLE_HELMET === 'true',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),

  // Upload
  uploadLimitMb: parseInt(process.env.UPLOAD_LIMIT_MB || '500', 10), // per-file limit in MB

  // Admin — password is stored in data/.credentials (set via first-run wizard)
  // No hardcoded password: on first visit the user chooses one.
};

export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';

// Validate critical configuration
if (!config.port || isNaN(config.port)) {
  throw new Error('Invalid PORT configuration');
}

export default config;
