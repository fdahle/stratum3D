/**
 * Environment-aware configuration helper
 * Provides type-safe access to environment variables and build-time constants
 */

/**
 * Get environment variable with type casting
 * @param {string} key - Environment variable key
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Environment variable value
 */
export function getEnvVar(key, defaultValue = null) {
  const value = import.meta.env[key];
  return value !== undefined ? value : defaultValue;
}

/**
 * Get boolean environment variable
 * @param {string} key - Environment variable key
 * @param {boolean} defaultValue - Default value
 * @returns {boolean}
 */
export function getEnvBool(key, defaultValue = false) {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1' || value === true;
}

/**
 * Get number environment variable
 * @param {string} key - Environment variable key
 * @param {number} defaultValue - Default value
 * @returns {number}
 */
export function getEnvNumber(key, defaultValue = 0) {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Application configuration derived from environment
 */
export const appConfig = {
  // Environment
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  
  // Base URL
  baseUrl: import.meta.env.BASE_URL || '/',
  
  // API configuration
  apiUrl: getEnvVar('VITE_API_URL', 'http://localhost:3000'),
  apiTimeout: getEnvNumber('VITE_API_TIMEOUT', 30000),
  
  // Feature flags
  enableDebug: getEnvBool('VITE_ENABLE_DEBUG', false),
  enablePerformanceMonitoring: getEnvBool('VITE_ENABLE_PERFORMANCE', false),
  
  // Build info (can be injected during build)
  version: getEnvVar('VITE_APP_VERSION', 'dev'),
  buildTime: getEnvVar('VITE_BUILD_TIME', new Date().toISOString()),
};

/**
 * Get API endpoint URL
 * @param {string} path - API path
 * @returns {string} Full URL
 */
export function getApiUrl(path) {
  const base = appConfig.apiUrl.replace(/\/$/, '');
  const endpoint = path.replace(/^\//, '');
  return `${base}/${endpoint}`;
}

export default appConfig;
