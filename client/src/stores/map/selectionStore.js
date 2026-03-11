import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useSelectionStore = defineStore("selection", () => {
  const selectedFeatures = ref([]);
  // When user clicks into the detail view from a multi-selection list
  const activeDetailFeature = ref(null);

  // Backward-compat: single selected feature (only when exactly one is selected, or when drilling into detail)
  const selectedFeature = computed(() => {
    if (activeDetailFeature.value) return activeDetailFeature.value;
    if (selectedFeatures.value.length === 1) return selectedFeatures.value[0];
    return null;
  });

  // Single click: toggle the feature in/out of the selection (replaces entire set if no shift)
  function selectFeature(feature) {
    activeDetailFeature.value = null;
    const existingIdx = selectedFeatures.value.findIndex(
      (f) => f.properties._featureId === feature.properties._featureId
    );
    if (existingIdx !== -1) {
      selectedFeatures.value = selectedFeatures.value.filter((_, i) => i !== existingIdx);
    } else {
      selectedFeatures.value = [feature];
    }
  }

  // Replace the entire selection (used by DragBox and by the Select event sync)
  function setSelectedFeatures(features) {
    activeDetailFeature.value = null;
    selectedFeatures.value = features;
  }

  // Navigate into detail view from the multi-select list
  function setActiveDetailFeature(feature) {
    activeDetailFeature.value = feature;
  }

  function clearActiveDetail() {
    activeDetailFeature.value = null;
  }

  function clearSelection() {
    selectedFeatures.value = [];
    activeDetailFeature.value = null;
  }

  return {
    selectedFeatures,
    selectedFeature,
    activeDetailFeature,
    selectFeature,
    setSelectedFeatures,
    setActiveDetailFeature,
    clearActiveDetail,
    clearSelection,
  };
});
