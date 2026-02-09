// client/src/composables/useLayerManager.js
import { watch } from "vue";
import { useLayerStore } from "../stores/map/layerStore";
import { useSelectionStore } from "../stores/map/selectionStore";
import { useSettingsStore } from "../stores/settingsStore";
import { createPinStyle, getComplementaryColor, generateUUID } from "./utils";

// OpenLayers Imports
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Style, Stroke, Fill } from "ol/style";
import { createXYZ } from "ol/tilegrid";
import TileGrid from "ol/tilegrid/TileGrid";
import WMTS from "ol/source/WMTS";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import TileWMS from "ol/source/TileWMS";
import { Select } from "ol/interaction";
import { click } from "ol/events/condition";

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
          state.status === "idle" &&
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

    // Set z-index based on category
    const zIndex = category === "base" ? 0 : 100;

    // --- TILE LAYERS ---
    if (layerConf.type === "tile") {
      const projection = map.getView().getProjection();

      // Detect if this is WMTS (like NASA GIBS) or XYZ (like GBIF)
      const isWMTS = layerConf.url.includes("{z}/{y}/{x}");

      // Create source configuration
      const sourceConfig = {
        attributions: layerConf.attribution,
        projection: projection,
        wrapX: false, // TODO: Make configurable?
      };

      // Add tile grid if custom resolutions are provided (for polar projections)
      if (layerConf.crs_options?.resolutions && layerConf.crs_options?.extent) {
        const extent = layerConf.crs_options.extent;
        const resolutions = layerConf.crs_options.resolutions;
        const tileSize = layerConf.tileSize || 256;

        if (isWMTS) {
          // WMTS uses TMS-style tiles with origin at top-left
          // and Y increases downward (standard)
          sourceConfig.tileGrid = new TileGrid({
            extent: extent,
            resolutions: resolutions,
            tileSize: tileSize,
            origin: [extent[0], extent[3]], // Top-left corner
          });

          // Custom tile URL function for WMTS {z}/{y}/{x} pattern
          sourceConfig.tileUrlFunction = (tileCoord) => {
            if (!tileCoord) return "";
            const z = tileCoord[0];
            const x = tileCoord[1];
            const y = tileCoord[2];

            // WMTS pattern: {z}/{y}/{x}
            return layerConf.url
              .replace("{z}", z.toString())
              .replace("{y}", y.toString())
              .replace("{x}", x.toString());
          };
        } else {
          // Standard XYZ tiles (like GBIF)
          sourceConfig.tileGrid = createXYZ({
            extent: extent,
            resolutions: resolutions,
            tileSize: tileSize,
          });
          sourceConfig.url = layerConf.url;
        }
      } else {
        // No custom tile grid - use URL directly
        sourceConfig.url = layerConf.url;
      }

      // Create the XYZ source and layer
      const source = new XYZ(sourceConfig);
      const olLayer = new TileLayer({
        source: source,
        visible: layerConf.visible,
        zIndex: zIndex,
        properties: { name: layerConf.name, id: layerId },
      });

      // #2 — options object
      layerStore.addLayer({
        layerId,
        name: layerConf.name,
        layerInstance: olLayer,
        type: "tile",
        category,
        visible: layerConf.visible,
        url: layerConf.url,
      });

      // ALWAYS add to map immediately (visibility controlled via setVisible)
      map.addLayer(olLayer);
      layerStore.setLayerStatus(layerId, "ready");
    }

    // --- WMS LAYERS ---
    if (layerConf.type === "wms") {
      const source = new TileWMS({
        url: layerConf.url,
        params: {
          LAYERS: layerConf.layers || "0",
          FORMAT: layerConf.format || "image/jpeg",
          VERSION: "1.3.0",
        },
        projection: map.getView().getProjection(),
        attributions: layerConf.attribution,
      });

      const olLayer = new TileLayer({
        source: source,
        visible: layerConf.visible,
        zIndex: zIndex,
        properties: { name: layerConf.name, id: layerId },
      });

      // #2 — options object
      layerStore.addLayer({
        layerId,
        name: layerConf.name,
        layerInstance: olLayer,
        type: "wms",
        category,
        visible: layerConf.visible,
        url: layerConf.url,
      });

      map.addLayer(olLayer);
      layerStore.setLayerStatus(layerId, "ready");
    }

    // --- WMTS LAYERS ---
    if (layerConf.type === "wmts") {
      const source = new WMTS({
        url: layerConf.url,
        layer: layerConf.layer,
        matrixSet: layerConf.matrixSet,
        format: layerConf.format,
        projection: map.getView().getProjection(),
        tileGrid: new WMTSTileGrid({
          origin: layerConf.origin || [-4194304, 4194304],
          resolutions: layerConf.resolutions || [
            8192, 4096, 2048, 1024, 512, 256,
          ],
          matrixIds: layerConf.matrixIds || [0, 1, 2, 3, 4, 5],
          tileSize: layerConf.tileSize || 512,
        }),
      });

      const olLayer = new TileLayer({
        source: source,
        visible: layerConf.visible,
        zIndex: zIndex,
        properties: { name: layerConf.name, id: layerId },
      });

      map.addLayer(olLayer);

      // #2 — options object
      layerStore.addLayer({
        layerId,
        name: layerConf.name,
        layerInstance: olLayer,
        type: "wmts",
        category,
        visible: layerConf.visible,
        url: layerConf.url,
      });
      layerStore.setLayerStatus(layerId, "ready");
    }

    // --- GEOJSON LAYERS ---
    if (layerConf.type === "geojson") {
      // #2 — options object (layerInstance is null; status will be "idle" until downloaded)
      layerStore.addLayer({
        layerId,
        name: layerConf.name,
        layerInstance: null,
        type: "geojson",
        category,
        visible: layerConf.visible,
        color: layerConf.color,
        url: layerConf.url,
        searchFields: layerConf.search_fields || [],
        metadata: layerConf._metadata || {},
      });
    }
  };

  const loadGeoJsonLayer = (layer) => {
    layerStore.setLayerStatus(layer._layerId, "downloading");

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
        console.error("Worker Error:", error);
        layerStore.setLayerError(layer._layerId, error);
        worker.terminate();
        activeWorkers.delete(layer._layerId);
      }
    };
  };

  const finalizeGeoJsonLayer = async (geoJsonData, layer, worker) => {
    // Signal that we're now in the processing (parsing) phase
    layerStore.setLayerStatus(layer._layerId, "processing");
    layerStore.setLayerProgress(layer._layerId, 0);

    // 1. Parse GeoJSON (unavoidable synchronous OL call, but relatively fast)
    const format = new GeoJSON();
    const features = format.readFeatures(geoJsonData, {
      featureProjection: map.getView().getProjection(),
    });

    // 2. Create cached styles once
    const baseColor = layer.color || "#3388ff";
    const vectorStyle = new Style({
      stroke: new Stroke({ color: baseColor, width: 2 }),
      fill: new Fill({ color: baseColor + "80" }),
    });
    const pinStyle = createPinStyle(baseColor);

    // 3. Process features in chunks, yielding to the browser between each batch
    //    so the UI (progress bar, spinner) stays responsive on huge layers.
    //    Also builds the search index in the same pass — zero extra cost.
    const BATCH_SIZE = 2000;
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

        const geomType = feature.getGeometry().getType();
        if (geomType === "Point" || geomType === "MultiPoint") {
          feature.setStyle(pinStyle);
        } else {
          feature.setStyle(vectorStyle);
        }

        // Index this feature by every field declared in search_fields.
        // Layers with no searchFields are skipped entirely (no index built).
        if (layer.searchFields && layer.searchFields.length > 0) {
          const props = feature.getProperties();
          for (const field of layer.searchFields) {
            const value = props[field];
            if (value != null && String(value) !== "") {
              // key = lowercase value, value = { feature, displayValue }
              // displayValue lets SearchBar show the original (un-lowercased) value
              // without having to re-guess which field it came from.
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
      zIndex: 100,
      updateWhileAnimating: true,
      updateWhileInteracting: true,
      properties: { id: layer._layerId },
    });

    // 5. Detect geometry type from loaded features
    let detectedGeomType = "polygon";
    if (features.length > 0) {
      const firstType = features[0].getGeometry().getType();
      if (firstType === "Point" || firstType === "MultiPoint") {
        detectedGeomType = "point";
      } else if (
        firstType === "LineString" ||
        firstType === "MultiLineString"
      ) {
        detectedGeomType = "line";
      }
    }

    // 6. Update store and add to map
    const storeLayer = layerStore.layers.find(
      (l) => l._layerId === layer._layerId,
    );
    if (storeLayer) {
      storeLayer.layerInstance = olLayer;
      storeLayer.geometryType = detectedGeomType;
      storeLayer.status = "ready";
      storeLayer.metadata = geoJsonData._metadata || {};
      map.addLayer(olLayer);
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

    const newVectorStyle = new Style({
      stroke: new Stroke({ color: newColor, width: 2 }),
      fill: new Fill({ color: newColor + "80" }),
    });
    const newPinStyle = createPinStyle(newColor);

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

      const type = feature.getGeometry().getType();
      if (type === "Point" || type === "MultiPoint") {
        feature.setStyle(newPinStyle);
      } else {
        feature.setStyle(newVectorStyle);
      }
    });

    // Clear any layer-level style so per-feature styles take effect
    olLayer.setStyle(null);
  };

  const setupSelection = () => {
    // Create selection style dynamically based on the feature's layer color
    const selectionStyleFunction = (feature) => {
      const layerId = feature.get("_layerId");
      const layerObj = layerStore.getLayerById(layerId);
      
      // Get the base color from the layer, default to blue if not found
      const baseColor = layerObj?.color || "#3388ff";
      const complementaryColor = getComplementaryColor(baseColor);
      
      // Use complementary color for outline for perfect contrast
      return new Style({
        stroke: new Stroke({ 
          color: complementaryColor, // Opposite color for maximum contrast
          width: 5 
        }),
        fill: new Fill({ 
          color: baseColor + "B3" // 70% opacity of the original color
        }),
        zIndex: 999,
      });
    };

    selectInteraction = new Select({
      condition: click,
      style: selectionStyleFunction,
    });

    selectInteraction.on("select", (e) => {
      const selected = e.selected[0];
      const deselected = e.deselected[0];
      
      // When deselecting a feature, restore its current layer style
      if (deselected) {
        const layerId = deselected.get("_layerId");
        const layerObj = layerStore.getLayerById(layerId);
        if (layerObj?.color) {
          const color = layerObj.color;
          const geomType = deselected.getGeometry().getType();
          
          if (geomType === "Point" || geomType === "MultiPoint") {
            deselected.setStyle(createPinStyle(color));
          } else {
            deselected.setStyle(new Style({
              stroke: new Stroke({ color: color, width: 2 }),
              fill: new Fill({ color: color + "80" }),
            }));
          }
        }
      }
      
      if (selected) {
        const properties = selected.getProperties();
        const { geometry, ...props } = properties;

        selectionStore.selectFeature({
          properties: props,
        });
      } else {
        selectionStore.clearSelection();
      }
    });

    map.addInteraction(selectInteraction);
  };

  const cleanup = () => {
    activeWorkers.forEach((w) => w.terminate());
    activeWorkers.clear();
    searchIndex.clear();
    if (selectInteraction) {
      map.removeInteraction(selectInteraction);
      selectInteraction = null;
    }
  };

  return { processLayer, cleanup, applyLayerColor, searchIndex, setupSelection };
}
