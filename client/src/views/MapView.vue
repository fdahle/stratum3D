<template>
  <div class="app-layout">
    <MapRibbonMenu
      v-if="settingsStore.showMapRibbon"
      :is-measuring-distance="isMeasurementModalVisible && activeMeasurementType === 'distance'"
      :is-measuring-area="isMeasurementModalVisible && activeMeasurementType === 'area'"
      :is-elevation-open="isElevationModalVisible"
      @add-files="handleRibbonFiles"
      @measure-distance="onMeasureDistance"
      @measure-area="onMeasureArea"
      @elevation-profile="onElevationProfile"
    />

    <div class="content-row">
      <button class="menu-toggle" @click="isLayerPanelOpen = !isLayerPanelOpen">
        ☰
      </button>

      <div
        class="main-layerpanel-wrap"
        :class="{ open: isLayerPanelOpen }"
        :style="{ width: layerPanelWidth + 'px' }"
      >
        <LayerPanel
          class="main-layerpanel"
          @open-settings="isSettingsOpen = true"
        />
        <div class="layerpanel-resize-handle" @mousedown="startLayerPanelResize"></div>
      </div>

      <div
        v-if="isLayerPanelOpen"
        class="layerpanel-overlay"
        @click="isLayerPanelOpen = false"
      ></div>

      <div
        class="map-area"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop"
      >
      <MapWidget />
      <SearchBar />
      <div
        class="bottom-left-control"
        :class="{ 'has-info-bar': settingsStore.showInfoBar }"
      >
        <BaseMapSwitcher />
      </div>
      <InformationBar v-if="settingsStore.showInfoBar" />
      <AttributePanel />

      <!-- Drag-and-drop overlay -->
      <div v-if="isDragging" class="drop-overlay">
        <div class="drop-overlay-content">
          <div class="drop-icon">
            <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
              <path d="M12 8v8M8 12l4-4 4 4" stroke-width="1.3"/>
            </svg>
          </div>
          <div class="drop-text">Drop file to add layer</div>
        </div>
      </div>

      <!-- Notification toast -->
      <Transition name="notification">
        <div
          v-if="notification"
          class="drop-notification"
          :class="'drop-notification--' + notification.type"
        >
          {{ notification.message }}
        </div>
      </Transition>
      </div>
    </div>

    <Settings :is-open="isSettingsOpen" @close="isSettingsOpen = false" />

    <MeasurementModal
      :is-visible="isMeasurementModalVisible"
      :measurement-type="activeMeasurementType"
      :measurements="measurements"
      :points-count="measurementPointsCount"
      :current-value="currentMeasurementValue"
      @close="closeMeasurementModal"
      @reset="resetMeasurements"
      @remove-measurement="removeMeasurement"
      @save-current="saveCurrentMeasurement"
      @undo-point="undoLastPoint"
      @cancel-measurement="cancelCurrentMeasurement"
    />

    <ElevationModal
      :is-visible="isElevationModalVisible"
      :is-drawing="isElevationDrawing"
      :is-loading="isElevationLoading"
      :profile-data="elevationProfile"
      @close="closeElevationModal"
      @toggle-draw="onToggleElevationDraw"
    />
  </div>
</template>

