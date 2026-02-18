/**
 * Centralized error handling utilities
 */

import { logger } from './logger';

/**
 * Standard error types for the application
 */
export const ErrorType = {
  NETWORK: 'NETWORK_ERROR',
  CONFIG: 'CONFIG_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  LOADING: 'LOADING_ERROR',
  PARSING: 'PARSING_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNKNOWN: 'UNKNOWN_ERROR',
};

/**
 * Application error class with additional context
 */
export class AppError extends Error {
  constructor(message, type = ErrorType.UNKNOWN, details = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    const messages = {
      [ErrorType.NETWORK]: 'Network connection error. Please check your connection.',
      [ErrorType.CONFIG]: 'Configuration error. Please check your settings.',
      [ErrorType.VALIDATION]: 'Invalid data. Please review your input.',
      [ErrorType.LOADING]: 'Failed to load resource.',
      [ErrorType.PARSING]: 'Failed to parse data.',
      [ErrorType.NOT_FOUND]: 'Resource not found.',
      [ErrorType.UNKNOWN]: 'An unexpected error occurred.',
    };
    return messages[this.type] || this.message;
  }
}

/**
 * Handle errors consistently throughout the app
 * @param {Error} error - The error to handle
 * @param {string} context - Where the error occurred
 * @param {boolean} showToUser - Whether to show a user-facing message
 * @returns {AppError} Normalized error
 */
export function handleError(error, context = 'Unknown', showToUser = false) {
  // Convert to AppError if needed
  const appError = error instanceof AppError
    ? error
    : new AppError(error.message, ErrorType.UNKNOWN, { originalError: error });

  // Log the error
  logger.error(context, appError.message, appError.details);

  // Could dispatch to error tracking service here (Sentry, etc.)
  if (import.meta.env.PROD) {
    // trackError(appError);
  }

  return appError;
}

/**
 * Wrap async functions with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error messages
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error, context);
    }
  };
}

/**
 * Create an error from a fetch response
 * @param {Response} response - Fetch response
 * @param {string} context - Context information
 * @returns {AppError}
 */
export async function createFetchError(response, context = 'Fetch') {
  let details = { status: response.status, statusText: response.statusText };
  
  try {
    const text = await response.text();
    if (text) details.body = text;
  } catch (e) {
    // Ignore parsing errors
  }

  const type = response.status === 404 ? ErrorType.NOT_FOUND : ErrorType.NETWORK;
  return new AppError(
    `${context} failed: ${response.status} ${response.statusText}`,
    type,
    details
  );
}

/**
 * Retry an async operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        logger.warn('Retry', `Attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
