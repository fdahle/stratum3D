// Style factory for consistent OpenLayers styling
import { Style, Stroke, Fill, Icon } from "ol/style";
import { 
  DEFAULT_COLOR, 
  DEFAULT_STROKE_WIDTH, 
  DEFAULT_SELECTION_WIDTH,
  DEFAULT_OPACITY,
  DEFAULT_SELECTION_OPACITY,
  Z_INDEX,
  GEOMETRY_TYPE
} from "../constants/layerConstants";

import { getMapPinIcon } from "../constants/icons";

/**
 * Create a pin/marker style from an SVG
 * @param {string} color - Hex color for the pin
 * @returns {Style} OpenLayers Style object
 */
export function createPinStyle(color = DEFAULT_COLOR) {
  const svg = getMapPinIcon(color);
  const encodedSvg = encodeURIComponent(svg);

  return new Style({
    image: new Icon({
      anchor: [0.5, 1], // Bottom center
      src: `data:image/svg+xml;charset=utf-8,${encodedSvg}`,
      scale: 1,
    }),
  });
}

/**
 * Create a vector style for lines and polygons
 * @param {string} color - Hex color
 * @param {number} strokeWidth - Width of the stroke
 * @param {number} opacity - Fill opacity (0-1)
 * @returns {Style} OpenLayers Style object
 */
export function createVectorStyle(
  color = DEFAULT_COLOR, 
  strokeWidth = DEFAULT_STROKE_WIDTH,
  opacity = DEFAULT_OPACITY
) {
  const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
  
  return new Style({
    stroke: new Stroke({ color, width: strokeWidth }),
    fill: new Fill({ color: color + alphaHex }),
  });
}

/**
 * Create a selection style with complementary color for contrast
 * @param {string} baseColor - Original feature color
 * @param {string} [geomType] - Geometry type string from feature.getGeometry().getType()
 * @returns {Style} OpenLayers Style object for selection
 */
export function createSelectionStyle(baseColor = DEFAULT_COLOR, geomType = '') {
  if (geomType === GEOMETRY_TYPE.POINT || geomType === GEOMETRY_TYPE.MULTI_POINT) {
    const complementaryColor = getComplementaryColor(baseColor);
    const style = createPinStyle(complementaryColor);
    style.setZIndex(Z_INDEX.SELECTION);
    return style;
  }

  const complementaryColor = getComplementaryColor(baseColor);
  const alphaHex = Math.round(DEFAULT_SELECTION_OPACITY * 255).toString(16).padStart(2, '0');
  
  return new Style({
    stroke: new Stroke({ 
      color: complementaryColor,
      width: DEFAULT_SELECTION_WIDTH
    }),
    fill: new Fill({ 
      color: baseColor + alphaHex
    }),
    zIndex: Z_INDEX.SELECTION,
  });
}

/**
 * Apply appropriate style to a feature based on its geometry type
 * @param {import('ol/Feature').default} feature - OpenLayers feature
 * @param {string} color - Hex color to apply
 */
export function applyFeatureStyle(feature, color = DEFAULT_COLOR) {
  const geomType = feature.getGeometry().getType();
  
  if (geomType === GEOMETRY_TYPE.POINT || geomType === GEOMETRY_TYPE.MULTI_POINT) {
    feature.setStyle(createPinStyle(color));
  } else {
    feature.setStyle(createVectorStyle(color));
  }
}

/**
 * Get complementary color for maximum contrast
 * @param {string} hexColor - Hex color (with or without #)
 * @returns {string} Complementary hex color
 */
export function getComplementaryColor(hexColor) {
  // Remove # if present
  const hex = hexColor.replace("#", "");
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate complementary by inverting RGB values
  const compR = (255 - r).toString(16).padStart(2, "0");
  const compG = (255 - g).toString(16).padStart(2, "0");
  const compB = (255 - b).toString(16).padStart(2, "0");
  
  return `#${compR}${compG}${compB}`;
}

/**
 * Create a style function for dynamic selection highlighting
 * @param {Function} getLayerById - Function to retrieve layer by ID
 * @returns {Function} Style function for OpenLayers
 */
export function createSelectionStyleFunction(getLayerById) {
  return (feature) => {
    const layerId = feature.get("_layerId");
    const layerObj = getLayerById(layerId);
    const baseColor = layerObj?.color || DEFAULT_COLOR;
    const geomType = feature.getGeometry().getType();
    
    return createSelectionStyle(baseColor, geomType);
  };
}