<script setup>
import { ref, inject, markRaw, onUnmounted } from "vue";
import Draw from "ol/interaction/Draw";
import VectorLayer from "ol/layer/Vector";
import { transform as olTransform, get as getOlProjection } from "ol/proj";
import { fromBlob, fromUrl } from "geotiff";
import VectorSource from "ol/source/Vector";
import { getLength, getArea } from "ol/sphere";
import { Stroke, Style, Fill, Circle as CircleStyle } from "ol/style";
import { unByKey } from "ol/Observable";
import { useMapStore } from "../stores/map/mapStore";
import { useLayerStore } from "../stores/map/layerStore";
import AttributePanel from "../components/map/AttributePanel.vue";
import BaseMapSwitcher from "../components/map/BaseMapSwitcher.vue";
import InformationBar from "../components/map/InformationBar.vue";
import MapWidget from "../components/map/MapWidget.vue";
import SearchBar from "../components/map/SearchBar.vue";
import LayerPanel from "../components/map/LayerPanel.vue";
import MapRibbonMenu from "../components/map/MapRibbonMenu.vue";
import MeasurementModal from "../components/modals/MeasurementModal.vue";
import ElevationModal from "../components/modals/ElevationModal.vue";
import Settings from "../components/modals/Settings.vue";
import { useSettingsStore } from "../stores/settingsStore";
// Re-setup the local state
const settingsStore = useSettingsStore();
const mapStore = useMapStore();
const layerStore = useLayerStore();
const isSettingsOpen = ref(false);
const isLayerPanelOpen = ref(false);

// Layer panel resize
const LP_MIN = 180, LP_MAX = 480, LP_DEFAULT = 280;
const layerPanelWidth = ref(
  Math.min(LP_MAX, Math.max(LP_MIN, parseInt(localStorage.getItem('histmap_layerpanel_width')) || LP_DEFAULT))
);
const startLayerPanelResize = (e) => {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = layerPanelWidth.value;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  const onMove = (me) => {
    layerPanelWidth.value = Math.min(LP_MAX, Math.max(LP_MIN, startWidth + me.clientX - startX));
  };
  const onUp = () => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('histmap_layerpanel_width', String(layerPanelWidth.value));
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};

// Note: Config is now provided by App.vue, so we Inject it if needed,
// or just rely on the components using it.

// --- Drag-and-drop ---
const layerManagerRef = inject("layerManager");
const isDragging = ref(false);
const notification = ref(null);
let notificationTimer = null;

// Large-file thresholds (MiB)
const LARGE_FILE_THRESHOLD_MB = 50;
const MAX_FILE_SIZE_MB = 500;

const showNotification = (message, type = "info") => {
  clearTimeout(notificationTimer);
  notification.value = { message, type };
  notificationTimer = setTimeout(() => {
    notification.value = null;
  }, 4000);
};

const handleDragOver = (event) => {
  // Only show the drop overlay for external file drags, not internal layer reordering
  if (!event.dataTransfer?.types?.includes('Files')) return;
  isDragging.value = true;
};

const handleDragLeave = (event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    isDragging.value = false;
  }
};

const handleDrop = (event) => {
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  for (const file of files) {
    processDroppedFile(file);
  }
};

const handleRibbonFiles = (files) => {
  for (const file of files) {
    processDroppedFile(file);
  }
};

// ─── Measurement ─────────────────────────────────────────────────────────────
const isMeasurementModalVisible = ref(false);
const activeMeasurementType = ref('distance');
const measurements = ref([]);
const measurementPointsCount = ref(0);
const currentMeasurementValue = ref(null);

let measureSource = null;
let measureLayer = null;
let measureDraw = null;
let measureGeomKey = null;

const measureStyle = new Style({
  fill: new Fill({ color: 'rgba(59, 130, 246, 0.12)' }),
  stroke: new Stroke({ color: '#3b82f6', width: 2, lineDash: [6, 4] }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: '#3b82f6' }),
    stroke: new Stroke({ color: '#fff', width: 1.5 }),
  }),
});

const formatLength = (geom, projection) => {
  const len = getLength(geom, { projection });
  return len >= 1000 ? (len / 1000).toFixed(2) + ' km' : Math.round(len) + ' m';
};

const formatArea = (geom, projection) => {
  const area = getArea(geom, { projection });
  return area >= 1_000_000
    ? (area / 1_000_000).toFixed(2) + ' km\u00b2'
    : Math.round(area) + ' m\u00b2';
};

