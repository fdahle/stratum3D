<template>
  <div class="search-wrapper">
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        v-model="query"
        placeholder="Search places, stations..."
        @input="handleInput"
        @focus="isFocused = true"
        @keydown.down.prevent="navigateResults(1)"
        @keydown.up.prevent="navigateResults(-1)"
        @keydown.enter.prevent="selectActiveResult"
      />
      <button v-if="query" class="clear-btn" @click="clearSearch">✕</button>
    </div>

    <ul v-if="showResults" class="results-list">
      <li
        v-for="(result, index) in results"
        :key="result.uid"
        :class="{ 'is-active': index === activeIndex }"
        @click="selectResult(result)"
        @mouseenter="activeIndex = index"
      >
        <div class="result-info">
          <span class="result-name">{{ result.name }}</span>
          <span class="result-layer">{{ result.layerName }}</span>
        </div>
      </li>
    </ul>
    
    <div v-if="query && results.length === 0 && isFocused" class="no-results">
        No matches found
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from "vue";
import { useLayerStore } from "../../stores/map/layerStore";
import { useMapStore } from "../../stores/map/mapStore";

const layerStore = useLayerStore();
const mapStore = useMapStore();
const layerManager = inject("layerManager"); // ref — access via .value

const query = ref("");
const results = ref([]);
const isFocused = ref(false);
const activeIndex = ref(-1);
let debounceTimeout = null;

const showResults = computed(() => {
  return isFocused.value && results.value.length > 0;
});

// --- Search Logic ---
const handleInput = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(performSearch, 300);
};

const performSearch = () => {
  if (!query.value || query.value.length < 2) {
    results.value = [];
    return;
  }

  const searchTerm = query.value.toLowerCase();
  const matches = [];

  // Search only in ACTIVE overlay layers that have a search index.
  // Layers without search_fields in config never get indexed, so they
  // are automatically excluded here.
  layerStore.overlayLayers.forEach((layer) => {
    if (!layer.active || !layerManager.value) return;

    const index = layerManager.value.searchIndex.get(layer._layerId);
    if (!index) return;

    for (const [key, { feature, displayValue }] of index) {
      if (matches.length >= 10) break;

      if (key.includes(searchTerm)) {
        matches.push({
          uid: feature.ol_uid,
          name: displayValue,
          layerName: layer.name,
          feature: feature,
          geometry: feature.getGeometry(),
        });
      }
    }
  });

  results.value = matches;
  activeIndex.value = -1;
};

// --- Navigation ---
const navigateResults = (direction) => {
  if (results.value.length === 0) return;
  activeIndex.value += direction;
  if (activeIndex.value < 0) activeIndex.value = results.value.length - 1;
  if (activeIndex.value >= results.value.length) activeIndex.value = 0;
};

const selectActiveResult = () => {
  if (activeIndex.value >= 0 && activeIndex.value < results.value.length) {
    selectResult(results.value[activeIndex.value]);
  }
};

// --- Selection & Zoom Logic ---
const selectResult = (result) => {
  query.value = result.name;
  isFocused.value = false;

  const map = mapStore.getMap();
  if (!map) {
    console.warn("Map instance not found in store");
    return;
  }

  const geometry = result.geometry;
  if (!geometry) return;

  const view = map.getView();
  
  // 1. Handle Points (Zoom to center)
  if (geometry.getType() === "Point") {
    const coordinates = geometry.getCoordinates();
    view.animate({
      center: coordinates,
      zoom: 12, // Zoom level for points
      duration: 1000,
    });
  } 
  // 2. Handle Lines/Polygons (Fit to extent)
  else {
    const extent = geometry.getExtent();
    view.fit(extent, {
      padding: [100, 100, 100, 100],
      duration: 1000,
      maxZoom: 14
    });
  }
  
  // Optional: Trigger a "flash" selection effect here if you have a selection store
  // selectionStore.selectFeature(result.feature); 
};

const clearSearch = () => {
  query.value = "";
  results.value = [];
  activeIndex.value = -1;
};
</script>

<style scoped>
.search-wrapper {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 350px;
  z-index: 3000; /* Ensure it is above map controls */
  font-family: 'Segoe UI', sans-serif;
}

.search-box {
  display: flex;
  align-items: center;
  background: white;
  padding: 10px 15px;
  border-radius: 30px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  border: 1px solid #e0e0e0;
}

.search-box input {
  border: none;
  outline: none;
  flex: 1;
  font-size: 15px;
  margin: 0 10px;
}

.search-icon {
  font-size: 16px;
  color: #666;
}

.clear-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  font-weight: bold;
}

.clear-btn:hover {
  color: #d32f2f;
}

.results-list {
  list-style: none;
  margin: 8px 0 0 0;
  padding: 5px 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  max-height: 400px;
  overflow-y: auto;
}

.results-list li {
  padding: 10px 20px;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid #f5f5f5;
}

.results-list li:last-child {
  border-bottom: none;
}

.results-list li:hover,
.results-list li.is-active {
  background-color: #f0f7ff;
}

.result-info {
  display: flex;
  flex-direction: column;
}

.result-name {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.result-layer {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.no-results {
    background: white;
    padding: 15px;
    border-radius: 12px;
    margin-top: 8px;
    text-align: center;
    color: #888;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
</style>