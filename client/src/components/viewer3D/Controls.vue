<template>
  <div class="controls-panel">
    <h3>🌐 3D Viewer</h3>
    
    <div class="info-section">
      <div class="info-item">
        <strong>{{ modelName }}</strong>
      </div>
      <div class="info-item">
        <strong>Position:</strong> 
        <span>{{ coordinatesText }}</span>
      </div>
    </div>

    <div class="view-controls">
      <button @click="handleToggleWireframe" class="toggle-btn" :class="{ active: showWireframe }">
        {{ showWireframe ? '🔲 Solid' : '🔳 Wireframe' }}
      </button>
      <button @click="handleToggleBoundingBox" class="toggle-btn" :class="{ active: showBoundingBox }">
        {{ showBoundingBox ? '📦 Hide Box' : '📦 Show Box' }}
      </button>
      <button @click="handleToggleGrid" class="toggle-btn" :class="{ active: showGrid }">
        {{ showGrid ? '⊞ Hide Grid' : '⊞ Show Grid' }}
      </button>
    </div>

    <div class="action-buttons">
      <button @click="handleResetCamera" class="primary-btn">
        🔄 Reset Camera
      </button>
      <button @click="handleBackToMap" class="secondary-btn">
        ← Back to Map
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useViewer3D } from '@/composables/useViewer3D.js';

const props = defineProps({
  modelName: {
    type: String,
    default: 'Model'
  },
  coordinates: {
    type: Object,
    required: true
  }
});

const emit = defineEmits([
  'toggle-wireframe',
  'toggle-bounding-box', 
  'toggle-grid',
  'reset-camera',
  'back-to-map'
]);

const { 
  showWireframe, 
  showBoundingBox, 
  showGrid,
  toggleWireframe,
  toggleBoundingBox,
  toggleGrid,
  resetCamera
} = useViewer3D();

const coordinatesText = computed(() => {
  return `${props.coordinates.x.toFixed(2)}, ${props.coordinates.y.toFixed(2)}`;
});

const handleToggleWireframe = () => {
  toggleWireframe();
  emit('toggle-wireframe', showWireframe.value);
};

const handleToggleBoundingBox = () => {
  toggleBoundingBox();
  emit('toggle-bounding-box', showBoundingBox.value);
};

const handleToggleGrid = () => {
  toggleGrid();
  emit('toggle-grid', showGrid.value);
};

const handleResetCamera = () => {
  resetCamera();
  emit('reset-camera');
};

const handleBackToMap = () => {
  emit('back-to-map');
};
</script>

<style scoped>
.controls-panel {
  position: absolute;
  top: 80px;
  left: 20px;
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 13px;
  max-width: 320px;
  z-index: 800;
  backdrop-filter: blur(10px);
}

.controls-panel h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.info-section {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.info-item {
  margin: 8px 0;
  color: #666;
  line-height: 1.5;
}

.info-item strong {
  color: #333;
  font-weight: 600;
}

.info-item span {
  color: #007bff;
  font-family: 'Courier New', monospace;
}

.view-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.toggle-btn {
  padding: 8px 12px;
  font-size: 12px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.toggle-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-btn.active {
  background: #007bff;
}

.toggle-btn.active:hover {
  background: #0056b3;
}

.file-section {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.file-section:last-of-type {
  border-bottom: none;
}

.file-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
  font-size: 13px;
}

.file-section input[type="file"] {
  width: 100%;
  font-size: 12px;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.file-section input[type="file"]::-webkit-file-upload-button {
  padding: 6px 12px;
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  margin-right: 8px;
}

.file-section input[type="file"]::-webkit-file-upload-button:hover {
  background: #e9ecef;
}

.file-section small {
  display: block;
  color: #999;
  font-size: 11px;
  margin-top: 4px;
  font-style: italic;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.primary-btn,
.secondary-btn {
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.primary-btn {
  background: #007bff;
  color: white;
}

.primary-btn:hover {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 123, 255, 0.3);
}

.secondary-btn {
  background: #6c757d;
  color: white;
}

.secondary-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(108, 117, 125, 0.3);
}

.primary-btn:active,
.secondary-btn:active {
  transform: translateY(0);
}
</style>