const stopMeasureMode = () => {
  const map = mapStore.getMap();
  if (measureGeomKey) { unByKey(measureGeomKey); measureGeomKey = null; }
  if (measureDraw && map) { map.removeInteraction(measureDraw); measureDraw = null; }
  if (measureLayer && map) { map.removeLayer(measureLayer); measureLayer = null; }
  measureSource = null;
  measurements.value = [];
  measurementPointsCount.value = 0;
  currentMeasurementValue.value = null;
};

const startMeasureMode = (type) => {
  const map = mapStore.getMap();
  if (!map) return;
  // Stop current draw interaction (keep saved features on layer)
  if (measureGeomKey) { unByKey(measureGeomKey); measureGeomKey = null; }
  if (measureDraw) { map.removeInteraction(measureDraw); measureDraw = null; }
  // Reuse existing layer or create fresh one
  if (!measureLayer) {
    const source = new VectorSource();
    measureSource = source;
    measureLayer = markRaw(new VectorLayer({ source, style: measureStyle, zIndex: 9999 }));
    map.addLayer(measureLayer);
  }
  const projection = map.getView().getProjection();
  const geomType = type === 'distance' ? 'LineString' : 'Polygon';
  const draw = new Draw({ source: measureSource, type: geomType, style: measureStyle });

  draw.on('drawstart', (evt) => {
    measurementPointsCount.value = 0;
    currentMeasurementValue.value = null;
    measureGeomKey = evt.feature.getGeometry().on('change', (e) => {
      const geom = e.target;
      if (type === 'distance') {
        const coords = geom.getCoordinates();
        // Last coord is the live cursor — not a committed click
        const count = Math.max(0, coords.length - 1);
        measurementPointsCount.value = count;
        if (count >= 2) currentMeasurementValue.value = formatLength(geom, projection);
      } else {
        const ring = geom.getCoordinates()[0];
        // Polygon ring during drawing: [p1,...,pN, cursor, p1(close)] → n+2 length
        const count = Math.max(0, ring.length - 2);
        measurementPointsCount.value = count;
        if (count >= 3) currentMeasurementValue.value = formatArea(geom, projection);
      }
    });
  });

  draw.on('drawend', (evt) => {
    if (measureGeomKey) { unByKey(measureGeomKey); measureGeomKey = null; }
    const geom = evt.feature.getGeometry();
    const value = type === 'distance'
      ? formatLength(geom, projection)
      : formatArea(geom, projection);
    measurements.value.push({
      type,
      value,
      feature: markRaw(evt.feature),
      timestamp: new Date().toISOString(),
    });
    measurementPointsCount.value = 0;
    currentMeasurementValue.value = null;
  });

  measureDraw = draw;
  map.addInteraction(draw);
};

const onMeasureDistance = () => {
  if (isMeasurementModalVisible.value && activeMeasurementType.value === 'distance') {
    closeMeasurementModal();
  } else {
    layerManagerRef.value?.setSelectionActive(false);
    if (isMeasurementModalVisible.value) {
      if (measureDraw) measureDraw.abortDrawing();
      measurementPointsCount.value = 0;
      currentMeasurementValue.value = null;
    }
    activeMeasurementType.value = 'distance';
    isMeasurementModalVisible.value = true;
    startMeasureMode('distance');
  }
};

const onMeasureArea = () => {
  if (isMeasurementModalVisible.value && activeMeasurementType.value === 'area') {
    closeMeasurementModal();
  } else {
    layerManagerRef.value?.setSelectionActive(false);
    if (isMeasurementModalVisible.value) {
      if (measureDraw) measureDraw.abortDrawing();
      measurementPointsCount.value = 0;
      currentMeasurementValue.value = null;
    }
    activeMeasurementType.value = 'area';
    isMeasurementModalVisible.value = true;
    startMeasureMode('area');
  }
};

const closeMeasurementModal = () => {
  isMeasurementModalVisible.value = false;
  stopMeasureMode();
  layerManagerRef.value?.setSelectionActive(true);
};

const resetMeasurements = () => {
  measurements.value = [];
  if (measureSource) measureSource.clear();
  measurementPointsCount.value = 0;
  currentMeasurementValue.value = null;
  if (measureDraw) measureDraw.abortDrawing();
};

