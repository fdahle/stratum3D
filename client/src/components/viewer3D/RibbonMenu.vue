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
          <div class="ribbon-group-buttons">
            <button @click="openFileDialog('model')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_3D_MODEL"></span>
              <span class="btn-label">3D Model</span>
            </button>
            <button @click="openFileDialog('pointcloud')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_POINT_CLOUD"></span>
              <span class="btn-label">Point Cloud</span>
            </button>
            <button @click="openFileDialog('cameras')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_CAMERA"></span>
              <span class="btn-label">Cameras</span>
            </button>
          </div>
          <span class="group-label">Data</span>
        </div>
      </div>

      <!-- View Tab -->
      <div v-if="activeTab === 'view'" class="ribbon-panel">
        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button @click="handleToggleWireframe" class="ribbon-btn" :class="{ active: showWireframe }">
              <span class="btn-icon" v-html="ICON_WIREFRAME"></span>
              <span class="btn-label">Wireframe</span>
            </button>
            <button @click="handleToggleBoundingBox" class="ribbon-btn" :class="{ active: showBoundingBox }">
              <span class="btn-icon" v-html="ICON_BBOX"></span>
              <span class="btn-label">Box</span>
            </button>
            <button @click="handleToggleGrid" class="ribbon-btn" :class="{ active: showGrid }">
              <span class="btn-icon" v-html="ICON_GRID"></span>
              <span class="btn-label">Grid</span>
            </button>
          </div>
          <span class="group-label">Display</span>
        </div>

        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button @click="emit('view-top')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_VIEW_TOP"></span>
              <span class="btn-label">Top</span>
            </button>
            <button @click="emit('view-front')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_VIEW_FRONT"></span>
              <span class="btn-label">Front</span>
            </button>
            <button @click="emit('view-right')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_VIEW_RIGHT"></span>
              <span class="btn-label">Right</span>
            </button>
          </div>
          <span class="group-label">Camera Presets</span>
        </div>

        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button @click="emit('reset-camera')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_RESET"></span>
              <span class="btn-label">Reset</span>
            </button>
            <button @click="emit('fit-to-scene')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_FIT"></span>
              <span class="btn-label">Fit All</span>
            </button>
          </div>
          <span class="group-label">Navigate</span>
        </div>
      </div>

      <!-- Tools Tab -->
      <div v-if="activeTab === 'tools'" class="ribbon-panel">
        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button @click="emit('measure-distance')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_DISTANCE"></span>
              <span class="btn-label">Distance</span>
            </button>
            <button @click="emit('measure-area')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_AREA"></span>
              <span class="btn-label">Area</span>
            </button>
          </div>
          <span class="group-label">Measure</span>
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
import {
  ICON_3D_MODEL,
  ICON_POINT_CLOUD,
  ICON_CAMERA,
  ICON_GRID,
  ICON_RESET,
  ICON_FIT,
  ICON_WIREFRAME,
  ICON_BBOX,
  ICON_DISTANCE,
  ICON_AREA,
  ICON_VIEW_TOP,
  ICON_VIEW_FRONT,
  ICON_VIEW_RIGHT
} from '@/constants/icons.js';

const emit = defineEmits([
  'load-model',
  'load-pointcloud',
  'load-cameras',
  'toggle-wireframe',
  'toggle-bounding-box',
  'toggle-grid',
  'reset-camera',
  'fit-to-scene',
  'view-top',
  'view-front',
  'view-right',
  'measure-distance',
  'measure-area'
]);

const { showGrid, showWireframe, showBoundingBox, toggleWireframe, toggleBoundingBox, toggleGrid } = useViewer3D();

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
  position: relative;
  background: #fff;
  border-bottom: 1px solid #ddd;
  z-index: 900;
  font-family: "Segoe UI", sans-serif;
  user-select: none;
}

.ribbon-tabs {
  display: flex;
  background: #343a40;
  padding: 0;
  min-height: 28px;
}

.tab-btn {
  padding: 4px 18px;
  border: none;
  background: none;
  cursor: pointer;
  font-family: "Segoe UI", sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.tab-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.tab-btn.active {
  background: #f8f9fa;
  color: #333;
  border-bottom-color: #3b82f6;
}

.ribbon-content {
  padding: 0 6px;
  height: 64px;
  background: #f8f9fa;
  display: flex;
  align-items: stretch;
}

.ribbon-panel {
  display: flex;
  gap: 0;
  height: 100%;
  align-items: stretch;
}

.ribbon-group {
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
  border-right: 1px solid #ddd;
  position: relative;
}

.ribbon-group:last-child {
  border-right: none;
}

.ribbon-group-buttons {
  display: flex;
  flex-direction: row;
  gap: 1px;
  padding: 4px 10px 0;
  flex: 1;
  align-items: flex-start;
}

.group-label {
  display: block;
  font-size: 10px;
  color: #888;
  font-weight: 400;
  text-align: center;
  padding: 0 10px 3px;
  white-space: nowrap;
}

.ribbon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 8px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 48px;
  height: 44px;
  color: #444;
}

.ribbon-btn:hover {
  background: #fff;
  border-color: #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.ribbon-btn.active {
  background: #e8f0fe;
  border-color: #c7ddf9;
  color: #3b82f6;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: inherit;
}

.btn-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.btn-label {
  font-family: "Segoe UI", sans-serif;
  font-size: 10px;
  font-weight: 400;
  color: inherit;
  line-height: 1;
  white-space: nowrap;
}

.ribbon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ribbon-btn:disabled:hover {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
</style>
