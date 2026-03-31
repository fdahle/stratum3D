<template>
  <div class="map-container">
    <div id="map" ref="mapContainer" @contextmenu="handleMapContextMenu"></div>
    
    <!-- Map Context Menu -->
    <ContextMenuMap ref="mapContextMenuRef" />

    <!-- Scale bar rendered here so Vue scoped CSS applies cleanly -->
    <div ref="scalebarRef" class="scalebar-anchor" :style="{ bottom: showInfoBar ? '36px' : '8px' }"></div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, inject, ref } from "vue";
import { storeToRefs } from "pinia";
import "ol/ol.css"; // OpenLayers CSS

import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls, ScaleLine } from "ol/control";
import { defaults as defaultInteractions } from "ol/interaction";

import { registerCustomProjections } from "../../utils/crs";
import { useMapStore } from "../../stores/map/mapStore";
import { useLayerStore } from "../../stores/map/layerStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLayerManager } from "../../composables/useLayerManager";
import ContextMenuMap from "../contextMenus/ContextMenuMap.vue";

const configRef = inject("config");
const config = configRef.value;

// OSM background tile configs keyed by CRS — injected automatically when config.osm_background is true.
const _GBIF = {
  tileSize: 512,
  crs_options: {
    extent: [-12367396.2185, -12367396.2185, 12367396.2185, 12367396.2185],
    resolutions: [67733.469, 33866.734, 16933.367, 8466.684, 4233.342, 2116.671, 1058.335, 529.168, 264.584, 132.292],
  },
};
const OSM_BG_CONFIGS = {
  'EPSG:3031': { name: 'OSM Bright (Antarctic)', type: 'tile', visible: true, url: 'https://tile.gbif.org/3031/omt/{z}/{x}/{y}@1x.png?style=osm-bright-en', attribution: '© OpenStreetMap contributors, GBIF', ..._GBIF },
  'EPSG:3575': { name: 'OSM Bright (Arctic)',    type: 'tile', visible: true, url: 'https://tile.gbif.org/3575/omt/{z}/{x}/{y}@1x.png?style=osm-bright-en', attribution: '© OpenStreetMap contributors, GBIF', ..._GBIF },
  default:     { name: 'OpenStreetMap',           type: 'tile', visible: true, url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
};
const layerManagerRef = inject("layerManager");
const mapStore = useMapStore();
const layerStore = useLayerStore();

const mapContainer = ref(null);
const mapContextMenuRef = ref(null);
const scalebarRef = ref(null);
const settingsStore = useSettingsStore();
const { showInfoBar } = storeToRefs(settingsStore);
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
    interactions: defaultInteractions({ shiftDragZoom: false }),
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

  // Add scale bar into our own container div so Vue scoped CSS controls it
  map.addControl(new ScaleLine({ units: 'metric', target: scalebarRef.value }));

  // 4. Initialize Manager and load layers
  layerManager = useLayerManager(map);
  // Fill the shared ref so LayerPanel / SearchBar can see the manager
  layerManagerRef.value = layerManager;

  const promises = [];
  // Inject pinned OSM background layer (URL auto-selected by CRS) when enabled.
  if (config.osm_background) {
    const crsKey = (config.crs || 'EPSG:3857').trim().toUpperCase();
    const bgConf = OSM_BG_CONFIGS[crsKey] ?? OSM_BG_CONFIGS.default;
    promises.push(layerManager.processLayer(bgConf, 'background'));
  }
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

.scalebar-anchor {
  position: absolute;
  /* bottom is set reactively via :style to account for the InformationBar */
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  pointer-events: none;
  transition: bottom 0.3s ease;
}

/* OL renders into scalebar-anchor; reset its default absolute positioning */
.scalebar-anchor :deep(.ol-scale-line) {
  position: static;
  display: inline-block;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 4px 4px 0 0;
  padding: 2px 4px;
  left: unset;
  bottom: unset;
}

.scalebar-anchor :deep(.ol-scale-line-inner) {
  color: #fff;
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  border-top: none;
  font-size: 10px;
  font-family: "Segoe UI", sans-serif;
  padding: 1px 5px;
  white-space: nowrap;
  text-align: center;
}
</style>