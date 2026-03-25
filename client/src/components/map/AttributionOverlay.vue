<template>
  <div v-if="attributions.length" class="attribution-overlay" :style="{ bottom: bottomOffset }">
    <span
      v-for="(text, i) in attributions"
      :key="i"
      class="attribution-item"
      v-html="text"
    ></span>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useLayerStore } from "../../stores/map/layerStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { LAYER_CATEGORY } from "../../constants/layerConstants";

const layerStore = useLayerStore();
const settingsStore = useSettingsStore();
const { layers } = storeToRefs(layerStore);
const { showInfoBar } = storeToRefs(settingsStore);

const bottomOffset = computed(() => showInfoBar.value ? '32px' : '4px');

// Collect attributions from all currently active base layers
const attributions = computed(() => {
  const seen = new Set();
  return layers.value
    .filter(l => l.category === LAYER_CATEGORY.BASE && l.active && l.attribution)
    .map(l => l.attribution)
    .filter(text => {
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    });
});
</script>

<style scoped>
.attribution-overlay {
  position: absolute;
  /* bottom is set dynamically via :style binding */
  right: 8px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  pointer-events: none;
}

.attribution-item {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 10px;
  color: #333;
  line-height: 1.4;
  backdrop-filter: blur(2px);
  pointer-events: all;
  max-width: 420px;
  text-align: right;
}

.theme-dark .attribution-item {
  background: rgba(30, 30, 30, 0.82);
  color: #bbb;
}

/* Allow links inside attribution HTML to be styled */
.attribution-item :deep(a) {
  color: inherit;
  text-decoration: underline;
}
</style>
