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

// ============================================================
// 3D Viewer SVG Icons
// ============================================================

/** 3D Model (cube) */
export const ICON_3D_MODEL = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;

/** Point cloud (scatter dots) */
export const ICON_POINT_CLOUD = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="4" cy="8" r="1.5"/><circle cx="10" cy="4" r="1.5"/><circle cx="16" cy="6" r="1.5"/><circle cx="7" cy="14" r="1.5"/><circle cx="13" cy="11" r="1.5"/><circle cx="19" cy="13" r="1.5"/><circle cx="5" cy="20" r="1.5"/><circle cx="11" cy="18" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg>`;

/** Camera */
export const ICON_CAMERA = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`;

/** Grid */
export const ICON_GRID = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`;

/** Reset view (circular arrow) */
export const ICON_RESET = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>`;

/** Fit to scene (expand arrows) */
export const ICON_FIT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;

/** Wireframe (cube edges) */
export const ICON_WIREFRAME = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"/><path d="M12 22V11"/><path d="M20 6.5L12 11 4 6.5"/></svg>`;

/** Bounding box */
export const ICON_BBOX = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 2"><rect x="3" y="3" width="18" height="18" rx="1"/></svg>`;

/** Distance measure (ruler) */
export const ICON_DISTANCE = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20L20 2"/><path d="M7 17l2-2"/><path d="M11 13l2-2"/><path d="M15 9l2-2"/><circle cx="3" cy="21" r="1.5" fill="currentColor"/><circle cx="21" cy="3" r="1.5" fill="currentColor"/></svg>`;

/** Area measure */
export const ICON_AREA = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L4 4l16 0 0 16z" fill="currentColor" opacity="0.1"/><path d="M4 20L4 4l16 0 0 16z"/><circle cx="4" cy="4" r="1.5" fill="currentColor"/><circle cx="20" cy="4" r="1.5" fill="currentColor"/><circle cx="20" cy="20" r="1.5" fill="currentColor"/><circle cx="4" cy="20" r="1.5" fill="currentColor"/></svg>`;

/** Top view (eye looking down) */
export const ICON_VIEW_TOP = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="4"/><polygon points="10,1 12,0 14,1" fill="currentColor" stroke="none"/></svg>`;

/** Front view */
export const ICON_VIEW_FRONT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="1"/><circle cx="12" cy="13" r="3"/><line x1="12" y1="3" x2="12" y2="6"/><polygon points="10,3 12,1 14,3" fill="currentColor" stroke="none"/></svg>`;

/** Side view (right) */
export const ICON_VIEW_RIGHT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="14" height="18" rx="1"/><circle cx="13" cy="12" r="3"/><line x1="3" y1="12" x2="6" y2="12"/><polygon points="3,10 1,12 3,14" fill="currentColor" stroke="none"/></svg>`;

/** Eye (visibility on) */
export const ICON_EYE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** Eye off (visibility off) */
export const ICON_EYE_OFF = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

/** Trash / delete */
export const ICON_TRASH = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;

/** Package / generic layer */
export const ICON_PACKAGE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"/><path d="M12 22V11"/><path d="M20 6.5L12 11 4 6.5"/></svg>`;