const removeMeasurement = (index) => {
  const m = measurements.value[index];
  if (m?.feature && measureSource) measureSource.removeFeature(m.feature);
  measurements.value.splice(index, 1);
};

const saveCurrentMeasurement = () => {
  const minPts = activeMeasurementType.value === 'distance' ? 2 : 3;
  if (measureDraw && measurementPointsCount.value >= minPts) {
    measureDraw.finishDrawing();
  }
};

const undoLastPoint = () => {
  if (measureDraw) measureDraw.removeLastPoint();
};

const cancelCurrentMeasurement = () => {
  if (measureDraw) measureDraw.abortDrawing();
  measurementPointsCount.value = 0;
  currentMeasurementValue.value = null;
};

onUnmounted(stopMeasureMode);

// ─── Elevation Profile ────────────────────────────────────────────────────────
const isElevationModalVisible = ref(false);
const isElevationDrawing = ref(false);
const isElevationLoading = ref(false);
const elevationProfile = ref(null);

let elevationDrawInteraction = null;
let elevationDrawLayer = null;
let elevationDrawSource = null;

const elevationLineStyle = new Style({
  stroke: new Stroke({ color: '#f59e0b', width: 2, lineDash: [6, 4] }),
  image: new CircleStyle({
    radius: 4,
    fill: new Fill({ color: '#f59e0b' }),
    stroke: new Stroke({ color: '#fff', width: 1.5 }),
  }),
});

const stopElevationDraw = () => {
  const map = mapStore.getMap();
  if (elevationDrawInteraction && map) {
    map.removeInteraction(elevationDrawInteraction);
    elevationDrawInteraction = null;
  }
  if (elevationDrawLayer && map) {
    map.removeLayer(elevationDrawLayer);
    elevationDrawLayer = null;
    elevationDrawSource = null;
  }
  isElevationDrawing.value = false;
};

const onElevationProfile = () => {
  if (isElevationModalVisible.value) {
    closeElevationModal();
  } else {
    layerManagerRef.value?.setSelectionActive(false);
    isElevationModalVisible.value = true;
  }
};

const closeElevationModal = () => {
  isElevationModalVisible.value = false;
  stopElevationDraw();
  elevationProfile.value = null;
  layerManagerRef.value?.setSelectionActive(true);
};

const onToggleElevationDraw = (layerId) => {
  if (isElevationDrawing.value) {
    stopElevationDraw();
    return;
  }
  const map = mapStore.getMap();
  if (!map || !layerId) return;

  isElevationDrawing.value = true;
  elevationProfile.value = null;

  elevationDrawSource = new VectorSource();
  elevationDrawLayer = markRaw(new VectorLayer({
    source: elevationDrawSource,
    style: elevationLineStyle,
    zIndex: 9998,
  }));
  map.addLayer(elevationDrawLayer);

  const draw = new Draw({ source: elevationDrawSource, type: 'LineString', style: elevationLineStyle, maxPoints: 50 });
  draw.on('drawend', async (evt) => {
    map.removeInteraction(elevationDrawInteraction);
    elevationDrawInteraction = null;
    isElevationDrawing.value = false;

    const geom = evt.feature.getGeometry();
    isElevationLoading.value = true;
    try {
      elevationProfile.value = await computeElevationProfile(layerId, geom);
    } catch (e) {
      console.error('Elevation profile failed:', e.message);
    } finally {
      isElevationLoading.value = false;
    }
  });

  elevationDrawInteraction = draw;
  map.addInteraction(draw);
};

