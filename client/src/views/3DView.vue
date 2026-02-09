<template>
  <div class="viewer-3d-view">
    <!-- Ribbon menu -->
    <RibbonMenu 
      @load-model="handleLoadModel"
      @load-pointcloud="handleLoadPointCloud"
      @load-cameras="handleLoadCameras"
      @toggle-wireframe="onToggleWireframe"
      @toggle-bounding-box="onToggleBoundingBox"
      @toggle-grid="onToggleGrid"
      @reset-camera="onResetCamera"
      @fit-to-scene="onFitToScene"
      @back-to-map="backToMap"
    />

    <!-- Main 3D canvas -->
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
    
    <!-- Layer Manager -->
    <LayerManager 
      ref="layerManagerRef"
      @toggle-layer-visibility="onToggleLayerVisibility"
      @remove-layer="onRemoveLayer"
    />

    <!-- Loading indicator -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-container">
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="loading-title">Loading 3D Model...</p>
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
    </div>

    <!-- Error message -->
    <div v-if="errorMessage" class="error-toast">
      <span>{{ errorMessage }}</span>
      <button @click="errorMessage = null">✕</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useViewer3D } from '@/composables/useViewer3D.js';
import Viewer3DCanvas from '@/components/viewer3D/Canvas.vue';
import RibbonMenu from '@/components/viewer3D/RibbonMenu.vue';
import LayerManager from '@/components/viewer3D/LayerManager.vue';

const route = useRoute();
const router = useRouter();
const canvasRef = ref(null);
const layerManagerRef = ref(null);
const isLoading = ref(false);
const loadingProgress = ref(0);
const loadingStatus = ref('');
const isParsing = computed(() => loadingStatus.value.includes('Parsing'));
const errorMessage = ref(null);

const { cleanup } = useViewer3D();

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
  }
};

const onParsingStarted = ({ index, size }) => {
  const sizeMB = (size / (1024 * 1024)).toFixed(1);
  loadingStatus.value = `Parsing model ${index + 1}/${modelUrls.value.length} (${sizeMB}MB)...`;
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
  console.log(`Model loaded: ${url} (${index + 1}/${modelUrls.value.length})`);
  
  // Add to layer manager
  if (layerManagerRef.value && object) {
    const layerName = url.split('/').pop() || `Model ${index + 1}`;
    const layerType = object.userData?.type === 'camera' ? 'camera' : 
                      object.isPoints ? 'pointcloud' : 'model';
    
    layerManagerRef.value.addLayer({
      id: object.uuid,
      name: layerName,
      type: layerType,
      visible: true,
      object: object
    });
  }
  
  if (index === modelUrls.value.length - 1) {
    isLoading.value = false;
    loadingProgress.value = 0;
    loadingStatus.value = '';
  }
};

const onLoadingError = ({ url, error }) => {
  console.error('Loading error:', error);
  errorMessage.value = `Failed to load model: ${error}`;
  isLoading.value = false;
  
  // Auto-hide error after 5 seconds
  setTimeout(() => {
    errorMessage.value = null;
  }, 5000);
};

// Control events
const onToggleWireframe = (value) => {
  console.log('Wireframe:', value);
};

const onToggleBoundingBox = (value) => {
  console.log('Bounding box:', value);
};

const onToggleGrid = (value) => {
  console.log('Grid:', value);
};

const onResetCamera = () => {
  console.log('Camera reset');
};

const backToMap = () => {
  cleanup();
  router.push({ name: 'MapView' });
};

// File loading from ribbon menu
const handleLoadModel = (file) => {
  if (canvasRef.value) {
    canvasRef.value.loadUserObjFile(file);
  }
};

const handleLoadPointCloud = (file) => {
  if (canvasRef.value && canvasRef.value.loadPointCloudFile) {
    canvasRef.value.loadPointCloudFile(file);
  } else {
    errorMessage.value = 'Point cloud loading not yet implemented in Canvas component.';
    setTimeout(() => {
      errorMessage.value = null;
    }, 3000);
  }
};

const handleLoadCameras = (file) => {
  if (canvasRef.value && canvasRef.value.loadCamerasFile) {
    canvasRef.value.loadCamerasFile(file);
  } else {
    errorMessage.value = 'Camera loading not yet implemented in Canvas component.';
    setTimeout(() => {
      errorMessage.value = null;
    }, 3000);
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
</script>

<style scoped>
.viewer-3d-view {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #1a1a1a;
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

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
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
  width: 50px;
  height: 50px;
  margin: 0 auto 20px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-title {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  border-radius: 4px;
  transition: width 0.3s ease;
  box-shadow: 0 0 10px rgba(0, 123, 255, 0.5);
}

.progress-bar.parsing {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.loading-status {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  font-family: 'Courier New', monospace;
}

.error-toast {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #dc3545;
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 2000;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translate(-50%, 100px);
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
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
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