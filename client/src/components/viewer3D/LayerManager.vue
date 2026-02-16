<template>
  <div class="layer-panel">
    <div class="layer-header">
      <h4>Layers</h4>
    </div>
    
    <div class="layer-list">
      <div 
        v-for="layer in layers" 
        :key="layer.id"
        class="layer-item"
        :class="{ selected: selectedLayerId === layer.id }"
        @click="selectLayer(layer.id)"
      >
        <button 
          class="visibility-btn" 
          @click.stop="toggleVisibility(layer)"
          :title="layer.visible ? 'Hide layer' : 'Show layer'"
        >
          <span v-html="layer.visible ? ICON_EYE : ICON_EYE_OFF"></span>
        </button>
        
        <span class="layer-icon" v-html="getLayerIcon(layer.type)"></span>
        <span class="layer-name" :title="layer.name">{{ layer.name }}</span>
        
        <button 
          class="layer-action" 
          @click.stop="removeLayer(layer.id)"
          title="Remove layer"
        >
          <span v-html="ICON_TRASH"></span>
        </button>
      </div>
      
      <div v-if="layers.length === 0" class="empty-state">
        No layers loaded
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import {
  ICON_3D_MODEL,
  ICON_POINT_CLOUD,
  ICON_CAMERA,
  ICON_PACKAGE,
  ICON_EYE,
  ICON_EYE_OFF,
  ICON_TRASH
} from '@/constants/icons.js';

const emit = defineEmits(['toggle-layer-visibility', 'remove-layer']);

const layers = ref([]);
const selectedLayerId = ref(null);

const getLayerIcon = (type) => {
  switch(type) {
    case 'model': return ICON_3D_MODEL;
    case 'pointcloud': return ICON_POINT_CLOUD;
    case 'camera': return ICON_CAMERA;
    default: return ICON_PACKAGE;
  }
};

const addLayer = (layer) => {
  layers.value.push(layer);
  if (layers.value.length === 1) {
    selectedLayerId.value = layer.id;
  }
};

const toggleVisibility = (layer) => {
  layer.visible = !layer.visible;
  emit('toggle-layer-visibility', { layerId: layer.id, visible: layer.visible });
};

const removeLayer = (layerId) => {
  const index = layers.value.findIndex(l => l.id === layerId);
  if (index !== -1) {
    layers.value.splice(index, 1);
    emit('remove-layer', layerId);
    if (selectedLayerId.value === layerId) {
      selectedLayerId.value = layers.value.length > 0 ? layers.value[0].id : null;
    }
  }
};

const selectLayer = (layerId) => {
  selectedLayerId.value = layerId;
};

defineExpose({
  addLayer
});
</script>

<style scoped>
.layer-panel {
  width: 240px;
  height: 100%;
  background: #f8f9fa;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  font-family: "Segoe UI", sans-serif;
  z-index: 800;
}

.layer-header {
  padding: 0 15px;
  height: 48px;
  display: flex;
  align-items: center;
  background: #343a40;
  flex-shrink: 0;
}

.layer-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.3px;
}

.layer-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.layer-item {
  display: flex;
  align-items: center;
  padding: 7px 8px;
  margin-bottom: 2px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
  gap: 8px;
  background: #fff;
  border: 1px solid #eee;
}

.layer-item:hover {
  background: #f1f1f1;
}

.layer-item.selected {
  background: #fff;
  border-left: 4px solid #007bff;
  padding-left: 5px;
}

.visibility-btn {
  padding: 2px;
  border: none;
  background: none;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.visibility-btn:hover {
  opacity: 1;
  color: #333;
}

.visibility-btn :deep(svg) {
  width: 15px;
  height: 15px;
}

.layer-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  flex-shrink: 0;
}

.layer-icon :deep(svg) {
  width: 15px;
  height: 15px;
}

.layer-name {
  flex: 1;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-action {
  padding: 2px;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  color: #999;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.layer-item:hover .layer-action {
  opacity: 0.6;
}

.layer-action:hover {
  opacity: 1 !important;
  color: #dc3545;
  background: rgba(220, 53, 69, 0.1);
}

.layer-action :deep(svg) {
  width: 13px;
  height: 13px;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 12px;
}

/* Scrollbar styling */
.layer-list::-webkit-scrollbar {
  width: 6px;
}

.layer-list::-webkit-scrollbar-track {
  background: transparent;
}

.layer-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

.layer-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
</style>
