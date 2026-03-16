<template>
  <div class="layerpanel">
    <div v-if="!settingsStore.showMapRibbon" class="header">
      <h3>Map Layers</h3>
    </div>

    <div
      class="layer-list"
      :class="{ 'is-dragging': isDragging }"
      @dragover.prevent="handleListDragOver"
      @drop.prevent="executeDrop"
    >
      <TransitionGroup name="layers">
        <div
          v-for="layer in displayLayers"
          :key="layer._layerId"
          class="layer-row"
          :class="{
            active: layer.active,
            'is-idle': layer.status === 'idle',
            'layer-error': layer.status === 'error',
            'dragging': draggedLayerId === layer._layerId,
          }"
          draggable="true"
          @dragstart="handleDragStart($event, layer)"
          @dragend="handleDragEnd"
          @dragover.prevent.stop="handleDragOver($event, layer)"
          @drop.prevent.stop="executeDrop"
          @touchstart="handleTouchStart($event, layer)"
          @touchmove="handleTouchMove($event)"
          @touchend="handleTouchEnd($event)"
          @contextmenu.prevent="handleRightClick($event, layer)"
        >
        <div
          v-if="['downloading', 'processing', 'loading-details'].includes(layer.status)"
          class="progress-bg"
        >
          <div
            class="progress-fill"
            :class="layer.status"
            :style="{ width: layer.progress + '%' }"
          ></div>
        </div>

        <label :class="{ 'disabled-label': layer.status === 'error' }">
          <input
            type="checkbox"
            :checked="layer.active"
            :disabled="['downloading', 'processing', 'error', 'loading-details'].includes(layer.status)"
            @change="layerStore.toggleLayer(layer._layerId)"
          />

          <span class="icon-container">
            <div
              v-if="['downloading', 'processing', 'loading-details'].includes(layer.status)"
              class="spinner"
            ></div>

            <span
              v-else
              class="geom-icon"
              :style="{ color: layer.status === 'error' ? '#ccc' : layer.color || '#666' }"
              v-html="getGeometryIconSVG(layer.geometryType)"
            >
            </span>
          </span>

          <div class="layer-title-content">
            <span
              class="layer-name-text"
              :style="{ color: layer.status === 'error' ? '#888' : 'inherit' }"
            >
              {{ layer.name }}
              <small v-if="layer.status === 'downloading'" class="loading-text">({{ STRINGS.layer.dl }} {{ layer.progress }}%)</small>
              <small v-else-if="layer.status === 'processing'" class="loading-text">({{ STRINGS.layer.proc }} {{ layer.progress }}%)</small>
              <small v-else-if="layer.status === 'loading-details'" class="loading-text">({{ STRINGS.layer.load }} {{ layer.progress }}%)</small>
            </span>

            <div class="action-buttons">
              <span
                v-if="layer.status === 'error'"
                class="warning-icon"
                :title="layer.error || STRINGS.layer.error"
                v-html="EMOJI_ICONS.WARNING"
              >
              </span>

              <button
                v-if="['downloading', 'processing', 'loading-details'].includes(layer.status)"
                class="action-btn cancel-btn"
                :title="STRINGS.cancel"
                @click.stop="handleCancel(layer._layerId)"
                v-html="EMOJI_ICONS.CLOSE"
              >
              </button>

              <!-- Layer ordering buttons (optional based on setting) -->
              <div v-if="settingsStore.showArrowButtons && overlayLayers.length > 1" class="order-buttons">
                <button
                  class="order-btn"
                  :disabled="isFirstLayer(layer._layerId)"
                  :title="'Move layer up'"
                  @click.stop="moveLayerUp(layer._layerId)"
                >
                  ▲
                </button>
                <button
                  class="order-btn"
                  :disabled="isLastLayer(layer._layerId)"
                  :title="'Move layer down'"
                  @click.stop="moveLayerDown(layer._layerId)"
                >
                  ▼
                </button>
              </div>

              <!-- Remove button (only for runtime-added layers) -->
              <button
                v-if="layer.isUserAdded && layer.status === 'ready'"
                class="action-btn remove-btn"
                title="Remove layer"
                @click.stop="handleRemove(layer._layerId)"
                v-html="EMOJI_ICONS.TRASH"
              >
              </button>
            </div>
          </div>
        </label>
        </div>
      </TransitionGroup>

      <div v-if="overlayLayers.length === 0" class="empty-state">
        {{ STRINGS.map.noLayers }}
      </div>
    </div>

    <div class="layerpanel-footer">
      <button class="settings-btn" @click="$emit('open-settings')">
        <span class="icon" v-html="EMOJI_ICONS.SETTINGS"></span>
        <span class="text">{{ STRINGS.settings.title }}</span>
      </button>
    </div>

    <ContextMenu
      ref="contextMenuRef"
      @action="handleMenuAction"
      @color-change="handleColorChange"
    />
  </div>
