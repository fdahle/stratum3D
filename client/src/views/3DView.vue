<template>
  <div class="viewer-3d-view">
    <!-- Ribbon menu at top -->
    <RibbonMenu 
      :is-measuring-distance="isMeasurementModalVisible && activeMeasurementType === 'distance'"
      :is-measuring-area="isMeasurementModalVisible && activeMeasurementType === 'area'"
      @load-model="handleLoadModel"
      @load-pointcloud="handleLoadPointCloud"
      @load-cameras="handleLoadCameras"
      @load-markers="handleLoadMarkers"
      @reset-camera="onResetCamera"
      @fit-to-scene="onFitToScene"
      @view-top="onViewTop"
      @view-front="onViewFront"
      @view-right="onViewRight"
      @measure-distance="onMeasureDistance"
      @measure-area="onMeasureArea"
    />

    <!-- Body: Layer panel + Canvas -->
    <div class="viewer-body">
      <!-- Layer Manager fixed at left -->
      <LayerManager 
        ref="layerManagerRef"
        @toggle-layer-visibility="onToggleLayerVisibility"
        @remove-layer="onRemoveLayer"
        @zoom-to-layer="onZoomToLayer"
      />

      <!-- Main 3D canvas -->
      <div class="canvas-area">
        <Viewer3DCanvas 
          ref="canvasRef"
          :model-urls="modelUrls"
          :pointcloud-urls="pointcloudUrls"
          :coordinates="coordinates"
          :model-name="modelName"
          @scene-ready="onSceneReady"
          @model-loaded="onModelLoaded"
          @loading-error="onLoadingError"
          @loading-progress="onLoadingProgress"
          @parsing-started="onParsingStarted"
          @parsing-progress="onParsingProgress"
          @building-geometry="onBuildingGeometry"
        />

        <!-- Loading indicator -->
        <div v-if="isLoading" class="loading-overlay">
          <div class="loading-content">
            <div class="spinner"></div>
            <p class="loading-title">{{ loadingTitle }}</p>
            <div class="progress-bar-container">
              <div 
                class="progress-bar" 
                :class="{ parsing: isParsing }"
                :style="{ width: loadingProgress + '%' }"
              ></div>
            </div>
            <p class="loading-status">{{ loadingStatus }}</p>
            <button class="stop-btn" @click="handleStopLoading">&#9632; Stop</button>
          </div>
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="error-toast">
          <span>{{ errorMessage }}</span>
          <button @click="errorMessage = null">&#10005;</button>
        </div>
      </div>
    </div>

    <!-- Measurement Modal -->
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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useViewer3DStore } from '@/stores/viewer3D/viewer3dStore';
import { logger } from '@/utils/logger';
import Viewer3DCanvas from '@/components/viewer3D/Canvas.vue';
import RibbonMenu from '@/components/viewer3D/RibbonMenu.vue';
import LayerManager from '@/components/viewer3D/LayerManager.vue';
import MeasurementModal from '@/components/modals/MeasurementModal.vue';

const route = useRoute();
const canvasRef = ref(null);
const layerManagerRef = ref(null);
const isLoading = ref(false);
const loadingProgress = ref(0);
const loadingStatus = ref('');
const loadingTitle = ref('Loading...');
const isParsing = computed(() => loadingStatus.value.includes('Parsing'));
const errorMessage = ref(null);

const viewer3DStore = useViewer3DStore();
const { cleanup, startMeasurement } = viewer3DStore;

// Measurement state
const isMeasurementModalVisible = ref(false);
const activeMeasurementType = ref('distance'); // 'distance' or 'area'
const measurements = ref([]);
const measurementPointsCount = ref(0);
const currentMeasurementValue = ref(null);

// Load viewer data from localStorage (written by AttributePanel before opening this tab)
const _stored = (() => {
  try {
    const raw = localStorage.getItem('histmap_viewer3d');
    if (raw) {
      const data = JSON.parse(raw);
      localStorage.removeItem('histmap_viewer3d');
      return data;
    }
  } catch (e) {
    logger.warn('3DView', 'Failed to read viewer data from localStorage', e);
  }
  return {};
})();

const modelName = route.query.n || 'Model';
const modelUrls = ref(_stored.models || []);
const pointcloudUrls = ref(_stored.pointclouds || []);
const coordinates = ref({ x: _stored.x || 0, y: _stored.y || 0 });

// Scene events
const onSceneReady = () => {
  logger.info('3DView', '3D scene initialized and ready');
  if (modelUrls.value.length > 0) {
    isLoading.value = true;
    loadingTitle.value = 'Loading 3D Model...';
  }
};

