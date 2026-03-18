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
 * @param {string} strokeColor - Hex color for stroke, or 'none' to disable
 * @param {string|null} fillColor - Hex color for fill, 'none' to disable, or null to derive from strokeColor
 * @param {number} strokeWidth - Width of the stroke
 * @param {number} opacity - Fill opacity (0-1) used only when fillColor is null
 * @returns {Style} OpenLayers Style object
 */
export function createVectorStyle(
  strokeColor = DEFAULT_COLOR,
  fillColor = null,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  opacity = DEFAULT_OPACITY
) {
  const stroke = (strokeColor && strokeColor !== 'none')
    ? new Stroke({ color: strokeColor, width: strokeWidth })
    : null;

  let fill;
  if (fillColor === 'none') {
    fill = null;
  } else if (fillColor) {
    fill = new Fill({ color: fillColor });
  } else {
    // Derive fill from strokeColor with opacity
    const base = (strokeColor && strokeColor !== 'none') ? strokeColor : DEFAULT_COLOR;
    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    fill = new Fill({ color: base + alphaHex });
  }

  return new Style({ stroke, fill });
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
 * Build a single shared Style for a whole layer.
 * Used as the layer-level style so OL can batch all features in one draw call
 * instead of performing per-feature style lookups on every render.
 *
 * @param {string} baseColor   - Fallback hex color (UI badge color)
 * @param {string|null} strokeColor - 'none' | hex | null (falls back to baseColor)
 * @param {string|null} fillColor   - 'none' | hex | null (derives from strokeColor)
 * @param {string} geomType    - GEOMETRY_TYPE value from the first feature
 * @returns {Style}
 */
export function buildLayerSharedStyle(baseColor, strokeColor, fillColor, geomType) {
  const effectiveStroke = strokeColor || baseColor || DEFAULT_COLOR;
  if (geomType === GEOMETRY_TYPE.POINT || geomType === GEOMETRY_TYPE.MULTI_POINT) {
    const pinColor = effectiveStroke !== 'none' ? effectiveStroke : DEFAULT_COLOR;
    return createPinStyle(pinColor);
  }
  return createVectorStyle(effectiveStroke, fillColor);
}

/**
 * Apply appropriate style to a feature based on its geometry type
 * @param {import('ol/Feature').default} feature - OpenLayers feature
 * @param {string} color - Base/fallback hex color
 * @param {string|null} strokeColor - Override stroke color, or 'none' to disable stroke
 * @param {string|null} fillColor - Override fill color, 'none' to disable fill, or null to derive
 */
export function applyFeatureStyle(feature, color = DEFAULT_COLOR, strokeColor = null, fillColor = null) {
  const geomType = feature.getGeometry().getType();
  const effectiveStroke = strokeColor || color;

  if (geomType === GEOMETRY_TYPE.POINT || geomType === GEOMETRY_TYPE.MULTI_POINT) {
    const pinColor = (effectiveStroke !== 'none') ? effectiveStroke : DEFAULT_COLOR;
    feature.setStyle(createPinStyle(pinColor));
  } else {
    feature.setStyle(createVectorStyle(effectiveStroke, fillColor));
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

/**
 * Build a per-feature style function for a layer that uses group_by colouring.
 * The returned function is called by OL on every render; it reads the current
 * subCategories from the store so colour/visibility changes take effect the
 * next time OL re-renders (triggered by layerInstance.changed()).
 *
 * @param {string} layerId         - Layer ID to look up in the store
 * @param {ReturnType<typeof import('../stores/map/layerStore').useLayerStore>} layerStore
 * @returns {(feature: import('ol/Feature').default) => import('ol/style/Style').default|null}
 */
export function buildGroupByStyleFunction(layerId, layerStore) {
  return (feature) => {
    const layerObj = layerStore.getLayerById(layerId);
    if (!layerObj) return null;

    const val = String(feature.get(layerObj.groupBy) ?? "");
    const group = layerObj.subCategories[val];

    // If sub-categories are not yet initialised (still loading), fall back to the layer colour.
    if (!group) {
      return createVectorStyle(
        layerObj.strokeColor || layerObj.color || DEFAULT_COLOR,
        layerObj.fillColor,
      );
    }

    if (!group.visible) return null;

    return createVectorStyle(group.color, layerObj.fillColor);
  };
}
