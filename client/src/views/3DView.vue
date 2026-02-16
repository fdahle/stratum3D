<template>
  <div class="viewer-3d-view">
    <!-- Ribbon menu at top -->
    <RibbonMenu 
      @load-model="handleLoadModel"
      @load-pointcloud="handleLoadPointCloud"
      @load-cameras="handleLoadCameras"
      @toggle-wireframe="onToggleWireframe"
      @toggle-bounding-box="onToggleBoundingBox"
      @toggle-grid="onToggleGrid"
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
          </div>
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="error-toast">
          <span>{{ errorMessage }}</span>
          <button @click="errorMessage = null">&#10005;</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useViewer3D } from '@/composables/useViewer3D.js';
import Viewer3DCanvas from '@/components/viewer3D/Canvas.vue';
import RibbonMenu from '@/components/viewer3D/RibbonMenu.vue';
import LayerManager from '@/components/viewer3D/LayerManager.vue';

const route = useRoute();
const canvasRef = ref(null);
const layerManagerRef = ref(null);
const isLoading = ref(false);
const loadingProgress = ref(0);
const loadingStatus = ref('');
const loadingTitle = ref('Loading...');
const isParsing = computed(() => loadingStatus.value.includes('Parsing'));
const errorMessage = ref(null);

const { cleanup, startMeasurement } = useViewer3D();

// Parse route params
const x = computed(() => parseFloat(route.query.x) || 0);
const y = computed(() => parseFloat(route.query.y) || 0);
const modelUrls = computed(() => 
  route.query.models ? route.query.models.split(',').filter(u => u) : []
);
const pointcloudUrls = computed(() => 
  route.query.pointclouds ? route.query.pointclouds.split(',').filter(u => u) : []
);
const modelName = computed(() => route.query.name || 'Model');
const coordinates = computed(() => ({ 
  x: x.value, 
  y: y.value 
}));

// Scene events
const onSceneReady = () => {
  console.log('3D scene initialized and ready');
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
  console.log(`Model loaded: ${url}${modelUrls.value.length > 0 ? ` (${index + 1}/${modelUrls.value.length})` : ''}`);
  console.log('Object:', object, 'LayerManager ref:', layerManagerRef.value);
  
  // Add to layer manager
  if (layerManagerRef.value && object) {
    let layerName = url.split('/').pop() || `Model ${index + 1}`;
    const layerType = object.userData?.type || 
                      (object.isPoints ? 'pointcloud' : 'model');
    
    // Add camera count to layer name if it's a camera group
    if (layerType === 'camera' && object.userData?.cameraCount) {
      layerName = `${layerName} (${object.userData.cameraCount} cameras)`;
    }
    
    console.log(`Adding to layer manager: ${layerName} (type: ${layerType})`);
    
    layerManagerRef.value.addLayer({
      id: object.uuid,
      name: layerName,
      type: layerType,
      visible: true,
      object: object
    });
  } else {
    console.warn('Could not add to layer manager:', { layerManagerRef: layerManagerRef.value, object });
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

const onLoadingError = ({ url, error }) => {
  console.error('Loading error:', error);
  errorMessage.value = `Failed to load: ${error}`;
  isLoading.value = false;
  loadingProgress.value = 0;
  loadingStatus.value = '';
  loadingTitle.value = 'Loading...';
  
  setTimeout(() => {
    errorMessage.value = null;
  }, 5000);
};

// View toggle events
const onToggleWireframe = () => {};
const onToggleBoundingBox = () => {};
const onToggleGrid = () => {};

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
  startMeasurement('distance');
  if (canvasRef.value && canvasRef.value.enableMeasurementMode) {
    canvasRef.value.enableMeasurementMode('distance');
  }
};

const onMeasureArea = () => {
  startMeasurement('area');
  if (canvasRef.value && canvasRef.value.enableMeasurementMode) {
    canvasRef.value.enableMeasurementMode('area');
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

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
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
