// client/src/stores/layerStore.js
import { defineStore } from "pinia";
import { markRaw, ref, computed } from "vue";

// Simple debounce implementation
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export const useLayerStore = defineStore("layers", () => {
  const layers = ref([]);
  
  // Index for O(1) layer lookups by ID
  const layerIndex = new Map();

  // --- ACTIONS ---

  /**
   * @param {object} opts
   * @param {string}        opts.layerId
   * @param {string}        opts.name
   * @param {object|null}   opts.layerInstance   - OL layer (null for deferred geojson)
   * @param {string}        opts.type            - "tile" | "wms" | "wmts" | "geojson"
   * @param {string}        opts.category        - "base" | "overlay"
   * @param {boolean}       opts.visible
   * @param {string}        [opts.geometryType]  - "point" | "line" | "polygon" | "unknown"
   * @param {string}        [opts.color]
   * @param {string|null}   [opts.url]
   * @param {string[]}      [opts.searchFields]
   */
  const addLayer = ({
    layerId,
    name,
    layerInstance,
    type,
    category,
    visible,
    geometryType = "unknown",
    color = "#3388ff",
    url = null,
    searchFields = [],
  }) => {
    if (layers.value.some((l) => l._layerId === layerId)) return;

    let initialStatus = "ready";
    if (type === "geojson" && !layerInstance) {
      initialStatus = "idle";
    }

    // Set z-index based on category
    const zIndex = category === "base" ? 0 : 100;

    if (layerInstance) {
      layerInstance.setZIndex(zIndex);
    }

    const layerObj = {
      _layerId: layerId,
      name,
      type,
      category,
      active: visible,
      layerInstance: layerInstance ? markRaw(layerInstance) : null,
      geometryType,
      color,
      url,
      progress: 0,
      status: initialStatus,
      error: null,
      zIndex,
      searchFields,
    };
    layers.value.push(layerObj);
    // Index must point to the reactive proxy that Vue created, not the raw object.
    // The proxy is the last element after push.
    layerIndex.set(layerId, layers.value[layers.value.length - 1]);
  };

  const reset = () => {
    layers.value = [];
    layerIndex.clear();
  };

  // O(1) lookup helper
  const getLayerById = (layerId) => layerIndex.get(layerId);

  const debouncedProgressUpdates = new Map();
  
  const setLayerProgress = (layerId, progress) => {
    const layer = layerIndex.get(layerId);
    if (!layer) return;

    if (progress === 100) {
      layer.progress = progress;
      return;
    }

    if (!debouncedProgressUpdates.has(layerId)) {
      debouncedProgressUpdates.set(
        layerId,
        debounce((prog) => {
          const l = layerIndex.get(layerId);
          if (l) l.progress = prog;
        }, 50)
      );
    }

    debouncedProgressUpdates.get(layerId)(progress);
  };

  const setLayerStatus = (layerId, status) => {
    const layer = layerIndex.get(layerId);
    if (layer) layer.status = status;
  };

  const setLayerError = (layerId, errorMessage) => {
    const layer = layerIndex.get(layerId);
    if (layer) {
      layer.error = errorMessage;
      layer.status = "error";
      layer.progress = 0;
    }
  };

  const retryLayer = (layerId) => {
    const layer = layerIndex.get(layerId);
    if (layer && layer.status === 'error') {
      layer.status = 'idle';
      layer.error = null;
      layer.progress = 0;
      layer.active = true;
    }
  };

  // Callback registered by useLayerManager so the store can reach the worker.
  // The composable sets this once; the store calls it on cancel.
  let _onCancelLayer = null;
  const registerCancelHandler = (handler) => { _onCancelLayer = handler; };

  const cancelLayerLoad = (layerId) => {
    const layer = layerIndex.get(layerId);
    if (layer && ['downloading', 'processing', 'loading-details'].includes(layer.status)) {
      // 1. Terminate the worker (via the composable's handler)
      if (_onCancelLayer) _onCancelLayer(layerId);
      // 2. Reset state
      layer.status = 'idle';
      layer.progress = 0;
      layer.active = false;
    }
  };

  // UPDATED: Toggle Logic - ONLY changes visibility, doesn't add/remove from map
  const toggleLayer = async (layerId) => {
    const layer = layerIndex.get(layerId);

    if (
      !layer ||
      layer.status === "error" ||
      layer.status === "downloading" ||
      layer.status === "processing" ||
      layer.status === "loading-details"
    )
      return;

    // BASE LAYER LOGIC
    if (layer.category === "base") {
      if (layer.active) return;
      
      // Disable other base layers
      layers.value.forEach((l) => {
        if (l.category === "base" && l.active) {
          l.active = false;
          if (l.layerInstance) l.layerInstance.setVisible(false);
        }
      });
      
      // Enable this one
      layer.active = true;
      if (layer.layerInstance) layer.layerInstance.setVisible(true);
    } 
    // OVERLAY LAYER LOGIC
    else {
      layer.active = !layer.active;
      
      // Update OpenLayers Visibility
      if (layer.layerInstance) {
         layer.layerInstance.setVisible(layer.active);
      }
    }
  };

  // Updates the stored color value only.
  // The composable's applyLayerColor() handles re-styling OL features.
  const updateLayerColor = (layerId, newColor) => {
    const layerObj = layerIndex.get(layerId);
    if (!layerObj) return;
    layerObj.color = newColor;
  };

  // --- GETTERS ---
  const baseLayers = computed(() =>
    layers.value.filter((l) => l.category === "base"),
  );
  const overlayLayers = computed(() =>
    layers.value.filter((l) => l.category === "overlay"),
  );

  return {
    layers,
    baseLayers,
    overlayLayers,
    addLayer,
    reset,
    getLayerById,
    toggleLayer,
    setLayerProgress,
    setLayerStatus,
    setLayerError,
    updateLayerColor,
    retryLayer,
    cancelLayerLoad,
    registerCancelHandler,
  };
});