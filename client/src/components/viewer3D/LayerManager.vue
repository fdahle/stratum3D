<template>
  <div class="layer-manager">
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
          {{ layer.visible ? '👁️' : '👁️‍🗨️' }}
        </button>
        
        <span class="layer-icon">{{ getLayerIcon(layer.type) }}</span>
        <span class="layer-name">{{ layer.name }}</span>
        
        <button 
          class="layer-action" 
          @click.stop="removeLayer(layer.id)"
          title="Remove layer"
        >
          ×
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

const emit = defineEmits(['toggle-layer-visibility', 'remove-layer']);

const layers = ref([]);
const selectedLayerId = ref(null);

const getLayerIcon = (type) => {
  switch(type) {
    case 'model': return '🏔️';
    case 'pointcloud': return '☁️';
    case 'camera': return '📷';
    default: return '📦';
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
.layer-manager {
  position: absolute;
  top: 80px;
  left: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  width: 260px;
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  z-index: 800;
  backdrop-filter: blur(10px);
}

.layer-header {
  padding: 10px 12px;
  border-bottom: 1px solid #e0e0e0;
  background: linear-gradient(to bottom, #f9f9f9 0%, #f0f0f0 100%);
  border-radius: 4px 4px 0 0;
}

.layer-header h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.layer-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.layer-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  margin: 2px 0;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.15s;
  gap: 6px;
}

.layer-item:hover {
  background: rgba(0, 123, 255, 0.08);
}

.layer-item.selected {
  background: rgba(0, 123, 255, 0.15);
  border-left: 3px solid #007bff;
  padding-left: 5px;
}

.visibility-btn {
  padding: 2px 4px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.visibility-btn:hover {
  opacity: 1;
}

.layer-icon {
  font-size: 14px;
}

.layer-name {
  flex: 1;
  font-size: 11px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-action {
  padding: 0;
  width: 18px;
  height: 18px;
  border: none;
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
  border-radius: 3px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: all 0.15s;
}

.layer-action:hover {
  opacity: 1;
  background: rgba(220, 53, 69, 0.2);
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 11px;
}

/* Scrollbar styling */
.layer-list::-webkit-scrollbar {
  width: 6px;
}

.layer-list::-webkit-scrollbar-track {
  background: transparent;
}

.layer-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.layer-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>
