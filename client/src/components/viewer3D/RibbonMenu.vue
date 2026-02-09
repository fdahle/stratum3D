<template>
  <div class="ribbon-menu">
    <div class="ribbon-tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="ribbon-content">
      <!-- Insert Tab -->
      <div v-if="activeTab === 'insert'" class="ribbon-panel">
        <div class="ribbon-group">
          <button @click="openFileDialog('model')" class="ribbon-btn">
            <span class="btn-icon">🏔️</span>
            <span class="btn-label">3D Model</span>
          </button>
          <button @click="openFileDialog('pointcloud')" class="ribbon-btn">
            <span class="btn-icon">☁️</span>
            <span class="btn-label">Point Cloud</span>
          </button>
          <button @click="openFileDialog('cameras')" class="ribbon-btn">
            <span class="btn-icon">📷</span>
            <span class="btn-label">Cameras</span>
          </button>
        </div>
      </div>

      <!-- View Tab -->
      <div v-if="activeTab === 'view'" class="ribbon-panel">
        <div class="ribbon-group">
          <button @click="emit('toggle-grid')" class="ribbon-btn" :class="{ active: showGrid }">
            <span class="btn-icon">⊞</span>
            <span class="btn-label">Grid</span>
          </button>
        </div>

        <div class="ribbon-group">
          <button @click="emit('reset-camera')" class="ribbon-btn">
            <span class="btn-icon">🔄</span>
            <span class="btn-label">Reset View</span>
          </button>
          <button @click="emit('fit-to-scene')" class="ribbon-btn">
            <span class="btn-icon">🎯</span>
            <span class="btn-label">Fit</span>
          </button>
        </div>
        
        <div class="ribbon-group">
          <button @click="emit('back-to-map')" class="ribbon-btn">
            <span class="btn-icon">←</span>
            <span class="btn-label">Back to Map</span>
          </button>
        </div>
      </div>

      <!-- Tools Tab -->
      <div v-if="activeTab === 'tools'" class="ribbon-panel">
        <div class="ribbon-group">
          <button class="ribbon-btn" disabled>
            <span class="btn-icon">📐</span>
            <span class="btn-label">Distance</span>
          </button>
          <button class="ribbon-btn" disabled>
            <span class="btn-icon">📏</span>
            <span class="btn-label">Area</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Hidden file inputs -->
    <input 
      ref="modelInput" 
      type="file" 
      accept=".obj,.ply,.stl" 
      @change="handleModelFile" 
      style="display: none"
    />
    <input 
      ref="pointcloudInput" 
      type="file" 
      accept=".copc.laz,.laz,.las,.ply" 
      @change="handlePointCloudFile" 
      style="display: none"
    />
    <input 
      ref="camerasInput" 
      type="file" 
      accept=".txt" 
      @change="handleCamerasFile" 
      style="display: none"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useViewer3D } from '@/composables/useViewer3D.js';

const emit = defineEmits([
  'load-model',
  'load-pointcloud',
  'load-cameras',
  'toggle-wireframe',
  'toggle-bounding-box',
  'toggle-grid',
  'reset-camera',
  'fit-to-scene',
  'back-to-map'
]);

const { showGrid } = useViewer3D();

const activeTab = ref('insert');
const modelInput = ref(null);
const pointcloudInput = ref(null);
const camerasInput = ref(null);

const tabs = [
  { id: 'insert', label: 'Insert' },
  { id: 'view', label: 'View' },
  { id: 'tools', label: 'Tools' }
];

const openFileDialog = (type) => {
  switch(type) {
    case 'model':
      modelInput.value?.click();
      break;
    case 'pointcloud':
      pointcloudInput.value?.click();
      break;
    case 'cameras':
      camerasInput.value?.click();
      break;
  }
};

const handleModelFile = (event) => {
  const file = event.target.files[0];
  if (file) {
    emit('load-model', file);
    event.target.value = '';
  }
};

const handlePointCloudFile = (event) => {
  const file = event.target.files[0];
  if (file) {
    emit('load-pointcloud', file);
    event.target.value = '';
  }
};

const handleCamerasFile = (event) => {
  const file = event.target.files[0];
  if (file) {
    emit('load-cameras', file);
    event.target.value = '';
  }
};
</script>

<style scoped>
.ribbon-menu {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to bottom, #ffffff 0%, #f3f3f3 100%);
  border-bottom: 1px solid #d1d1d1;
  z-index: 900;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.ribbon-tabs {
  display: flex;
  background: #ffffff;
  border-bottom: 1px solid #d1d1d1;
  padding: 0;
  min-height: 24px;
}

.tab-btn {
  padding: 3px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 11px;
  font-weight: 400;
  color: #444;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  text-transform: capitalize;
}

.tab-btn:hover {
  background: #e9ecef;
}

.tab-btn.active {
  color: #007bff;
  border-bottom-color: #007bff;
  background: white;
}

.ribbon-content {
  padding: 3px 8px;
  height: 48px;
  background: linear-gradient(to bottom, #f9f9f9 0%, #f0f0f0 100%);
  display: flex;
  align-items: center;
}

.ribbon-panel {
  display: flex;
  gap: 0;
  height: 100%;
  align-items: center;
}

.ribbon-group {
  display: flex;
  flex-direction: row;
  gap: 2px;
  padding: 0 8px;
  height: 100%;
  align-items: center;
  border-right: 1px solid #d1d1d1;
}

.ribbon-group:last-child {
  border-right: none;
}

.group-label {
  font-size: 9px;
  color: #666;
  font-weight: 400;
  text-transform: capitalize;
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}

.ribbon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.1s;
  min-width: 48px;
  height: 40px;
  position: relative;
}

.ribbon-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: #e5e5e5;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.ribbon-btn.active {
  background: rgba(225, 240, 255, 0.7);
  border-color: #c7e0f4;
}

.btn-icon {
  font-size: 16px;
  margin-bottom: 1px;
}

.btn-label {
  font-size: 9px;
  font-weight: 400;
  color: #333;
  line-height: 1;
}

.btn-sublabel {
  display: none;
}

.ribbon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ribbon-btn:disabled:hover {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
</style>