</template>

<script setup>
import { ref, inject, computed } from "vue";
import { storeToRefs } from "pinia";
import { useLayerStore } from "../../stores/map/layerStore";
import { useMapStore } from "../../stores/map/mapStore";
import { useSettingsStore } from "../../stores/settingsStore";
import ContextMenu from "../contextMenus/ContextMenuLayers.vue";
import GeoJSON from "ol/format/GeoJSON"; // Import OL GeoJSON Format
import { ICON_POINT, ICON_LINE, ICON_POLYGON, ICON_RASTER, EMOJI_ICONS, getGeometryIcon } from "../../constants/icons";
import { STRINGS } from "../../constants/strings";

defineEmits(['open-settings']);

const layerStore = useLayerStore();
const mapStore = useMapStore();
const settingsStore = useSettingsStore();
const layerManager = inject("layerManager"); // ref — access via .value

const { overlayLayers } = storeToRefs(layerStore);
const contextMenuRef = ref(null);

// getGeometryIcon now returns SVG markup directly
const getGeometryIconSVG = (layerType) => getGeometryIcon(layerType);

const handleRightClick = (event, layer) => {
  if (layer.status !== "ready") return;
  contextMenuRef.value.open(event, layer);
};

const handleMenuAction = ({ type, layer }) => {
  if (!layer.layerInstance) return;

  // --- REMOVE ACTION ---
  if (type === "remove") {
    if (layerManager.value) layerManager.value.removeLayer(layer._layerId);
    return;
  }

  // --- ZOOM ACTION (OpenLayers) ---
  if (type === "zoom") {
    const map = mapStore.getMap();
    if (map) {
      const source = layer.layerInstance.getSource();
      if (source) {
        if (layer.type === 'geotiff') {
          // GeoTIFF sources expose their extent via the async getView() promise
          source.getView().then((viewInfo) => {
            if (viewInfo?.extent) {
              map.getView().fit(viewInfo.extent, { padding: [50, 50, 50, 50], duration: 1000 });
            }
          }).catch(() => {});
        } else {
          const extent = source.getExtent();
          if (extent && extent[0] !== Infinity) {
            map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
          }
        }
      }
    }
  }

  // --- DOWNLOAD ACTION (OpenLayers) ---
  if (type === "download") {
    if (layer.type === 'geotiff') {
      // For GeoTIFF layers, download the original file directly from its URL
      const el = document.createElement("a");
      el.setAttribute("href", layer.url);
      el.setAttribute("download", `${layer.name}.tif`);
      document.body.appendChild(el);
      el.click();
      el.remove();
    } else {
      const source = layer.layerInstance.getSource();
      const features = source.getFeatures();

      // Create GeoJSON writer
      const format = new GeoJSON();

      // Write features to object, transforming Projection -> Lat/Lon
      const map = mapStore.getMap();
      const projection = map.getView().getProjection();

      const geojsonObj = format.writeFeaturesObject(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: projection
      });

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonObj));
      const el = document.createElement("a");
      el.setAttribute("href", dataStr);
      el.setAttribute("download", `${layer.name}.json`);
      document.body.appendChild(el);
      el.click();
      el.remove();
    }
  }
};

