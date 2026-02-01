// src/constants/configSchema.js

export const CONFIG_SCHEMA = {
  view: {
    required: ["center", "zoom"],
    types: { center: "array", zoom: "number" }
  },
  crs: {
    required: true,
    type: "string"
  },
  layerTypes: {
    tile: {
      required: ["url", "attribution"],
    },
    wmts: {
      required: ["url", "layer", "matrixSet", "format", "attribution"],
    },
    wms: {
      required: ["url", "layers", "format", "attribution"],
    },
    geojson: {
      required: ["url", "color"],
    }
  }
};