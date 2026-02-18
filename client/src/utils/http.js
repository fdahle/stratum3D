/**
 * HTTP client utilities with error handling and retry logic
 */

import { logger } from './logger';
import { createFetchError, retryWithBackoff, ErrorType, AppError } from './errorHandler';
import { getApiUrl } from './config';

/**
 * Default fetch options
 */
const defaultOptions = {
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Enhanced fetch with error handling
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithErrorHandling(url, options = {}) {
  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      throw await createFetchError(response, `Fetch ${url}`);
    }
    
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      error.message || 'Network request failed',
      ErrorType.NETWORK,
      { url, error }
    );
  }
}

/**
 * GET request
 * @param {string} path - API path or full URL
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>}
 */
export async function get(path, options = {}) {
  const url = path.startsWith('http') ? path : getApiUrl(path);
  logger.debug('HTTP', `GET ${url}`);
  
  const response = await fetchWithErrorHandling(url, {
    ...options,
    method: 'GET',
  });
  
  return response.json();
}

/**
 * POST request
 * @param {string} path - API path or full URL
 * @param {any} data - Request body
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>}
 */
export async function post(path, data, options = {}) {
  const url = path.startsWith('http') ? path : getApiUrl(path);
  logger.debug('HTTP', `POST ${url}`);
  
  const response = await fetchWithErrorHandling(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  return response.json();
}

/**
 * Fetch with retry logic
 * @param {string} path - API path or full URL
 * @param {RequestInit} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<any>}
 */
export async function fetchWithRetry(path, options = {}, maxRetries = 3) {
  return retryWithBackoff(
    () => get(path, options),
    maxRetries
  );
}

/**
 * Fetch JSON file
 * @param {string} url - URL to JSON file
 * @returns {Promise<any>}
 */
export async function fetchJSON(url) {
  logger.debug('HTTP', `Fetching JSON: ${url}`);
  const response = await fetchWithErrorHandling(url);
  return response.json();
}

/**
 * Fetch text file
 * @param {string} url - URL to text file
 * @returns {Promise<string>}
 */
export async function fetchText(url) {
  logger.debug('HTTP', `Fetching text: ${url}`);
  const response = await fetchWithErrorHandling(url);
  return response.text();
}

/**
 * Fetch with progress tracking
 * @param {string} url - URL to fetch
 * @param {Function} onProgress - Progress callback (loaded, total)
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchWithProgress(url, onProgress) {
  logger.debug('HTTP', `Fetching with progress: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw await createFetchError(response, `Fetch ${url}`);
  }
  
  const reader = response.body.getReader();
  const contentLength = +response.headers.get('Content-Length');
  
  let receivedLength = 0;
  const chunks = [];
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    chunks.push(value);
    receivedLength += value.length;
    
    if (onProgress && contentLength) {
      onProgress(receivedLength, contentLength);
    }
  }
  
  // Concatenate chunks into single Uint8Array
  const chunksAll = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }
  
  return chunksAll.buffer;
}

/**
 * Check if URL is accessible (HEAD request)
 * @param {string} url - URL to check
 * @returns {Promise<boolean>}
 */
export async function isUrlAccessible(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    logger.warn('HTTP', `URL not accessible: ${url}`, error);
    return false;
  }
}

export default {
  get,
  post,
  fetchJSON,
  fetchText,
  fetchWithProgress,
  fetchWithRetry,
  isUrlAccessible,
};
