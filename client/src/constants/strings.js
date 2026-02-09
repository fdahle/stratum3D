// Centralized string constants for internationalization (i18n) support
// To add a new language, duplicate this file as strings.de.js, strings.fr.js, etc.

/**
 * Current language - can be set dynamically based on user preference
 * For now, all strings are in English (default)
 */
export const LANGUAGE = 'en';

/**
 * All user-facing text strings
 * Organized by feature/component for easy navigation
 */
export const STRINGS = {
  // General UI
  loading: 'Loading...',
  error: 'Error',
  cancel: 'Cancel',
  close: 'Close',
  retry: 'Retry',
  save: 'Save',
  delete: 'Delete',
  confirm: 'Confirm',
  
  // Configuration
  config: {
    loading: 'Loading Configuration...',
    error: 'Configuration Error',
    notFound: 'Config not found',
    reloadApp: 'Reload App',
  },

  // Map
  map: {
    layers: 'Map Layers',
    baseLayers: 'Base Layers',
    overlayLayers: 'Overlay Layers',
    noLayers: 'No overlay layers loaded.',
  },

  // Layer status
  layer: {
    downloading: 'Downloading',
    processing: 'Processing',
    loadingDetails: 'Loading Details',
    ready: 'Ready',
    error: 'Failed to load layer',
    idle: 'Not loaded',
    dl: 'DL',
    proc: 'Proc',
    load: 'Load',
  },

  // Search
  search: {
    placeholder: 'Search...',
    noResults: 'No matches found',
    searching: 'Searching...',
  },

  // Measurement
  measurement: {
    distance: 'Distance',
    area: 'Area',
    clear: 'Clear All',
    unit: {
      meters: 'm',
      kilometers: 'km',
      squareMeters: 'm²',
      squareKilometers: 'km²',
    },
  },

  // 3D Viewer
  viewer3d: {
    loading: 'Loading 3D Model...',
    loadingProgress: 'Loading',
    reset: 'Reset Camera',
    wireframe: 'Wireframe',
    boundingBox: 'Bounding Box',
    grid: 'Grid',
    measure: 'Measure',
  },

  // Settings
  settings: {
    title: 'Settings',
    theme: 'Theme',
    language: 'Language',
    advanced: 'Advanced',
  },

  // Attribute Panel
  attributes: {
    title: 'Feature Attributes',
    noSelection: 'No feature selected',
    properties: 'Properties',
    showImage: 'Show Image',
    hideImage: 'Hide Image',
  },

  // Information Bar
  info: {
    coordinates: 'Coordinates',
    zoom: 'Zoom',
    crs: 'CRS',
    latitude: 'Lat',
    longitude: 'Lng',
  },

  // Context Menu
  contextMenu: {
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    zoomToFit: 'Zoom to Fit',
    copyCoordinates: 'Copy Coordinates',
    centerHere: 'Center Here',
  },

  // Errors
  errors: {
    loadFailed: 'Failed to load',
    networkError: 'Network error',
    parseError: 'Failed to parse data',
    unknown: 'An unknown error occurred',
  },
};

/**
 * Helper function to get a nested string value
 * Usage: getString('search.placeholder') returns 'Search places, stations...'
 * 
 * @param {string} path - Dot-separated path to string (e.g., 'layer.downloading')
 * @returns {string} The string value or the path if not found
 */
export function getString(path) {
  const keys = path.split('.');
  let value = STRINGS;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      console.warn(`String not found: ${path}`);
      return path; // Return path as fallback
    }
  }
  
  return typeof value === 'string' ? value : path;
}

/**
 * Format a string with parameters
 * Usage: formatString('Loading {0} of {1}', 10, 100) returns 'Loading 10 of 100'
 * 
 * @param {string} template - String with {0}, {1}, etc. placeholders
 * @param {...any} args - Values to replace placeholders
 * @returns {string} Formatted string
 */
export function formatString(template, ...args) {
  return template.replace(/{(\d+)}/g, (match, index) => {
    const argIndex = parseInt(index);
    return args[argIndex] !== undefined ? String(args[argIndex]) : match;
  });
}
