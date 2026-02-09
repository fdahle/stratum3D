<template>
  <div class="viewer-3d-view">
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
    />
    
    <!-- Control panels -->
    <Viewer3DControls 
      :model-name="modelName"
      :coordinates="coordinates"
      @toggle-wireframe="onToggleWireframe"
      @toggle-bounding-box="onToggleBoundingBox"
      @toggle-grid="onToggleGrid"
      @reset-camera="onResetCamera"
      @back-to-map="backToMap"
      @load-obj-file="loadObjFile"
      @load-copc-file="loadCopcFile"
    />
    
    <!-- Measurement tools -->
    <MeasurementTools3D 
      @measurement-started="onMeasurementStarted"
      @measurement-complete="onMeasurementComplete"
      @measurement-cancelled="onMeasurementCancelled"
    />

    <!-- Loading indicator -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading 3D model...</p>
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
import { useViewer3D } from '@/composables/viewer3D/useViewer3D';
import Viewer3DCanvas from '@/components/viewer3D/Canvas.vue';
import Viewer3DControls from '@/components/viewer3D/Controls.vue';
import MeasurementTools3D from '@/components/viewer3D/MeasurementTools.vue';

const route = useRoute();
const router = useRouter();
const canvasRef = ref(null);
const isLoading = ref(false);
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

const onModelLoaded = ({ url, index }) => {
  console.log(`Model loaded: ${url} (${index + 1}/${modelUrls.value.length})`);
  if (index === modelUrls.value.length - 1) {
    isLoading.value = false;
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

// File loading
const loadObjFile = (file) => {
  if (canvasRef.value) {
    canvasRef.value.loadUserObjFile(file);
  }
};

const loadCopcFile = (file) => {
  errorMessage.value = 'COPC point cloud support coming soon. Requires Giro3D integration.';
  setTimeout(() => {
    errorMessage.value = null;
  }, 3000);
};

// Measurement events
const onMeasurementStarted = (mode) => {
  console.log('Measurement started:', mode);
  // TODO: Enable raycasting for point picking in canvas
};

const onMeasurementComplete = (measurement) => {
  console.log('Measurement complete:', measurement);
};

const onMeasurementCancelled = () => {
  console.log('Measurement cancelled');
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

.loading-spinner {
  text-align: center;
  color: white;
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

.loading-spinner p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
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