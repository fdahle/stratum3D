<template>
  <div>
    <transition name="slide-right">
      <div v-if="selectedFeature" class="attribute-panel">
        <div class="panel-header">
          <h3>Feature Details</h3>
          <button @click="clearSelection" class="close-btn">×</button>
        </div>

        <div class="panel-content">
          <div
            v-if="selectedFeature.properties._thumbnailUrl"
            class="thumbnail-wrapper"
            @click="showFullImage = true"
          >
            <img
              :src="selectedFeature.properties._thumbnailUrl"
              alt="Feature Thumbnail"
              class="feature-thumbnail clickable"
            />
            <div class="hover-overlay">
              <span>🔍 Enlarge</span>
            </div>
          </div>

          <h2 v-if="featureTitle" class="feature-title">
            {{ featureTitle }}
          </h2>

          <div class="feature-actions" v-if="hasActions">
            <a
              v-if="downloadUrl"
              :href="downloadUrl"
              download
              target="_blank"
              class="action-btn"
              title="Download Image"
            >
              <span class="icon">⬇️</span>
            </a>
            <a
              v-if="model3dUrl"
              :href="model3dUrl"
              target="_blank"
              class="action-btn"
              title="View 3D Model"
            >
              <span class="icon">📦</span>
            </a>
          </div>

          <table class="attr-table">
            <tbody>
              <tr v-for="(value, key) in displayProperties" :key="key">
                <td class="key">{{ formatKey(key) }}</td>
                <td class="value">{{ value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </transition>

    <Teleport to="body">
      <transition name="fade">
        <div
          v-if="showFullImage && selectedFeature?.properties?._thumbnailUrl"
          class="image-modal-overlay"
          @click="showFullImage = false"
        >
          <div class="image-modal-content" @click.stop>
            <button class="modal-close-btn" @click="showFullImage = false">
              ×
            </button>
            <img
              :src="selectedFeature.properties._thumbnailUrl"
              alt="Full Size"
              class="full-image"
            />
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useSelectionStore } from "../stores/selectionStore";
import { useLayerStore } from "../stores/layerStore";
import { formatKey } from "../composables/utils";

const selectionStore = useSelectionStore();
const layerStore = useLayerStore();
const { selectedFeature } = storeToRefs(selectionStore);
const { clearSelection } = selectionStore;

// State for the modal
const showFullImage = ref(false);

// Computed Properties for Actions
const downloadUrl = computed(
  () => selectedFeature.value?.properties?._downloadUrl
);
const model3dUrl = computed(
  () => selectedFeature.value?.properties?._model3dUrl
);
const hasActions = computed(() => downloadUrl.value || model3dUrl.value);

// Computed property to handle all filtering logic
const displayProperties = computed(() => {
  if (!selectedFeature.value?.properties) return {};

  const props = selectedFeature.value.properties;

  return Object.keys(props)
    .filter((key) => {
      // Exclude keys starting with _
      if (key.startsWith("_")) return false;
      // Exclude specific display keys
      if (["name", "color"].includes(key)) return false;
      return true;
    })
    .reduce((obj, key) => {
      obj[key] = props[key];
      return obj;
    }, {});
});

// Computed property for feature title
const featureTitle = computed(() => {
  const props = selectedFeature.value?.properties;
  if (!props?._layerId) return null;

  const layer = layerStore.layers.find((l) => l._layerId === props._layerId);
  const metadata = layer?.metadata || {};
  const headerKey = metadata.headerAttribute;

  return headerKey && props[headerKey] ? props[headerKey] : null;
});
</script>

<style scoped>
.attribute-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 300px;
  height: 100%;
  background: white;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 0 15px;
  background: #343a40;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 48px;
  box-sizing: border-box;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
  display: flex;
  align-items: center;
}

.panel-content {
  padding: 20px;
  overflow-y: auto;
}

/* Updated Thumbnail Styles */
.thumbnail-wrapper {
  width: 100%;
  max-width: 250px;
  margin-bottom: 15px;
  border-radius: 4px;
  overflow: hidden;
  background: #f8f9fa;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.feature-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 1px solid #eee;
  transition: transform 0.3s ease;
}

.hover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.hover-overlay span {
  color: white;
  font-weight: bold;
  font-size: 1.1rem;
  background: rgba(0, 0, 0, 0.5);
  padding: 5px 10px;
  border-radius: 4px;
}

.thumbnail-wrapper:hover .hover-overlay {
  opacity: 1;
}

.thumbnail-wrapper:hover .feature-thumbnail {
  transform: scale(1.05);
}

.feature-title {
  margin-top: 0;
  color: #333;
  font-size: 1.2rem;
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 15px;
  text-align: center;
}

.feature-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.action-btn {
  text-decoration: none;
  font-size: 1.5rem;
  transition: transform 0.2s ease;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 45px;
  height: 45px;
  background: #f8f9fa;
  border-radius: 50%;
  border: 1px solid #ddd;
}

.action-btn:hover {
  transform: scale(1.1);
  background: #e9ecef;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.attr-table {
  width: 100%;
  border-collapse: collapse;
}

.attr-table td {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}

.key {
  font-weight: 600;
  color: #666;
  width: 40%;
}

.value {
  color: #333;
}

/* Slide Animation */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

/* Modal Styles */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  z-index: 3000;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: zoom-out;
}

.image-modal-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  cursor: default;
}

.full-image {
  max-width: 100%;
  max-height: 90vh;
  border-radius: 4px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
}

.modal-close-btn {
  position: absolute;
  top: -40px;
  right: -40px;
  background: none;
  border: none;
  color: white;
  font-size: 30px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.modal-close-btn:hover {
  opacity: 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>