const onLoadingProgress = ({ url, index, loaded, total, progress, status }) => {
  loadingProgress.value = progress;
  const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
  const totalMB = (total / (1024 * 1024)).toFixed(1);
  
  if (status === 'downloading') {
    loadingStatus.value = `Downloading model ${index + 1}/${modelUrls.value.length}: ${loadedMB}MB / ${totalMB}MB (${progress}%)`;
  } else if (status === 'decoding') {
    loadingStatus.value = `Decoding model data (${totalMB}MB)...`;
  } else if (status === 'reading') {
    const fileName = url.split('/').pop();
    loadingStatus.value = `Reading ${fileName}: ${loadedMB}MB / ${totalMB}MB (${progress}%)`;
  } else if (status === 'parsing') {
    const fileName = url.split('/').pop();
    loadingStatus.value = `Parsing ${fileName}...`;
  }
};

const onParsingStarted = ({ index, size }) => {
  const sizeMB = (size / (1024 * 1024)).toFixed(1);
  if (modelUrls.value.length > 0) {
    loadingStatus.value = `Parsing model ${index + 1}/${modelUrls.value.length} (${sizeMB}MB)...`;
  } else {
    loadingStatus.value = `Parsing (${sizeMB}MB)...`;
  }
  loadingProgress.value = 0;
};

const onParsingProgress = ({ index, progress, processed, total }) => {
  loadingProgress.value = progress;
  const processedK = (processed / 1000).toFixed(0);
  const totalK = (total / 1000).toFixed(0);
  loadingStatus.value = `Parsing model ${index + 1}/${modelUrls.value.length}: ${processedK}k / ${totalK}k lines (${progress}%)`;
};

const onBuildingGeometry = ({ index, stage, vertices, faces, triangles }) => {
  loadingProgress.value = 100;
  
  if (stage === 'geometry') {
    loadingStatus.value = `Building geometry: ${vertices?.toLocaleString()} vertices, ${faces?.toLocaleString()} faces...`;
  } else if (stage === 'triangulation') {
    loadingStatus.value = `Triangulating ${faces?.toLocaleString()} faces...`;
  } else if (stage === 'buffers') {
    loadingStatus.value = `Creating GPU buffers: ${triangles?.toLocaleString()} triangles...`;
  } else if (stage === 'normals') {
    loadingStatus.value = `Computing vertex normals...`;
  } else if (stage === 'finalizing') {
    loadingStatus.value = `Finalizing model...`;
  }
};

const onModelLoaded = ({ url, index, object }) => {
  logger.info('3DView', `Model loaded: ${url}${modelUrls.value.length > 0 ? ` (${index + 1}/${modelUrls.value.length})` : ''}`);
  logger.debug('3DView', 'Object:', object, 'LayerManager ref:', layerManagerRef.value);
  
  // Add to layer manager
  if (layerManagerRef.value && object) {
    let layerName = url.split('/').pop() || `Model ${index + 1}`;
    const layerType = object.userData?.type || 
                      (object.isPoints ? 'pointcloud' : 'model');
    
    // Add camera count to layer name if it's a camera group
    if (layerType === 'camera' && object.userData?.cameraCount) {
      layerName = `${layerName} (${object.userData.cameraCount} cameras)`;
    }
    
    logger.debug('3DView', `Adding to layer manager: ${layerName} (type: ${layerType})`);
    
    layerManagerRef.value.addLayer({
      id: object.uuid,
      name: layerName,
      type: layerType,
      visible: true,
      object: object
    });
  } else {
    logger.warn('3DView', 'Could not add to layer manager:', { layerManagerRef: layerManagerRef.value, object });
  }
  
  // For URL-based loading, hide loading indicator when all models are loaded
  if (modelUrls.value.length > 0 && index === modelUrls.value.length - 1) {
    isLoading.value = false;
    loadingProgress.value = 0;
    loadingStatus.value = '';
    loadingTitle.value = 'Loading...';
  } else if (modelUrls.value.length === 0) {
    // For file-based loading, hide loading indicator after a short delay
    setTimeout(() => {
      isLoading.value = false;
      loadingProgress.value = 0;
      loadingStatus.value = '';
      loadingTitle.value = 'Loading...';
    }, 500);
  }
};

const handleLoadMarkers = (file) => {
  if (canvasRef.value?.loadMarkersFile) {
    canvasRef.value.loadMarkersFile(file);
  }
};

const onLoadingError = ({ url, error }) => {
  logger.error('3DView', 'Loading error:', error);
  errorMessage.value = `Failed to load: ${error}`;
  isLoading.value = false;
  loadingProgress.value = 0;
  loadingStatus.value = '';
  loadingTitle.value = 'Loading...';
  
  setTimeout(() => {
    errorMessage.value = null;
  }, 5000);
};

