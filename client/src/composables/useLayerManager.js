// client/src/composables/useLayerManager.js
import { watch, markRaw } from "vue";
import { useLayerStore } from "../stores/map/layerStore";
import { useSelectionStore } from "../stores/map/selectionStore";
import { useSettingsStore } from "../stores/settingsStore";
import { generateUUID } from "../utils/helpers";
import { logger } from "../utils/logger";
import {
  buildLayerSharedStyle,
  buildGroupByStyleFunction,
  createSelectionStyleFunction,
} from "../utils/styleFactory";
import {
  createTileLayerConfig,
  createWMSLayerConfig,
  createWMTSLayerConfig,
  createGeoJSONLayerConfig,
  createGeoTIFFLayerConfig,
} from "../utils/layerFactory";
import {
  Z_INDEX,
  LAYER_CATEGORY,
  LAYER_STATUS,
  GEOMETRY_TYPE,
  SUBCATEGORY_COLORS,
} from "../constants/layerConstants";

// OpenLayers Imports
import VectorLayer from "ol/layer/Vector";
import VectorImageLayer from "ol/layer/VectorImage";
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
    // 1. Terminate the worker
    const worker = activeWorkers.get(layerId);
    if (worker) {
      worker.terminate();
      activeWorkers.delete(layerId);
    }
    // 2. Remove any partially-loaded OL layer from the map
    const storeLayer = layerStore.layers.find((l) => l._layerId === layerId);
    if (storeLayer?.layerInstance) {
      map.removeLayer(storeLayer.layerInstance);
      storeLayer.layerInstance = null;
    }
    // 3. Clear any partial search index entries
    searchIndex.delete(layerId);
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

  // ---------------------------------------------------------------------------
  // CRS Compatibility Check — probes WMS/WMTS capabilities asynchronously
  // and marks each base layer as compatible (true), incompatible (false), or
  // unchecked (null) so the UI can warn users about mismatched projections.
  // ---------------------------------------------------------------------------
  const checkCrsCompatibility = async (layerConf, layerId) => {
    const mapCrs = map.getView().getProjection().getCode(); // e.g. "EPSG:3031"
    const epsgCode = mapCrs.split(":")[1]; // e.g. "3031"

    // Allow the config to hard-code compatibility rather than probing the network.
    // `crs_support: false`              → always incompatible
    // `crs_support: ["EPSG:3031", ...]` → compatible only when mapCrs is in the list
    // omitted                           → probe the network (type-dependent below)
    if (layerConf.crs_support !== undefined) {
      if (layerConf.crs_support === false) {
        layerStore.setCrsCompatibility(layerId, false);
      } else if (Array.isArray(layerConf.crs_support)) {
        const upper = layerConf.crs_support.map((c) => String(c).toUpperCase());
        layerStore.setCrsCompatibility(layerId, upper.includes(mapCrs.toUpperCase()));
      }
      return;
    }

    try {
      // Tile layers: compatible only when crs_options is explicitly defined,
      // meaning the user has configured the tile grid for the current CRS.
      if (layerConf.type === "tile") {
        layerStore.setCrsCompatibility(layerId, !!layerConf.crs_options);
        return;
      }

      if (layerConf.type === "wmts") {
        // Normalize the base URL: replace load-balancing templates (e.g. {a-c})
        // and strip query parameters before building the capabilities URL.
        let baseUrl = layerConf.url
          .replace(/\{[a-z]-[a-z]\}/g, layerConf.url.match(/\{([a-z])-[a-z]\}/)?.[1] ?? "a")
          .replace(/[?#].*$/, "")
          .replace(/\/$/, "");

        // Try KVP format first (works for CGI endpoints like GIBS), then REST fallback.
        const candidates = [
          `${baseUrl}?SERVICE=WMTS&REQUEST=GetCapabilities`,
          `${baseUrl}/WMTSCapabilities.xml`,
        ];

        let doc = null;
        for (const capUrl of candidates) {
          try {
            const res = await fetch(capUrl, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) continue;
            const xml = await res.text();
            doc = new DOMParser().parseFromString(xml, "text/xml");
            // A parsed error document has a <parsererror> root element.
            if (doc.querySelector("parsererror")) { doc = null; continue; }
            break;
          } catch { continue; }
        }

        if (!doc) {
          // Couldn't fetch capabilities — leave as null (unknown).
          layerStore.setCrsCompatibility(layerId, null);
          return;
        }

        // Find the TileMatrixSet element whose <Identifier> matches matrixSet.
        const sets = doc.querySelectorAll("TileMatrixSet");
        for (const set of sets) {
          const id = set.querySelector(":scope > Identifier, :scope > ows\\:Identifier")?.textContent?.trim();
          if (id !== layerConf.matrixSet) continue;
          const supportedCrs =
            set.querySelector(":scope > SupportedCRS, :scope > ows\\:SupportedCRS")?.textContent?.trim() ?? "";
          const compatible =
            supportedCrs.includes(epsgCode) ||
            supportedCrs.toUpperCase().includes(mapCrs.toUpperCase());
          layerStore.setCrsCompatibility(layerId, compatible);
          return;
        }

        // matrixSet was not found in capabilities — mark as incompatible.
        layerStore.setCrsCompatibility(layerId, false);
        return;
      }

      if (layerConf.type === "wms") {
        // Browser-side WMS GetCapabilities is blocked by CORS on virtually all
        // public WMS servers (the server must opt-in with CORS headers, and most
        // don't). Attempting the fetch would always produce a browser CORS error
        // in the console even though our catch() handles the exception. Instead
        // we leave crsCompatible as null (unknown) for WMS layers; users can
        // work around this by adding `crs_support: false` to the layer config.
        layerStore.setCrsCompatibility(layerId, null);
        return;
      }
    } catch (e) {
      // Network errors etc. — leave crsCompatible as null so the UI stays neutral.
      logger.warn("LayerManager", `CRS check failed for "${layerConf.name}":`, e.message);
    }
  };

  const processLayer = async (layerConf, category) => {
    const layerId = layerConf._layerId || generateUUID();
    const zIndex = category === LAYER_CATEGORY.BACKGROUND
      ? Z_INDEX.BACKGROUND
      : category === LAYER_CATEGORY.BASE
        ? Z_INDEX.BASE
        : Z_INDEX.OVERLAY;

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
        layerConfig.metadata = {
          bands:           layerConf.bandCount       ?? null,
          dataMin:         layerConf.dataMin         ?? null,
          dataMax:         layerConf.dataMax         ?? null,
          noDataValue:     layerConf.noDataValue     ?? null,
          extent:          layerConf.extent          ?? null,
          tiffProjection:  layerConf.tiffProjection  ?? null,
          file:            layerConf.file            ?? null,
        };
        break;
      case "geojson":
        layerConfig = createGeoJSONLayerConfig(layerConf, layerId);
        break;
      default:
        logger.error('LayerManager', `Unknown layer type: ${layerConf.type}`);
        return;
    }

    // Add layer to store with category
    layerStore.addLayer({
      ...layerConfig,
      category,
      isUserAdded: layerConf.isUserAdded ?? false,
      attribution: layerConf.attribution ?? null,
    });

    // For raster layers (tile, wms, wmts), add to map immediately
    if (layerConfig.layerInstance) {
      map.addLayer(layerConfig.layerInstance);
      layerStore.setLayerStatus(layerId, LAYER_STATUS.READY);
      // Update z-indexes to respect current layer ordering
      layerStore.updateLayerZIndexes();

      // GeoTIFF: listen for OL source errors (e.g. "No transform available")
      // so the layer is marked as errored instead of silently failing.
      if (layerConf.type === 'geotiff') {
        const src = layerConfig.layerInstance.getSource?.();
        if (src) {
          src.once('error', () => {
            const proj = layerConf.tiffProjection ?? 'unknown CRS';
            layerStore.setLayerError(
              layerId,
              `Could not display GeoTIFF — the file's CRS (${proj}) cannot be reprojected to the map's projection. Re-project the file with GDAL/QGIS first.`,
            );
          });
        }
      }
    }

    // Fire-and-forget CRS probe for base layers — doesn't block map init.
    if (category === LAYER_CATEGORY.BASE) {
      checkCrsCompatibility(layerConf, layerId);
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
      debug: !!(window.__APP_DEBUG__ || import.meta.env.DEV),
    });

    // State shared across all CHUNK messages for this layer.
    const format = new GeoJSON();
    const layerSearchIndex = new Map();
    let source = null;
    let olLayer = null;
    let detectedGeomType = GEOMETRY_TYPE.POLYGON;
    // Collect unique groupBy values while streaming chunks
    const groupByValues = new Set();

    worker.onmessage = (e) => {
      const { type, progress, chunkIndex, totalChunks, isFirst, dataProjection, geojsonChunk, metadata, error } = e.data;

      if (type === "PROGRESS") {
        layerStore.setLayerProgress(layer._layerId, progress);
      }

      if (type === "CHUNK") {
        if (isFirst) {
          layerStore.setLayerStatus(layer._layerId, LAYER_STATUS.PROCESSING);
          layerStore.setLayerProgress(layer._layerId, 0);
        }

        // Parse this chunk's features (applies CRS projection — must run on main thread).
        // dataProjection tells OL what CRS the coordinates are actually in;
        // featureProjection tells OL what CRS the map view uses.
        const readOptions = {
          featureProjection: map.getView().getProjection(),
        };
        if (dataProjection) {
          readOptions.dataProjection = dataProjection;
        }
        if (isFirst && (window.__APP_DEBUG__ || import.meta.env.DEV)) {
          console.debug(`=== LAYER DEBUG — ${layer.name} (main thread) ===`);
          console.debug("  dataProjection (from file):",  readOptions.dataProjection ?? "undefined → OL defaults to EPSG:4326");
          console.debug("  featureProjection (map view):", map.getView().getProjection().getCode());
          const sample = geojsonChunk.features[0]?.geometry?.coordinates;
          if (sample) console.debug("  First feature raw coords:", JSON.stringify(sample)?.slice(0, 120));
        }
        const features = format.readFeatures(geojsonChunk, readOptions);

        // Assign stable IDs and build the search index.
        for (const feature of features) {
          const fid = feature.get("_featureId") || feature.get("id") || generateUUID();
          feature.setId(fid);
          feature.set("_layerId", layer._layerId);
          if (!feature.get("_featureId")) feature.set("_featureId", fid);

          // Track unique values for group_by
          if (layer.groupBy) {
            const val = feature.get(layer.groupBy);
            if (val != null && String(val) !== "") groupByValues.add(String(val));
          }

          if (layer.searchFields?.length) {
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

        if (isFirst) {
          // Detect geometry type from the first loaded feature.
          if (features.length > 0) {
            const firstType = features[0].getGeometry().getType();
            if (firstType === GEOMETRY_TYPE.POINT || firstType === GEOMETRY_TYPE.MULTI_POINT) {
              detectedGeomType = GEOMETRY_TYPE.POINT;
            } else if (firstType === GEOMETRY_TYPE.LINE_STRING || firstType === GEOMETRY_TYPE.MULTI_LINE_STRING) {
              detectedGeomType = GEOMETRY_TYPE.LINE;
            }
          }

          const sharedStyle = buildLayerSharedStyle(
            layer.color,
            layer.strokeColor ?? null,
            layer.fillColor ?? null,
            detectedGeomType,
          );

          // Create source + layer and add to the map immediately so the first
          // batch of features is visible while the rest are still streaming in.
          source = new VectorSource({ features });
          const LayerClass = layer.renderMode === "image" ? VectorImageLayer : VectorLayer;

          // Use a style function for grouped layers so each group can be
          // coloured and toggled independently. For plain layers, use the
          // static shared style (faster — avoids per-feature lookup).
          const layerStyle = layer.groupBy
            ? buildGroupByStyleFunction(layer._layerId, layerStore)
            : sharedStyle;

          olLayer = new LayerClass({
            source,
            style: layerStyle,
            visible: layer.active,
            zIndex: Z_INDEX.OVERLAY,
            updateWhileAnimating: false,
            updateWhileInteracting: false,
            properties: { id: layer._layerId },
          });

          const storeLayer = layerStore.layers.find((l) => l._layerId === layer._layerId);
          if (storeLayer) {
            storeLayer.layerInstance = markRaw(olLayer);
            storeLayer.geometryType = detectedGeomType;
          }
          map.addLayer(olLayer);
          layerStore.updateLayerZIndexes();
        } else {
          // Append to the existing source — OL re-renders on the next animation frame.
          source.addFeatures(features);
        }

        layerStore.setLayerProgress(layer._layerId, Math.round(((chunkIndex + 1) / totalChunks) * 100));
      }

      if (type === "COMPLETE") {
        searchIndex.set(layer._layerId, layerSearchIndex);

        // Resolve the store layer first — needed both for groupBy and for
        // setting status/metadata below. (Must be before the groupBy block
        // or `storeLayer` would be in the temporal dead zone inside the else.)
        const storeLayer = layerStore.layers.find((l) => l._layerId === layer._layerId);

        // Build sub-categories from collected unique values.
        if (layer.groupBy) {
          if (groupByValues.size > 0) {
            // All sub-groups start with the same colour as the parent layer so
            // the main colour still makes sense visually. The user can then
            // change individual group colours via the right-click context menu.
            const baseColor = layer.strokeColor || layer.color || DEFAULT_COLOR;
            const categories = {};
            for (const val of [...groupByValues].sort()) {
              categories[val] = { color: baseColor, visible: true };
            }
            layerStore.initSubCategories(layer._layerId, categories);
            if (olLayer) olLayer.changed();
          } else {
            // The configured field name was not present in any feature — warn.
            const msg = `group_by field "${layer.groupBy}" not found in any feature. Check the spelling in config.yaml.`;
            logger.warn("LayerManager", `Layer "${layer.name}": ${msg}`);
            if (storeLayer) {
              storeLayer.groupByMissing = true;
              storeLayer.warning = msg;
            }
          }
        }

        if (storeLayer) {
          storeLayer.status = LAYER_STATUS.READY;
          storeLayer.metadata = metadata ?? {};
        }

        worker.terminate();
        activeWorkers.delete(layer._layerId);
      }

      if (type === "ERROR") {
        logger.error("LayerManager", "Worker Error:", error);
        layerStore.setLayerError(layer._layerId, error);
        worker.terminate();
        activeWorkers.delete(layer._layerId);
      }
    };
  };

  const applyLayerColor = (layerId) => {
    const layerObj = layerStore.getLayerById(layerId);
    if (!layerObj || !layerObj.layerInstance) return;

    // For grouped layers the style function already reads from the store;
    // just force OL to re-render the image tile.
    if (layerObj.groupBy) {
      layerObj.layerInstance.changed();
      return;
    }

    // Update layer-level style — O(1) regardless of feature count.
    const newStyle = buildLayerSharedStyle(
      layerObj.color,
      layerObj.strokeColor ?? null,
      layerObj.fillColor ?? null,
      layerObj.geometryType
    );
    layerObj.layerInstance.setStyle(newStyle);

    // Clear any per-feature style overrides (e.g. from a previous selection)
    // so the new layer style takes effect on all non-selected features.
    const source = layerObj.layerInstance.getSource?.();
    if (source) {
      const selectedIds = selectInteraction
        ? new Set(selectInteraction.getFeatures().getArray().map(f => f.getId()))
        : new Set();
      source.getFeatures().forEach(f => {
        if (!selectedIds.has(f.getId())) f.setStyle(null);
      });
    }
    // Force a full re-render (required for VectorImageLayer and large feature sets)
    layerObj.layerInstance.changed();
  };

  /**
   * Force OL to re-render a grouped layer after a sub-category change.
   * Call this from the UI after toggling visibility or changing a group colour.
   */
  const applySubCategories = (layerId) => {
    const layerObj = layerStore.getLayerById(layerId);
    if (layerObj?.layerInstance) layerObj.layerInstance.changed();
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
      filter: (feature) => feature.get('_layerId') != null, // exclude measurement/temp features
    });

    selectInteraction.on("select", (e) => {
      // Clear the per-feature selection style — OL falls back to the
      // layer-level shared style automatically.
      e.deselected.forEach((deselected) => {
        deselected.setStyle(null);
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
        if (!(layer instanceof VectorLayer) && !(layer instanceof VectorImageLayer)) return;
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

  const setSelectionActive = (active) => {
    if (selectInteraction) selectInteraction.setActive(active);
    if (dragBoxInteraction) dragBoxInteraction.setActive(active);
    if (!active) selectionStore.clearSelection();
  };

  const removeLayer = (layerId) => {
    const layer = layerStore.getLayerById(layerId);
    if (!layer) return;
    // Remove OL layer instance from the map
    if (layer.layerInstance) {
      map.removeLayer(layer.layerInstance);
    }
    // Revoke blob URL if one was used (prevents memory leak)
    if (layer.url && layer.url.startsWith('blob:')) {
      URL.revokeObjectURL(layer.url);
    }
    // Clean up search index
    searchIndex.delete(layerId);
    // Terminate any active worker for this layer
    const worker = activeWorkers.get(layerId);
    if (worker) {
      worker.terminate();
      activeWorkers.delete(layerId);
    }
    // Remove from store
    layerStore.removeLayer(layerId);
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

  return { processLayer, removeLayer, cleanup, applyLayerColor, applySubCategories, searchIndex, setupSelection, setSelectionActive };
}
