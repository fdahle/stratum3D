// client/src/composables/useLayerManager.js
import { watch } from "vue";
import { useLayerStore } from "../stores/map/layerStore";
import { useSelectionStore } from "../stores/map/selectionStore";
import { useSettingsStore } from "../stores/settingsStore";
import { generateUUID } from "../utils/helpers";
import { logger } from "../utils/logger";
import {
  createPinStyle,
  createVectorStyle,
  createSelectionStyleFunction,
  applyFeatureStyle,
} from "../utils/styleFactory";
import {
  createTileLayerConfig,
  createWMSLayerConfig,
  createWMTSLayerConfig,
  createGeoJSONLayerConfig,
  createGeoTIFFLayerConfig,
} from "../utils/layerFactory";
import {
  BATCH_SIZE,
  Z_INDEX,
  LAYER_CATEGORY,
  LAYER_STATUS,
  GEOMETRY_TYPE,
} from "../constants/layerConstants";

// OpenLayers Imports
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Select, DragBox } from "ol/interaction";
import { click, shiftKeyOnly } from "ol/events/condition";

export function useLayerManager(map) {
  const layerStore = useLayerStore();
  const selectionStore = useSelectionStore();
  const settingsStore = useSettingsStore();
  const activeWorkers = new Map();
  let selectInteraction = null;

  // ---------------------------------------------------------------------------
  // #5 — Search index: layerId → Map<lowerCaseName, OL Feature>
  // Built once per layer when it finishes loading; SearchBar reads it instead
  // of scanning every feature on every keystroke.
  // ---------------------------------------------------------------------------
  const searchIndex = new Map();

  // ---------------------------------------------------------------------------
  // #4 — Register the cancel handler so the store can terminate workers.
  // The store calls this function when cancelLayerLoad() is invoked.
  // ---------------------------------------------------------------------------
  layerStore.registerCancelHandler((layerId) => {
    const worker = activeWorkers.get(layerId);
    if (worker) {
      worker.terminate();
      activeWorkers.delete(layerId);
    }
  });

  // Watcher to trigger downloads - only watch the specific conditions we care about
  // Using a computed to extract only the relevant data prevents unnecessary re-runs
  watch(
    () =>
      layerStore.layers.map((l) => ({
        id: l._layerId,
        active: l.active,
        status: l.status,
        type: l.type,
      })),
    (layerStates) => {
      layerStates.forEach((state) => {
        if (
          state.active &&
          state.status === LAYER_STATUS.IDLE &&
          state.type === "geojson"
        ) {
          const layer = layerStore.layers.find((l) => l._layerId === state.id);
          if (layer) loadGeoJsonLayer(layer);
        }
      });
    },
  );

  const processLayer = async (layerConf, category) => {
    const layerId = layerConf._layerId || generateUUID();
    const zIndex = category === LAYER_CATEGORY.BASE ? Z_INDEX.BASE : Z_INDEX.OVERLAY;

    let layerConfig;
    
    // Create layer configuration based on type
    switch (layerConf.type) {
      case "tile":
        layerConfig = createTileLayerConfig(layerConf, map, zIndex, layerId);
        break;
      case "wms":
        layerConfig = createWMSLayerConfig(layerConf, map, zIndex, layerId);
        break;
      case "wmts":
        layerConfig = createWMTSLayerConfig(layerConf, map, zIndex, layerId);
        break;
      case "geotiff":
        layerConfig = createGeoTIFFLayerConfig(layerConf, map, zIndex, layerId);
        break;
      case "geojson":
        layerConfig = createGeoJSONLayerConfig(layerConf, layerId);
        break;
      default:
        logger.error('LayerManager', `Unknown layer type: ${layerConf.type}`);
        return;
    }

    // Add layer to store with category
    layerStore.addLayer({ ...layerConfig, category });

    // For raster layers (tile, wms, wmts), add to map immediately
    if (layerConfig.layerInstance) {
      map.addLayer(layerConfig.layerInstance);
      layerStore.setLayerStatus(layerId, LAYER_STATUS.READY);
      // Update z-indexes to respect current layer ordering
      layerStore.updateLayerZIndexes();
    }

    return layerConfig;
  };

  const loadGeoJsonLayer = (layer) => {
    layerStore.setLayerStatus(layer._layerId, LAYER_STATUS.DOWNLOADING);

    const worker = new Worker(
      new URL("../workers/layerWorker.js", import.meta.url),
      { type: "module" },
    );
    activeWorkers.set(layer._layerId, worker);

    worker.postMessage({
      url: layer.url,
      layerId: layer._layerId,
      layerName: layer.name,
    });

    worker.onmessage = (e) => {
      const { type, progress, data, error } = e.data;
      if (type === "PROGRESS")
        layerStore.setLayerProgress(layer._layerId, progress);
      if (type === "SUCCESS") {
        finalizeGeoJsonLayer(data, layer, worker);
      }
      if (type === "ERROR") {
        logger.error('LayerManager', 'Worker Error:', error);
        layerStore.setLayerError(layer._layerId, error);
        worker.terminate();
        activeWorkers.delete(layer._layerId);
      }
    };
  };

  const finalizeGeoJsonLayer = async (geoJsonData, layer, worker) => {
    // Signal that we're now in the processing (parsing) phase
    layerStore.setLayerStatus(layer._layerId, LAYER_STATUS.PROCESSING);
    layerStore.setLayerProgress(layer._layerId, 0);

    // 1. Parse GeoJSON (unavoidable synchronous OL call, but relatively fast)
    const format = new GeoJSON();
    const features = format.readFeatures(geoJsonData, {
      featureProjection: map.getView().getProjection(),
    });

    // 2. Create cached styles once
    const baseColor = layer.color;
    const vectorStyle = createVectorStyle(baseColor);
    const pinStyle = createPinStyle(baseColor);

    // 3. Process features in chunks, yielding to the browser between each batch
    const totalFeatures = features.length;
    const layerSearchIndex = new Map(); // name (lowercase) → feature

    for (let i = 0; i < totalFeatures; i += BATCH_SIZE) {
      const end = Math.min(i + BATCH_SIZE, totalFeatures);

      for (let j = i; j < end; j++) {
        const feature = features[j];
        const fid = feature.get("id") || generateUUID();
        feature.setId(fid);
        feature.set("_layerId", layer._layerId);
        feature.set("_featureId", fid);

        // Apply appropriate style based on geometry type
        applyFeatureStyle(feature, baseColor);

        // Index this feature by every field declared in search_fields
        if (layer.searchFields && layer.searchFields.length > 0) {
          const props = feature.getProperties();
          for (const field of layer.searchFields) {
            const value = props[field];
            if (value != null && String(value) !== "") {
              layerSearchIndex.set(String(value).toLowerCase(), {
                feature,
                displayValue: String(value),
              });
            }
          }
        }
      }

      // Update progress and yield to let the browser paint
      const progress = Math.round((end / totalFeatures) * 100);
      layerStore.setLayerProgress(layer._layerId, progress);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Store the search index for this layer
    searchIndex.set(layer._layerId, layerSearchIndex);

    // 4. Create Source and Layer (all features are styled, this is fast)
    const source = new VectorSource({ features });

    const olLayer = new VectorLayer({
      source: source,
      visible: layer.active,
      zIndex: Z_INDEX.OVERLAY,
      updateWhileAnimating: true,
      updateWhileInteracting: true,
      properties: { id: layer._layerId },
    });

    // 5. Detect geometry type from loaded features
    let detectedGeomType = GEOMETRY_TYPE.POLYGON;
    if (features.length > 0) {
      const firstType = features[0].getGeometry().getType();
      if (firstType === GEOMETRY_TYPE.POINT || firstType === GEOMETRY_TYPE.MULTI_POINT) {
        detectedGeomType = GEOMETRY_TYPE.POINT;
      } else if (
        firstType === GEOMETRY_TYPE.LINE_STRING ||
        firstType === GEOMETRY_TYPE.MULTI_LINE_STRING
      ) {
        detectedGeomType = GEOMETRY_TYPE.LINE;
      }
    }

    // 6. Update store and add to map
    const storeLayer = layerStore.layers.find(
      (l) => l._layerId === layer._layerId,
    );
    if (storeLayer) {
      storeLayer.layerInstance = olLayer;
      storeLayer.geometryType = detectedGeomType;
      storeLayer.status = LAYER_STATUS.READY;
      storeLayer.metadata = geoJsonData._metadata || {};
      map.addLayer(olLayer);
      // Update z-indexes to respect current layer ordering
      layerStore.updateLayerZIndexes();
    }

    worker.terminate();
    activeWorkers.delete(layer._layerId);
  };

  const applyLayerColor = (layerId) => {
    const layerObj = layerStore.getLayerById(layerId);
    if (!layerObj || !layerObj.layerInstance) return;

    const newColor = layerObj.color;
    const olLayer = layerObj.layerInstance;
    const source = olLayer.getSource();
    if (!source) return;

    // Get the currently selected features from the select interaction
    const selectedFeatures = selectInteraction
      ? selectInteraction.getFeatures().getArray()
      : [];
    const selectedIds = new Set(selectedFeatures.map((f) => f.getId()));

    // Apply style directly to each feature (better performance than a style function)
    // Skip selected features - they keep their selection style
    source.getFeatures().forEach((feature) => {
      // Don't change the style of selected features
      if (selectedIds.has(feature.getId())) return;

      applyFeatureStyle(feature, newColor);
    });

    // Clear any layer-level style so per-feature styles take effect
    olLayer.setStyle(null);
  };

  let dragBoxInteraction = null;

  // Sync the OL selection collection into the store
  const syncSelectionToStore = () => {
    const allSelected = selectInteraction.getFeatures().getArray();
    if (allSelected.length === 0) {
      selectionStore.clearSelection();
    } else {
      const featureData = allSelected.map((f) => {
        const properties = f.getProperties();
        const { geometry, ...props } = properties;
        return { properties: props };
      });
      selectionStore.setSelectedFeatures(featureData);
    }
  };

  const setupSelection = () => {
    // Create selection style function using the factory
    const selectionStyleFunction = createSelectionStyleFunction(
      layerStore.getLayerById
    );

    selectInteraction = new Select({
      condition: click,
      toggleCondition: shiftKeyOnly, // shift+click adds/removes from selection
      style: selectionStyleFunction,
    });

    selectInteraction.on("select", (e) => {
      // Restore styles for all deselected features
      e.deselected.forEach((deselected) => {
        const layerId = deselected.get("_layerId");
        const layerObj = layerStore.getLayerById(layerId);
        if (layerObj?.color) {
          applyFeatureStyle(deselected, layerObj.color);
        }
      });

      syncSelectionToStore();
    });

    // DragBox interaction for shift+drag box selection
    dragBoxInteraction = new DragBox({ condition: shiftKeyOnly });

    dragBoxInteraction.on("boxend", () => {
      const boxExtent = dragBoxInteraction.getGeometry().getExtent();
      const selFeatures = selectInteraction.getFeatures();

      // Collect features already in the selection for fast duplicate check
      const alreadySelected = new Set(selFeatures.getArray().map((f) => f.getId()));

      map.getLayers().forEach((layer) => {
        if (!(layer instanceof VectorLayer)) return;
        if (!layer.getVisible()) return; // skip hidden layers
        layer.getSource().forEachFeatureIntersectingExtent(boxExtent, (feature) => {
          if (!alreadySelected.has(feature.getId())) {
            selFeatures.push(feature);
            alreadySelected.add(feature.getId());
            // Apply selection style manually since we're bypassing the Select interaction
            feature.setStyle(selectionStyleFunction(feature));
          }
        });
      });

      syncSelectionToStore();
    });

    map.addInteraction(dragBoxInteraction);
    map.addInteraction(selectInteraction);
  };

  const cleanup = () => {
    activeWorkers.forEach((w) => w.terminate());
    activeWorkers.clear();
    searchIndex.clear();
    if (dragBoxInteraction) {
      map.removeInteraction(dragBoxInteraction);
      dragBoxInteraction = null;
    }
    if (selectInteraction) {
      map.removeInteraction(selectInteraction);
      selectInteraction = null;
    }
  };

  return { processLayer, cleanup, applyLayerColor, searchIndex, setupSelection };
}
