// Centralized icon definitions for easy maintenance and consistency

/**
 * Generate SVG markup for a map pin/marker icon
 * @param {string} color - Hex color for the pin
 * @param {number} width - Icon width in pixels
 * @param {number} height - Icon height in pixels
 * @returns {string} SVG markup
 */
export function getMapPinIcon(color, width = 32, height = 32) {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${width}" height="${height}">
    <path fill="${color}" stroke="white" stroke-width="1.5"
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5" fill="white"/>
  </svg>`;
}

/**
 * SVG icon for point geometry type
 */
export const ICON_POINT = `
  <svg viewBox="0 0 24 24" width="16" height="16">
    <circle cx="12" cy="12" r="6" fill="currentColor" />
  </svg>`;

/**
 * SVG icon for line geometry type
 */
export const ICON_LINE = `
  <svg viewBox="0 0 24 24" width="16" height="16">
    <path d="M3 17 L9 7 L15 17 L21 7" stroke="currentColor" stroke-width="2.5" fill="none" />
  </svg>`;

/**
 * SVG icon for polygon geometry type
 */
export const ICON_POLYGON = `
  <svg viewBox="0 0 24 24" width="16" height="16">
    <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" opacity="0.5" />
  </svg>`;

/**
 * SVG icon for close/cancel button
 */
export const ICON_CLOSE = `
  <svg viewBox="0 0 24 24" width="16" height="16">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

/**
 * SVG icon for chevron down (collapse/expand)
 */
export const ICON_CHEVRON_DOWN = `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
  </svg>`;

/**
 * SVG icon for chevron right (collapse/expand)
 */
export const ICON_CHEVRON_RIGHT = `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
  </svg>`;

/**
 * Emoji icons (can be replaced with SVG if needed)
 */
export const EMOJI_ICONS = {
  WARNING: '⚠️',
  SEARCH: '🔍',
  CLOSE: '✕',
  SETTINGS: '⚙️',
  INFO: 'ℹ️',
  CHECK: '✓',
  CROSS: '✗',
};

/**
 * Get appropriate icon for geometry type
 * @param {string} geometryType - 'point', 'line', 'polygon', or 'unknown'
 * @returns {string} Icon identifier
 */
export function getGeometryIcon(geometryType) {
  switch (geometryType) {
    case 'point':
      return 'point';
    case 'line':
      return 'line';
    case 'polygon':
    case 'unknown':
    default:
      return 'polygon';
  }
}
