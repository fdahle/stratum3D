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
      <!-- Layers Tab -->
      <div v-if="activeTab === 'layers'" class="ribbon-panel">
        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button class="ribbon-btn" @click="fileInput.click()">
              <span class="btn-icon" v-html="ICON_ADD_LAYER"></span>
              <span class="btn-label">Add Layer</span>
            </button>
          </div>
          <span class="group-label">Import</span>
        </div>
      </div>

      <!-- View Tab -->
      <div v-if="activeTab === 'view'" class="ribbon-panel">
        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button class="ribbon-btn" @click="fitAllLayers" title="Zoom to fit all loaded layers">
              <span class="btn-icon" v-html="ICON_FIT"></span>
              <span class="btn-label">Fit All</span>
            </button>
            <button class="ribbon-btn" @click="zoomIn" title="Zoom in">
              <span class="btn-icon" v-html="ICON_ZOOM_IN"></span>
              <span class="btn-label">Zoom In</span>
            </button>
            <button class="ribbon-btn" @click="zoomOut" title="Zoom out">
              <span class="btn-icon" v-html="ICON_ZOOM_OUT"></span>
              <span class="btn-label">Zoom Out</span>
            </button>
          </div>
          <span class="group-label">Navigate</span>
        </div>
      </div>

      <!-- Tools Tab -->
      <div v-if="activeTab === 'tools'" class="ribbon-panel">
        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button
              class="ribbon-btn"
              :class="{ active: isMeasuringDistance }"
              @click="$emit('measure-distance')"
              title="Measure distance on the map"
            >
              <span class="btn-icon" v-html="ICON_DISTANCE"></span>
              <span class="btn-label">Distance</span>
            </button>
            <button
              class="ribbon-btn"
              :class="{ active: isMeasuringArea }"
              @click="$emit('measure-area')"
              title="Measure area on the map"
            >
              <span class="btn-icon" v-html="ICON_AREA"></span>
              <span class="btn-label">Area</span>
            </button>
          </div>
          <span class="group-label">Measure</span>
        </div>
        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button
              class="ribbon-btn"
              :class="{ active: isElevationOpen }"
              @click="$emit('elevation-profile')"
              title="Sample elevation along a drawn line"
            >
              <span class="btn-icon" v-html="ICON_ELEVATION"></span>
              <span class="btn-label">Elevation</span>
            </button>
          </div>
          <span class="group-label">Analyse</span>
        </div>
        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button
              class="ribbon-btn"
              @click="open3DViewer"
              title="Open the 3D viewer in a new tab"
            >
              <span class="btn-icon" v-html="ICON_3D"></span>
              <span class="btn-label">3D Scene</span>
            </button>
          </div>
          <span class="group-label">Views</span>
        </div>
        <div class="ribbon-group">
          <div class="ribbon-group-buttons">
            <button
              class="ribbon-btn"
              @click="$emit('share-scene')"
              title="Share or load a saved map scene"
            >
              <span class="btn-icon" v-html="ICON_SHARE"></span>
              <span class="btn-label">Share</span>
            </button>
          </div>
          <span class="group-label">Collaborate</span>
        </div>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept=".geojson,.json,.tif,.tiff,.geotiff"
      multiple
      style="display: none"
      @change="handleFileInput"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';
import { useMapStore } from '@/stores/map/mapStore';
import { useLayerStore } from '@/stores/map/layerStore';
import { ICON_FIT, ICON_DISTANCE, ICON_AREA, ICON_ELEVATION, ICON_3D, ICON_SHARE } from '@/constants/icons.js';

const props = defineProps({
  isMeasuringDistance: { type: Boolean, default: false },
  isMeasuringArea:     { type: Boolean, default: false },
  isElevationOpen:     { type: Boolean, default: false },
});

const emit = defineEmits(['add-files', 'measure-distance', 'measure-area', 'elevation-profile', 'share-scene']);

const settingsStore = useSettingsStore();
const mapStore = useMapStore();
const layerStore = useLayerStore();

const activeTab = ref('layers');
const fileInput = ref(null);

const tabs = [
  { id: 'layers', label: 'Layers' },
  { id: 'view',   label: 'View'   },
  { id: 'tools',  label: 'Tools'  },
];

// ---- Icons ----
const ICON_ADD_LAYER = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><circle cx="19" cy="5" r="4" fill="#28a745" stroke="none"/><path d="M17 5h4M19 3v4" stroke="white" stroke-width="1.8"/></svg>`;
const ICON_ZOOM_IN   = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
const ICON_ZOOM_OUT  = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

// ---- Map navigation ----
const fitAllLayers = () => {
  const map = mapStore.getMap();
  if (!map) return;
  const overlays = layerStore.layers.filter(l => l.category === 'overlay' && l.active);
  if (overlays.length === 0) {
    map.getView().animate({ zoom: 2, duration: 600 });
    return;
  }
  import('ol/extent').then(({ createEmpty, extend, isEmpty }) => {
    const combined = createEmpty();
    for (const layer of overlays) {
      const source = layer.layerInstance?.getSource?.();
      if (!source) continue;
      const ext = typeof source.getExtent === 'function' ? source.getExtent() : null;
      if (ext && !isEmpty(ext)) extend(combined, ext);
    }
    if (!isEmpty(combined)) {
      map.getView().fit(combined, { padding: [60, 60, 60, 60], duration: 800, maxZoom: 18 });
    }
  });
};

const zoomIn = () => {
  const map = mapStore.getMap();
  if (!map) return;
  const view = map.getView();
  view.animate({ zoom: (view.getZoom() ?? 2) + 1, duration: 300 });
};

const zoomOut = () => {
  const map = mapStore.getMap();
  if (!map) return;
  const view = map.getView();
  view.animate({ zoom: (view.getZoom() ?? 2) - 1, duration: 300 });
};

// ---- File input ----
const open3DViewer = () => window.open('/viewer', '_blank');

const handleFileInput = (event) => {
  const files = Array.from(event.target.files ?? []);
  if (files.length) emit('add-files', files);
  event.target.value = '';
};
</script>

<style scoped>
.ribbon-menu {
  background: #fff;
  border-bottom: 1px solid #ddd;
  z-index: 900;
  font-family: "Segoe UI", sans-serif;
  user-select: none;
  flex-shrink: 0;
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
</style>