// View toggle events (handled directly by RibbonMenu via the Pinia store)

const onResetCamera = () => {
  if (canvasRef.value && canvasRef.value.resetToInitialCamera) {
    canvasRef.value.resetToInitialCamera();
  }
};

// Camera preset views
const onViewTop = () => {
  if (canvasRef.value && canvasRef.value.setCameraPreset) {
    canvasRef.value.setCameraPreset('top');
  }
};

const onViewFront = () => {
  if (canvasRef.value && canvasRef.value.setCameraPreset) {
    canvasRef.value.setCameraPreset('front');
  }
};

const onViewRight = () => {
  if (canvasRef.value && canvasRef.value.setCameraPreset) {
    canvasRef.value.setCameraPreset('right');
  }
};

// Measurement events
const onMeasureDistance = () => {
  // Toggle measurement mode
  if (isMeasurementModalVisible.value && activeMeasurementType.value === 'distance') {
    // If already in distance mode, close it
    closeMeasurementModal();
  } else {
    // Switch to distance mode (clear previous measurements when switching)
    if (isMeasurementModalVisible.value && activeMeasurementType.value !== 'distance') {
      measurements.value = [];
      // Clear visual measurements in canvas when switching modes
      if (canvasRef.value && canvasRef.value.clearMeasurements) {
        canvasRef.value.clearMeasurements();
      }
    }
    activeMeasurementType.value = 'distance';
    isMeasurementModalVisible.value = true;
    measurementPointsCount.value = 0;
    currentMeasurementValue.value = null;
    
    startMeasurement('distance');
    if (canvasRef.value && canvasRef.value.enableMeasurementMode) {
      canvasRef.value.enableMeasurementMode('distance', handleMeasurementUpdate);
    }
  }
};

const onMeasureArea = () => {
  // Toggle measurement mode
  if (isMeasurementModalVisible.value && activeMeasurementType.value === 'area') {
    // If already in area mode, close it
    closeMeasurementModal();
  } else {
    // Switch to area mode (clear previous measurements when switching)
    if (isMeasurementModalVisible.value && activeMeasurementType.value !== 'area') {
      measurements.value = [];
      // Clear visual measurements in canvas when switching modes
      if (canvasRef.value && canvasRef.value.clearMeasurements) {
        canvasRef.value.clearMeasurements();
      }
    }
    activeMeasurementType.value = 'area';
    isMeasurementModalVisible.value = true;
    measurementPointsCount.value = 0;
    currentMeasurementValue.value = null;
    
    startMeasurement('area');
    if (canvasRef.value && canvasRef.value.enableMeasurementMode) {
      canvasRef.value.enableMeasurementMode('area', handleMeasurementUpdate);
    }
  }
};

const handleMeasurementUpdate = (data) => {
  // Update measurement data from canvas
  measurementPointsCount.value = data.pointsCount || 0;
  currentMeasurementValue.value = data.value || null;
  
  // If measurement is complete, add to list
  if (data.complete && data.value) {
    measurements.value.push({
      type: activeMeasurementType.value,
      value: data.value,
      timestamp: new Date().toISOString()
    });
    // Reset for next measurement
    measurementPointsCount.value = 0;
    currentMeasurementValue.value = null;
  }
};

const closeMeasurementModal = () => {
  isMeasurementModalVisible.value = false;
  measurementPointsCount.value = 0;
  currentMeasurementValue.value = null;
  
  // Clear all measurements when toggling off
  measurements.value = [];
  
  // Disable measurement mode in canvas and clear visual markers
  if (canvasRef.value && canvasRef.value.disableMeasurementMode) {
    canvasRef.value.disableMeasurementMode();
  }
  if (canvasRef.value && canvasRef.value.clearMeasurements) {
    canvasRef.value.clearMeasurements();
  }
};

const resetMeasurements = () => {
  measurements.value = [];
  measurementPointsCount.value = 0;
  currentMeasurementValue.value = null;
  
  // Clear visual measurements in canvas
  if (canvasRef.value && canvasRef.value.clearMeasurements) {
    canvasRef.value.clearMeasurements();
  }
};

const removeMeasurement = (index) => {
  // Remove from data
  measurements.value.splice(index, 1);
  // Remove visual objects from scene
  if (canvasRef.value && canvasRef.value.removeSavedMeasurement) {
    canvasRef.value.removeSavedMeasurement(index);
  }
};

const saveCurrentMeasurement = () => {
  if (canvasRef.value && canvasRef.value.saveCurrentMeasurement) {
    canvasRef.value.saveCurrentMeasurement();
  }
};