const _sampleLinePoints = (coords, numSamples) => {
  if (coords.length < 2) return coords.slice();
  const segs = [];
  let totalLen = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1][0] - coords[i][0];
    const dy = coords[i + 1][1] - coords[i][1];
    const len = Math.sqrt(dx * dx + dy * dy);
    segs.push({ s: coords[i], e: coords[i + 1], cumLen: totalLen, len });
    totalLen += len;
  }
  if (totalLen === 0) return [coords[0]];
  const pts = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = (i / numSamples) * totalLen;
    let seg = segs[segs.length - 1];
    for (const s of segs) {
      if (s.cumLen + s.len >= t - 1e-10) { seg = s; break; }
    }
    const u = seg.len > 0 ? Math.min(1, (t - seg.cumLen) / seg.len) : 0;
    pts.push([seg.s[0] + u * (seg.e[0] - seg.s[0]), seg.s[1] + u * (seg.e[1] - seg.s[1])]);
  }
  return pts;
};

const _bilinear = (data, w, h, fx, fy, noData) => {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)));
  const y1 = Math.min(h - 1, y0 + 1);
  const wx = fx - x0, wy = fy - y0;
  const vs = [data[y0 * w + x0], data[y0 * w + x1], data[y1 * w + x0], data[y1 * w + x1]];
  if (vs.some(v => !isFinite(v) || (noData !== null && noData !== undefined && v === noData))) return NaN;
  return vs[0] * (1 - wx) * (1 - wy) + vs[1] * wx * (1 - wy) + vs[2] * (1 - wx) * wy + vs[3] * wx * wy;
};

const computeElevationProfile = async (layerId, lineGeom) => {
  const layerObj = layerStore.getLayerById(layerId);
  if (!layerObj) throw new Error('Layer not found');

  const meta = layerObj.metadata ?? {};
  const { file, extent, tiffProjection, noDataValue } = meta;
  const mapCRS = mapStore.getMap().getView().getProjection().getCode();
  const totalLength = getLength(lineGeom, { projection: mapCRS });

  const NUM_SAMPLES = 300;
  const mapCoords = lineGeom.getCoordinates();
  const samplePts = _sampleLinePoints(mapCoords, NUM_SAMPLES);

  // Transform sample points from map CRS to tiff CRS (if necessary)
  let tiffPts = samplePts;
  if (tiffProjection && tiffProjection !== mapCRS) {
    const fromProj = getOlProjection(mapCRS);
    const toProj   = getOlProjection(tiffProjection);
    if (fromProj && toProj) {
      tiffPts = samplePts.map(pt => olTransform(pt, mapCRS, tiffProjection));
    }
  }

  // Bounding box of sample points with padding
  const xs = tiffPts.map(p => p[0]);
  const ys = tiffPts.map(p => p[1]);
  const pad = 1e-6;
  const bbox = [
    Math.min(...xs) - pad, Math.min(...ys) - pad,
    Math.max(...xs) + pad, Math.max(...ys) + pad,
  ];

  // Open the tiff (prefer File blob for local drag-dropped files)
  let tiff;
  if (file) {
    tiff = await fromBlob(file);
  } else if (layerObj.url) {
    tiff = await fromUrl(layerObj.url);
  } else {
    throw new Error('No data source available for this layer');
  }

  const image = await tiff.getImage();
  const imgW = image.getWidth();
  const imgH = image.getHeight();

  // Determine read resolution: cap at 1024, scale proportionally to bbox aspect ratio
  const bboxW = bbox[2] - bbox[0];
  const bboxH = bbox[3] - bbox[1];
  const aspect = bboxW > 0 && bboxH > 0 ? bboxW / bboxH : 1;
  const MAX_RES = 1024;
  const readW = Math.max(4, Math.min(MAX_RES, Math.round(aspect >= 1 ? MAX_RES : MAX_RES * aspect), imgW));
  const readH = Math.max(4, Math.min(MAX_RES, Math.round(aspect >= 1 ? MAX_RES / aspect : MAX_RES), imgH));

  const [raster] = await image.readRasters({
    bbox,
    width: readW,
    height: readH,
    samples: [0],
    resampleMethod: 'bilinear',
  });

  // Sample elevations along the profile
  const elevations = tiffPts.map(([x, y]) => {
    const fx = ((x - bbox[0]) / (bbox[2] - bbox[0])) * (readW - 1);
    const fy = ((bbox[3] - y) / (bbox[3] - bbox[1])) * (readH - 1);
    if (fx < 0 || fx > readW - 1 || fy < 0 || fy > readH - 1) return NaN;
    return _bilinear(raster, readW, readH, fx, fy, noDataValue);
  });

  return { elevations, totalLength };
};

