<template>
  <div class="map-container">
    <div id="map" ref="mapContainer" @contextmenu="handleMapContextMenu"></div>
    
    <!-- Map Context Menu -->
    <ContextMenuMap ref="mapContextMenuRef" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, inject, ref } from "vue";
import "ol/ol.css"; // OpenLayers CSS

import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls } from "ol/control";

import { registerCustomProjections } from "../../utils/crs";
import { useMapStore } from "../../stores/map/mapStore";
import { useLayerStore } from "../../stores/map/layerStore";
import { useLayerManager } from "../../composables/useLayerManager";
import ContextMenuMap from "../contextMenus/ContextMenuMap.vue";

const configRef = inject("config");
const config = configRef.value;
const layerManagerRef = inject("layerManager");
const mapStore = useMapStore();
const layerStore = useLayerStore();

const mapContainer = ref(null);
const mapContextMenuRef = ref(null);
let map = null;
let layerManager = null;

const handleMapContextMenu = (event) => {
  event.preventDefault();
  
  if (!map || !mapContextMenuRef.value) return;
  
  // Get the coordinate at the click position
  const pixel = map.getEventPixel(event);
  const coordinate = map.getCoordinateFromPixel(pixel);
  
  mapContextMenuRef.value.open(event, coordinate);
};

onMounted(async () => {
  if (!mapContainer.value) return;

  // 1. Register Projections (e.g. EPSG:3031)
  const projectionCode = registerCustomProjections(config);

  // 2. Determine Center
  let centerProjected;
  const centerValues = config.view.center;

  if (Math.abs(centerValues[0]) > 360 || Math.abs(centerValues[1]) > 360) {
    // Already in projected coordinates (meters)
    centerProjected = centerValues;
  } else {
    // Geographic coordinates [lon, lat] - transform them
    centerProjected = fromLonLat(centerValues, projectionCode);
  }

  // 3. Get view extent if specified
  const viewExtent = config.view.extent || config.projection_params?.extent;

  // 3. Initialize Map
  map = new Map({
    target: mapContainer.value,
    controls: defaultControls({ zoom: false, attribution: false }),
    layers: [], // Layers added via Manager
    view: new View({
      projection: projectionCode,
      center: centerProjected,
      zoom: config.view.zoom,
      minZoom: config.view.minZoom,
      maxZoom: config.view.maxZoom,
      extent: viewExtent,  // Constrain panning to this extent
      constrainResolution: true, // Force integer zoom levels
      showFullExtent: true  // Prevent panning outside extent
    }),
  });

  if (window.__APP_DEBUG__) {
    const view = map.getView();
    const proj = view.getProjection();
    console.debug("=== MAP DEBUG ===");
    console.debug("Projection Code:", proj.getCode());
    console.debug("Projection Extent:", proj.getExtent());
    console.debug("View Extent:", viewExtent);
    console.debug("Current Center:", view.getCenter());
    console.debug("Current Zoom:", view.getZoom());
  }

  mapStore.setMap(map);

  // 4. Initialize Manager and load layers
  layerManager = useLayerManager(map);
  // Fill the shared ref so LayerPanel / SearchBar can see the manager
  layerManagerRef.value = layerManager;

  const promises = [];
  if (config.base_layers) {
    promises.push(
      ...config.base_layers.map((l) => layerManager.processLayer(l, "base"))
    );
  }
  if (config.overlay_layers) {
    promises.push(
      ...config.overlay_layers.map((l) =>
        layerManager.processLayer(l, "overlay")
      )
    );
  }
  await Promise.all(promises);

  // 5. Setup Selection Interaction (now handled in layerManager)
  layerManager.setupSelection();
});

onUnmounted(() => {
  if (layerManager) layerManager.cleanup();
  if (map) map.setTarget(null);
});
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}
#map {
  width: 100%;
  height: 100%;
}
</style>