const undoLastPoint = () => {
  if (canvasRef.value && canvasRef.value.undoLastPoint) {
    canvasRef.value.undoLastPoint();
  }
};

const cancelCurrentMeasurement = () => {
  if (canvasRef.value && canvasRef.value.cancelCurrentMeasurement) {
    canvasRef.value.cancelCurrentMeasurement();
  }
};

// File loading from ribbon menu
const handleLoadModel = (file) => {
  if (canvasRef.value) {
    isLoading.value = true;
    loadingTitle.value = 'Loading 3D Model...';
    loadingStatus.value = `Loading model: ${file.name}...`;
    loadingProgress.value = 0;
    canvasRef.value.loadUserObjFile(file);
  }
};

const handleLoadPointCloud = (file) => {
  if (canvasRef.value && canvasRef.value.loadPointCloudFile) {
    isLoading.value = true;
    loadingTitle.value = 'Loading Point Cloud...';
    loadingStatus.value = `Loading point cloud: ${file.name}...`;
    loadingProgress.value = 0;
    canvasRef.value.loadPointCloudFile(file);
  } else {
    showError('Point cloud loading not yet implemented.');
  }
};

const handleLoadCameras = (file) => {
  if (canvasRef.value && canvasRef.value.loadCamerasFile) {
    isLoading.value = true;
    loadingTitle.value = 'Loading Cameras...';
    loadingStatus.value = `Loading cameras: ${file.name}...`;
    loadingProgress.value = 0;
    canvasRef.value.loadCamerasFile(file);
  } else {
    showError('Camera loading not yet implemented.');
  }
};

const onFitToScene = () => {
  if (canvasRef.value && canvasRef.value.fitCameraToScene) {
    canvasRef.value.fitCameraToScene();
  }
};

const onToggleLayerVisibility = ({ layerId, visible }) => {
  if (canvasRef.value && canvasRef.value.toggleLayerVisibility) {
    canvasRef.value.toggleLayerVisibility(layerId, visible);
  }
};

const onRemoveLayer = (layerId) => {
  if (canvasRef.value && canvasRef.value.removeLayer) {
    canvasRef.value.removeLayer(layerId);
  }
};

const onZoomToLayer = (layer) => {
  if (canvasRef.value && canvasRef.value.zoomToLayer && layer) {
    canvasRef.value.zoomToLayer(layer.id);
  }
};

const showError = (msg) => {
  errorMessage.value = msg;
  setTimeout(() => { errorMessage.value = null; }, 3000);
};

const handleStopLoading = () => {
  if (canvasRef.value?.cancelLoading) {
    canvasRef.value.cancelLoading();
  }
  isLoading.value = false;
  loadingProgress.value = 0;
  loadingStatus.value = '';
  loadingTitle.value = 'Loading...';
};
</script>

<style scoped>
.viewer-3d-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #1a1a1a;
  font-family: "Segoe UI", sans-serif;
}

.theme-light .viewer-3d-view {
  background: #f5f5f5;
}

.viewer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(5px);
}

.theme-light .loading-overlay {
  background: rgba(255, 255, 255, 0.8);
}

.loading-content {
  text-align: center;
  color: white;
  min-width: 400px;
  max-width: 500px;
  padding: 30px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.theme-light .loading-content {
  color: #1a1a1a;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.theme-light .spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #3b82f6;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  font-family: "Segoe UI", sans-serif;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.theme-light .progress-bar-container {
  background: rgba(0, 0, 0, 0.1);
}

.progress-bar {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-bar.parsing {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-status {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-family: "Segoe UI", sans-serif;
}

.theme-light .loading-status {
  color: rgba(0, 0, 0, 0.6);
}

.stop-btn {
  margin-top: 16px;
  padding: 7px 20px;
  background: rgba(220, 53, 69, 0.85);
  color: white;
  border: 1px solid rgba(220, 53, 69, 0.6);
  border-radius: 6px;
  font-size: 13px;
  font-family: "Segoe UI", sans-serif;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.stop-btn:hover {
  background: #dc3545;
  transform: scale(1.03);
}

.stop-btn:active {
  transform: scale(0.97);
}

.theme-light .stop-btn {
  background: rgba(220, 53, 69, 0.9);
}

.error-toast {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #dc3545;
  color: white;
  padding: 10px 16px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 2000;
  font-size: 13px;
  font-family: "Segoe UI", sans-serif;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translate(-50%, 60px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

.error-toast button {
  background: none;
  border: none;
  color: white;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.error-toast button:hover {
  opacity: 1;
}
</style>
