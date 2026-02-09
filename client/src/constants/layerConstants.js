// Layer processing constants
export const BATCH_SIZE = 2000;
export const PROGRESS_UPDATE_DEBOUNCE = 50;

// Layer z-indexes
export const Z_INDEX = {
  BASE: 0,
  OVERLAY: 100,
  SELECTION: 999,
};

// Layer statuses
export const LAYER_STATUS = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  PROCESSING: 'processing',
  LOADING_DETAILS: 'loading-details',
  READY: 'ready',
  ERROR: 'error',
};

// Layer categories
export const LAYER_CATEGORY = {
  BASE: 'base',
  OVERLAY: 'overlay',
};

// Geometry types
export const GEOMETRY_TYPE = {
  POINT: 'point',
  MULTI_POINT: 'MultiPoint',
  LINE: 'line',
  LINE_STRING: 'LineString',
  MULTI_LINE_STRING: 'MultiLineString',
  POLYGON: 'polygon',
  UNKNOWN: 'unknown',
};

// Map event throttling
export const MAP_POINTER_THROTTLE_MS = 50;

// Search settings
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 300;

// Default values
export const DEFAULT_COLOR = '#3388ff';
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_SELECTION_WIDTH = 5;
export const DEFAULT_TILE_SIZE = 256;
export const DEFAULT_OPACITY = 0.5; // 80 in hex = 0.5
export const DEFAULT_SELECTION_OPACITY = 0.7; // B3 in hex = 0.7