onUnmounted(stopElevationDraw);

/**
 * Spawn a short-lived Web Worker that uses geotiff.js fromBlob() (efficient
 * random-access via Blob.slice()) to validate the file and extract its
 * extent, projection, etc. — all off the main thread.
 */
const parseGeoTIFFInWorker = (file, layerName) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/geotiffWorker.js", import.meta.url),
      { type: "module" },
    );

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("File parsing timed out"));
    }, 60_000);

    worker.onmessage = (e) => {
      const { type, metadata, error, message } = e.data;
      if (type === "PROGRESS") {
        showNotification(`${layerName}: ${message}`, "info");
      } else if (type === "COMPLETE") {
        clearTimeout(timeout);
        worker.terminate();
        resolve(metadata);
      } else if (type === "ERROR") {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(error));
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(err.message || "Failed to parse GeoTIFF"));
    };

    worker.postMessage({ file, layerId: layerName });
  });
};

const processDroppedFile = async (file) => {
  const nameLower = file.name.toLowerCase();
  if (nameLower.endsWith(".tif") || nameLower.endsWith(".tiff")) {
    if (!layerManagerRef?.value) {
      showNotification("Map is not yet initialized. Try again in a moment.", "error");
      return;
    }

    const layerName = file.name.replace(/\.[^.]+$/, "");
    const sizeMB = file.size / (1024 * 1024);

    // Hard limit to prevent browser OOM crashes
    if (sizeMB > MAX_FILE_SIZE_MB) {
      showNotification(
        `File is too large (${sizeMB.toFixed(0)} MB). Use the preprocessing pipeline for files over ${MAX_FILE_SIZE_MB} MB.`,
        "error",
      );
      return;
    }

    showNotification(
      sizeMB > LARGE_FILE_THRESHOLD_MB
        ? `Loading large file (${sizeMB.toFixed(0)} MB)…`
        : `Loading ${layerName}…`,
      "info",
    );

    // Yield so Vue can render the notification before any heavy work
    await new Promise((r) => requestAnimationFrame(r));

    try {
      // --- Pre-parse in a worker (validates file, extracts metadata) ---
      const metadata = await parseGeoTIFFInWorker(file, layerName);

      // Warn about non-COG files that will be slow to render
      if (!metadata.hasOverviews && sizeMB > LARGE_FILE_THRESHOLD_MB) {
        showNotification(
          `${layerName}: large file without overviews – rendering may be slow. Consider converting to Cloud Optimized GeoTIFF.`,
          "warning",
        );
        // Brief pause so the warning is visible before the layer creation work
        await new Promise((r) => setTimeout(r, 150));
      }

      // --- Create OL layer ---
      // Keep the blob URL for download functionality; pass the File object
      // separately so the GeoTIFF source can use fromBlob() instead of fetch
      // (blob: URLs don't support HTTP range requests — they cause tile failures).
      const blobUrl = URL.createObjectURL(file);
      await layerManagerRef.value.processLayer(
        {
          type: "geotiff", url: blobUrl, file: file, name: layerName, visible: true,
          bandCount: metadata.bands,
          dataMin: metadata.dataMin,
          dataMax: metadata.dataMax,
          extent: metadata.extent,
          tiffProjection: metadata.projection,
        },
        "overlay",
      );

      showNotification(`Added layer: ${layerName}`, "success");

      // Fit the map using pre-extracted metadata — avoids the blocking
      // source.getView() call that would re-read the blob on the main thread.
      if (metadata.extent) {
        const olMap = mapStore.getMap();
        if (olMap) {
          const fitOptions = { duration: 800, padding: [50, 50, 50, 50] };
          if (metadata.projection) {
            fitOptions.projection = metadata.projection;
          }
          olMap.getView().fit(metadata.extent, fitOptions);
        }
      }
    } catch (e) {
      showNotification(`Failed to load ${layerName}: ${e.message}`, "error");
    }
  } else {
    const ext = file.name.includes(".")
      ? file.name.split(".").pop().toUpperCase()
      : "Unknown";
    showNotification(`.${ext} files are not supported yet.`, "warning");
  }
};
</script>