const handleColorChange = ({ color, layer }) => {
  // 1. Update the stored color value
  layerStore.updateLayerColor(layer._layerId, color);
  // 2. Re-style the OL features to match (composable owns OL logic)
  if (layerManager.value) layerManager.value.applyLayerColor(layer._layerId);
};

const handleCancel = (layerId) => {
  layerStore.cancelLayerLoad(layerId);
};

const handleRemove = (layerId) => {
  if (layerManager.value) layerManager.value.removeLayer(layerId);
};

const moveLayerUp = (layerId) => {
  layerStore.moveLayerUp(layerId);
};

const moveLayerDown = (layerId) => {
  layerStore.moveLayerDown(layerId);
};

const isFirstLayer = (layerId) => {
  return overlayLayers.value[0]?._layerId === layerId;
};

const isLastLayer = (layerId) => {
  const len = overlayLayers.value.length;
  return overlayLayers.value[len - 1]?._layerId === layerId;
};

// Drag and drop state
const draggedLayerId = ref(null);
const dropIndicatorIndex = ref(null);
const isDragging = ref(false);

// Touch drag state
const touchStartY = ref(0);
const touchCurrentY = ref(0);
const touchDraggedElement = ref(null);
const touchScrollStartY = ref(0);
const isDraggingTouch = ref(false);

// Rearranges layers visually during drag for live preview — no jump on drop
const displayLayers = computed(() => {
  if (!isDragging.value || dropIndicatorIndex.value === null || !draggedLayerId.value) {
    return overlayLayers.value;
  }
  const draggedIdx = overlayLayers.value.findIndex(l => l._layerId === draggedLayerId.value);
  if (draggedIdx === -1) return overlayLayers.value;
  const target = dropIndicatorIndex.value;
  // Same position — no visual change needed
  if (target === draggedIdx || target === draggedIdx + 1) return overlayLayers.value;
  const arr = [...overlayLayers.value];
  const [dragged] = arr.splice(draggedIdx, 1);
  arr.splice(target > draggedIdx ? target - 1 : target, 0, dragged);
  return arr;
});

const handleDragStart = (event, layer) => {
  draggedLayerId.value = layer._layerId;
  isDragging.value = true;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', layer._layerId);
};

const handleDragEnd = () => {
  draggedLayerId.value = null;
  dropIndicatorIndex.value = null;
  isDragging.value = false;
};

const handleDragOver = (event, layer) => {
  if (!draggedLayerId.value || draggedLayerId.value === layer._layerId) return;
  // Always look up by ID in the original array so positions are stable
  const originalIndex = overlayLayers.value.findIndex(l => l._layerId === layer._layerId);
  if (originalIndex === -1) return;
  const rect = event.currentTarget.getBoundingClientRect();
  dropIndicatorIndex.value = event.clientY < rect.top + rect.height / 2 ? originalIndex : originalIndex + 1;
};

// Fallback: fires when cursor is over empty space below the last row
const handleListDragOver = () => {
  if (isDragging.value) dropIndicatorIndex.value = overlayLayers.value.length;
};

const executeDrop = () => {
  const draggedId = draggedLayerId.value;
  if (!draggedId || dropIndicatorIndex.value === null) return;
  const draggedIndex = overlayLayers.value.findIndex(l => l._layerId === draggedId);
  if (draggedIndex === -1) return;
  const clamped = Math.max(0, Math.min(dropIndicatorIndex.value, overlayLayers.value.length));
  if (draggedIndex !== clamped && draggedIndex + 1 !== clamped) {
    layerStore.reorderLayer(draggedId, clamped);
  }
  draggedLayerId.value = null;
  dropIndicatorIndex.value = null;
  isDragging.value = false;
};

// Touch event handlers for mobile
const handleTouchStart = (event, layer) => {
  // Allow touch dragging for all layers
  const touch = event.touches[0];
  touchStartY.value = touch.clientY;
  touchCurrentY.value = touch.clientY;
  touchScrollStartY.value = event.target.closest('.layer-list')?.scrollTop || 0;
  touchDraggedElement.value = event.currentTarget;
  isDraggingTouch.value = false; // Start as false, will become true if moved enough
  
  // Store the layer being touched
  draggedLayerId.value = layer._layerId;
};

