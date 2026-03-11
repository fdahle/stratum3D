/**
 * Performance monitoring utilities
 * Helps identify performance bottlenecks and optimize code
 */

import { logger } from './logger';

/**
 * Performance metrics storage
 */
const metrics = new Map();

/**
 * Measure execution time of a function
 * @param {string} label - Metric label
 * @param {Function} fn - Function to measure
 * @returns {Promise<any>} Result of the function
 */
export async function measure(label, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    recordMetric(label, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(`${label} (error)`, duration);
    throw error;
  }
}

/**
 * Record a performance metric
 * @param {string} label - Metric label
 * @param {number} value - Metric value (typically time in ms)
 */
export function recordMetric(label, value) {
  if (!metrics.has(label)) {
    metrics.set(label, []);
  }
  metrics.get(label).push(value);
  
  if (import.meta.env.DEV) {
    logger.debug('Performance', `${label}: ${value.toFixed(2)}ms`);
  }
}

/**
 * Get statistics for a metric
 * @param {string} label - Metric label
 * @returns {Object|null} Statistics object or null if no data
 */
export function getMetricStats(label) {
  const values = metrics.get(label);
  if (!values || values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  
  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / values.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
  };
}

/**
 * Get all collected metrics
 * @returns {Map} All metrics
 */
export function getAllMetrics() {
  const stats = {};
  for (const [label, values] of metrics.entries()) {
    stats[label] = getMetricStats(label);
  }
  return stats;
}

/**
 * Clear all metrics
 */
export function clearMetrics() {
  metrics.clear();
}

/**
 * Create a performance observer for specific entry types
 * @param {string[]} entryTypes - Entry types to observe (e.g., ['measure', 'navigation'])
 * @param {Function} callback - Callback to handle performance entries
 * @returns {PerformanceObserver} The observer instance
 */
export function createPerformanceObserver(entryTypes, callback) {
  if (typeof PerformanceObserver === 'undefined') {
    logger.warn('Performance', 'PerformanceObserver not supported');
    return null;
  }
  
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      callback(entry);
    }
  });
  
  observer.observe({ entryTypes });
  return observer;
}