<style scoped>
/* --- DEFAULT DESKTOP STYLES --- */
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
}

.content-row {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

.main-layerpanel-wrap {
  position: relative;
  flex-shrink: 0;
  z-index: 2000;
}

.main-layerpanel {
  width: 100%;
  height: 100%;
}

.layerpanel-resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 2001;
  background: transparent;
  transition: background 0.15s;
}

.layerpanel-resize-handle:hover {
  background: rgba(100, 100, 100, 0.18);
}

.map-area {
  flex: 1;
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.menu-toggle {
  display: none;
}

.layerpanel-overlay {
  display: none;
}

/* --- CONTROL POSITIONING --- */
.bottom-left-control {
  position: absolute;
  bottom: 25px;
  left: 20px;
  z-index: 1000;
  transition: bottom 0.3s ease; /* Smooth animation */
}

/* 4. ADDED: Moves switcher up when InfoBar is visible */
.bottom-left-control.has-info-bar {
  bottom: 40px; /* 28px bar + 12px gap */
}

/* --- MOBILE STYLES (Max Width 768px) --- */
@media (max-width: 768px) {
  .menu-toggle {
    display: block;
    position: absolute;
    top: 15px;
    left: 15px;
    z-index: 3000;
    background: white;
    border: none;
    font-size: 24px;
    padding: 8px 12px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  .theme-dark .menu-toggle {
    background: #2a2a2a;
    color: #e0e0e0;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
  }

  .main-layerpanel-wrap {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    transform: translateX(-100%);
    transition: transform 0.3s ease-in-out;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
  }

  .main-layerpanel-wrap.open {
    transform: translateX(0);
  }

  .layerpanel-resize-handle {
    display: none;
  }

  .layerpanel-overlay {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1500;
    backdrop-filter: blur(2px);
  }

  .bottom-left-control {
    bottom: 30px;
    left: 10px;
    transform: scale(0.9);
    transform-origin: bottom left;
  }

  /* Adjust mobile spacing for InfoBar */
  .bottom-left-control.has-info-bar {
    bottom: 45px;
  }

  .attribute-panel {
    width: 100% !important;
    height: 50% !important;
    top: auto !important;
    bottom: 0 !important;
    border-top: 2px solid #ddd;
  }
}

/* --- DRAG AND DROP --- */
.drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(30, 100, 200, 0.18);
  border: 3px dashed #3388ff;
  border-radius: 4px;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drop-overlay-content {
  text-align: center;
  color: #1a4fa0;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 12px;
  padding: 32px 48px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
}

.theme-dark .drop-overlay-content {
  color: #90c8ff;
  background: rgba(30, 40, 60, 0.92);
}

.drop-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.drop-text {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 6px;
}

.drop-subtext {
  font-size: 13px;
  opacity: 0.7;
}

.drop-notification {
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5000;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  pointer-events: none;
}

.drop-notification--success {
  background: #2e7d32;
  color: #fff;
}

.drop-notification--warning {
  background: #e65100;
  color: #fff;
}

.drop-notification--error {
  background: #c62828;
  color: #fff;
}

.drop-notification--info {
  background: #1565c0;
  color: #fff;
}

.notification-enter-active,
.notification-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.notification-enter-from,
.notification-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-family: sans-serif;
  color: #666;
}

.theme-dark .loading {
  color: #999;
}

/* Error screen styles are in assets/error-screen.css (imported globally in App.vue) */
</style>