const handleTouchMove = (event) => {
  if (!draggedLayerId.value || !touchDraggedElement.value) return;
  
  const touch = event.touches[0];
  const deltaY = Math.abs(touch.clientY - touchStartY.value);
  
  // Only start dragging if moved more than 10px (prevents accidental drags)
  if (deltaY > 10) {
    isDraggingTouch.value = true;
    event.preventDefault(); // Prevent scrolling when dragging
    
    touchCurrentY.value = touch.clientY;
    
    // Find which layer is under the touch point
    const layerList = touchDraggedElement.value.closest('.layer-list');
    const layers = Array.from(layerList.querySelectorAll('.layer-row'));
    
    let targetLayer = null;
    let targetLayerIndex = -1;
    
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const rect = layer.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        targetLayer = layer;
        targetLayerIndex = i;
        
        // Calculate if touch is in top or bottom half
        const midpoint = rect.top + rect.height / 2;
        if (touch.clientY < midpoint) {
          // Drop above this layer
          dropIndicatorIndex.value = i;
        } else {
          // Drop below this layer
          dropIndicatorIndex.value = i + 1;
        }
        break;
      }
    }
    
    // Update drag over state
    if (targetLayer) {
      const targetId = overlayLayers.value.find(
        l => targetLayer.textContent.includes(l.name)
      )?._layerId;
      
      if (targetId && targetId !== draggedLayerId.value) {
        dragOverLayerId.value = targetId;
      } else {
        dragOverLayerId.value = null;
      }
    } else {
      dragOverLayerId.value = null;
      dropIndicatorIndex.value = null;
    }
  }
};

const handleTouchEnd = (event) => {
  if (!draggedLayerId.value || !isDraggingTouch.value) {
    // If we didn't actually drag, just clear state
    draggedLayerId.value = null;
    touchDraggedElement.value = null;
    isDraggingTouch.value = false;
    return;
  }
  
  event.preventDefault();
  
  // Get the target layer under the touch point
  if (dropIndicatorIndex.value !== null && draggedLayerId.value) {
    const draggedIndex = overlayLayers.value.findIndex(l => l._layerId === draggedLayerId.value);
    
    if (draggedIndex !== -1) {
      // dropIndicatorIndex represents where to insert in the current array
      // reorderLayer will handle the adjustment after removal
      const targetIndex = dropIndicatorIndex.value;
      
      // Clamp to valid range
      const clampedTargetIndex = Math.max(0, Math.min(targetIndex, overlayLayers.value.length));
      
      // Only reorder if position actually changed
      if (draggedIndex !== clampedTargetIndex && draggedIndex + 1 !== clampedTargetIndex) {
        layerStore.reorderLayer(draggedLayerId.value, clampedTargetIndex);
      }
    }
  }
  
  // Clear all touch drag state
  draggedLayerId.value = null;
  dropIndicatorIndex.value = null;
  isDragging.value = false;
  touchDraggedElement.value = null;
  isDraggingTouch.value = false;
  touchStartY.value = 0;
  touchCurrentY.value = 0;
};
</script>

<style scoped>
/* Keeping your exact styles as they are perfect */
.layerpanel {
  width: 100%;
  height: 100%;
  background: #f8f9fa;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  font-family: "Segoe UI", sans-serif;
  z-index: 2000;
  pointer-events: auto;
}

.theme-dark .layerpanel {
  background: #2a2a2a;
  border-right: 1px solid #444;
}

.header {
  padding: 0 15px;
  background: #343a40;
  color: white;
  height: 48px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.theme-dark .header {
  background: #1a1a1a;
}

.header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.layer-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  position: relative; /* For absolute positioning of drop indicator */
  /* Improve touch scrolling on mobile */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* Smooth reorder animation */
.layers-move {
  transition: transform 0.2s ease;
}

/* Suppress hover highlight while dragging */
.is-dragging .layer-row:hover:not(.layer-error) {
  background: inherit;
}
.theme-dark .is-dragging .layer-row:hover:not(.layer-error) {
  background: inherit;
}

.layer-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px;
  margin-bottom: 5px;
  background: white;
  border: 1px solid #eee;
  border-radius: 4px;
  transition: opacity 0.15s ease;
  overflow: hidden;
  cursor: grab;
}

