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
            <button @click="openFileDialog('markers')" class="ribbon-btn">
              <span class="btn-icon" v-html="ICON_MARKER_FLAG"></span>
              <span class="btn-label">Markers</span>
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
            <button @click="handleToggleAxes" class="ribbon-btn" :class="{ active: showAxes }">
              <span class="btn-icon" v-html="ICON_AXES"></span>
              <span class="btn-label">Axes</span>
            </button>
            <button @click="handleToggleNormals" class="ribbon-btn" :class="{ active: showNormals }">
              <span class="btn-icon" v-html="ICON_NORMALS"></span>
              <span class="btn-label">Normals</span>
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
            <div class="btn-pair">
              <button @click="emit('view-front')" class="ribbon-btn ribbon-btn-sm">
                <span class="btn-icon" v-html="ICON_VIEW_FRONT"></span>
                <span class="btn-label">Front</span>
              </button>
              <button @click="emit('view-back')" class="ribbon-btn ribbon-btn-sm">
                <span class="btn-icon" v-html="ICON_VIEW_BACK"></span>
                <span class="btn-label">Back</span>
              </button>
            </div>
            <div class="btn-pair">
              <button @click="emit('view-right')" class="ribbon-btn ribbon-btn-sm">
                <span class="btn-icon" v-html="ICON_VIEW_RIGHT"></span>
                <span class="btn-label">Right</span>
              </button>
              <button @click="emit('view-left')" class="ribbon-btn ribbon-btn-sm">
                <span class="btn-icon" v-html="ICON_VIEW_LEFT"></span>
                <span class="btn-label">Left</span>
              </button>
            </div>
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
            <button @click="emit('measure-distance')" class="ribbon-btn" :class="{ active: isMeasuringDistance }">
              <span class="btn-icon" v-html="ICON_DISTANCE"></span>
              <span class="btn-label">Distance</span>
            </button>
            <button @click="emit('measure-area')" class="ribbon-btn" :class="{ active: isMeasuringArea }">
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
    <input
      ref="markersInput"
      type="file"
      accept=".xml"
      @change="handleMarkersFile"
      style="display: none"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useViewer3DStore } from '@/stores/viewer3D/viewer3dStore';
import { storeToRefs } from 'pinia';
import {
  ICON_3D_MODEL,
  ICON_POINT_CLOUD,
  ICON_CAMERA,
  ICON_MARKER_FLAG,
  ICON_GRID,
  ICON_AXES,
  ICON_RESET,
  ICON_FIT,
  ICON_WIREFRAME,
  ICON_BBOX,
  ICON_NORMALS,
  ICON_DISTANCE,
  ICON_AREA,
  ICON_VIEW_TOP,
  ICON_VIEW_FRONT,
  ICON_VIEW_BACK,
  ICON_VIEW_RIGHT,
  ICON_VIEW_LEFT
} from '@/constants/icons.js';

const props = defineProps({
  isMeasuringDistance: {
    type: Boolean,
    default: false
  },
  isMeasuringArea: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'load-model',
  'load-pointcloud',
  'load-cameras',
  'load-markers',
  'unsupported-file',
  'toggle-wireframe',
  'toggle-bounding-box',
  'toggle-grid',
  'toggle-axes',
  'toggle-normals',
  'reset-camera',
  'fit-to-scene',
  'view-top',
  'view-front',
  'view-back',
  'view-right',
  'view-left',
  'measure-distance',
  'measure-area'
]);

const viewer3DStore = useViewer3DStore();
const { showGrid, showAxes, showWireframe, showBoundingBox, showNormals } = storeToRefs(viewer3DStore);
const { toggleWireframe, toggleBoundingBox, toggleGrid, toggleAxes, toggleNormals } = viewer3DStore;

const activeTab = ref('insert');
const modelInput = ref(null);
const pointcloudInput = ref(null);
const camerasInput = ref(null);
const markersInput = ref(null);

const tabs = [
  { id: 'insert', label: 'Insert' },
  { id: 'view', label: 'View' },
  { id: 'tools', label: 'Tools' }
];

const openFileDialog = (type) => {
  switch(type) {
    case 'model':       modelInput.value?.click();    break;
    case 'pointcloud':  pointcloudInput.value?.click(); break;
    case 'cameras':     camerasInput.value?.click();  break;
    case 'markers':     markersInput.value?.click();  break;
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

const handleToggleAxes = () => {
  toggleAxes();
  emit('toggle-axes', showAxes.value);
};

const handleToggleNormals = () => {
  toggleNormals();
  emit('toggle-normals', showNormals.value);
};

const SUPPORTED = {
  model:      ['.obj', '.ply', '.stl'],
  pointcloud: ['.copc.laz', '.laz', '.las', '.ply'],
  cameras:    ['.txt'],
  markers:    ['.xml'],
};

const checkExtension = (file, type) => {
  const lower = file.name.toLowerCase();
  return SUPPORTED[type].some((ext) => lower.endsWith(ext));
};

const emitOrReject = (file, type, loadEvent, event) => {
  if (checkExtension(file, type)) {
    emit(loadEvent, file);
  } else {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'unknown';
    emit('unsupported-file', { ext, expected: SUPPORTED[type].join(', ') });
  }
  event.target.value = '';
};

const handleModelFile = (event) => {
  const file = event.target.files[0];
  if (file) emitOrReject(file, 'model', 'load-model', event);
};

const handlePointCloudFile = (event) => {
  const file = event.target.files[0];
  if (file) emitOrReject(file, 'pointcloud', 'load-pointcloud', event);
};

const handleCamerasFile = (event) => {
  const file = event.target.files[0];
  if (file) emitOrReject(file, 'cameras', 'load-cameras', event);
};

const handleMarkersFile = (event) => {
  const file = event.target.files[0];
  if (file) emitOrReject(file, 'markers', 'load-markers', event);
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

.theme-dark .ribbon-menu {
  background: #2a2a2a;
  border-bottom: 1px solid #444;
}

.ribbon-tabs {
  display: flex;
  background: #343a40;
  padding: 0;
  min-height: 28px;
}

.theme-dark .ribbon-tabs {
  background: #1a1a1a;
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

.theme-dark .tab-btn.active {
  background: #2a2a2a;
  color: #e0e0e0;
}

.ribbon-content {
  padding: 0 6px;
  height: 64px;
  background: #f8f9fa;
  display: flex;
  align-items: stretch;
}

.theme-dark .ribbon-content {
  background: #2a2a2a;
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

.theme-dark .ribbon-group {
  border-right: 1px solid #444;
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

.theme-dark .group-label {
  color: #999;
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

.theme-dark .ribbon-btn {
  color: #ccc;
}

.ribbon-btn:hover {
  background: #fff;
  border-color: #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.theme-dark .ribbon-btn:hover {
  background: #3a3a3a;
  border-color: #555;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.ribbon-btn.active {
  background: #e8f0fe;
  border-color: #c7ddf9;
  color: #3b82f6;
}

.theme-dark .ribbon-btn.active {
  background: rgba(74, 158, 255, 0.15);
  border-color: rgba(74, 158, 255, 0.3);
  color: #4a9eff;
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

.btn-pair {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ribbon-btn-sm {
  min-width: 40px;
  height: 21px;
  padding: 2px 5px;
  gap: 0;
  flex-direction: row;
  justify-content: flex-start;
}

.ribbon-btn-sm .btn-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.ribbon-btn-sm .btn-icon :deep(svg) {
  width: 12px;
  height: 12px;
}

.ribbon-btn-sm .btn-label {
  font-size: 9px;
  margin-left: 3px;
}
</style>