.layer-row.dragging {
  opacity: 0.35;
  cursor: grabbing;
}

.theme-dark .layer-row {
  background: #3a3a3a;
  border: 1px solid #4a4a4a;
}

.layer-row:hover:not(.layer-error) {
  background: #f1f1f1;
}

.theme-dark .layer-row:hover:not(.layer-error) {
  background: #454545;
}

.layer-row.active {
  border-left: 4px solid #007bff;
}

.layer-row.is-idle .layer-name-text {
  color: #777;
}
.layer-row.is-idle .geom-icon {
  opacity: 0.5;
  filter: grayscale(100%);
}

.progress-bg {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: #e9ecef;
}

.progress-fill {
  height: 100%;
  background: #17a2b8;
  transition: width 0.3s ease;
}

.progress-fill.processing {
  background: #28a745;
}

.progress-fill.loading-details {
  background: #ffc107;
}

.loading-text {
  color: #6c757d;
  font-size: 11px;
  margin-left: 5px;
}

label {
  display: flex;
  align-items: center;
  width: 100%;
  cursor: pointer;
  z-index: 1;
}

.layer-title-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-left: 10px;
}

.layer-name-text {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.theme-dark .layer-name-text {
  color: #e0e0e0;
}

.layer-error {
  background: #fdf2f2 !important;
  border: 1px solid #fababa !important;
  cursor: not-allowed;
}

.theme-dark .layer-error {
  background: rgba(220, 53, 69, 0.2) !important;
  border: 1px solid rgba(220, 53, 69, 0.5) !important;
}

.disabled-label {
  cursor: not-allowed;
}

.action-buttons {
  display: flex;
  gap: 4px;
  margin-left: 8px;
  flex-shrink: 0;
}

.order-buttons {
  display: flex;
  gap: 2px;
}

.order-btn {
  background: none;
  border: none;
  padding: 2px 4px;
  cursor: pointer;
  font-size: 10px;
  color: #666;
  line-height: 1;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.theme-dark .order-btn {
  color: #aaa;
}

.order-btn:hover:not(:disabled) {
  opacity: 1;
  color: #333;
}

.theme-dark .order-btn:hover:not(:disabled) {
  color: #fff;
}

.order-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.action-btn {
  background: none;
  border: none;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 14px;
  border-radius: 3px;
  transition: background-color 0.2s;
  line-height: 1;
}

.warning-icon {
  font-size: 16px;
  line-height: 1;
  cursor: help;
  padding: 0 4px;
}

.cancel-btn:hover {
  background-color: #ffebee;
}

.cancel-btn {
  color: #f44336;
  font-weight: bold;
}

.remove-btn {
  color: #dc2626;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.layer-row:hover .remove-btn {
  opacity: 1;
}

.theme-dark .remove-btn:hover {
  background-color: #3a1a1a;
}

.remove-btn:hover {
  background-color: #fee2e2;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.theme-dark .empty-state {
  color: #666;
}

.icon-container {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  margin-right: 4px;
  flex-shrink: 0;
}

.geom-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #ccc;
  border-top-color: #007bff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

input[type="checkbox"] {
  cursor: pointer;
  flex-shrink: 0;
}

input[type="checkbox"]:disabled {
  cursor: not-allowed;
}

.layerpanel-footer {
  padding: 10px;
  border-top: 1px solid #eee;
  background: #f9f9f9;
}

.theme-dark .layerpanel-footer {
  border-top: 1px solid #444;
  background: #2a2a2a;
}

.settings-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #555;
  font-weight: 500;
  transition: background 0.2s;
}

.theme-dark .settings-btn {
  color: #ccc;
}

.settings-btn:hover {
  background: #e0e0e0;
  color: #000;
}

.theme-dark .settings-btn:hover {
  background: #3a3a3a;
  color: #fff;
}

.icon {
  font-size: 1.2rem;
}
</style>