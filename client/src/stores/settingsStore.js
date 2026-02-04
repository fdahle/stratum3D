import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useSettingsStore = defineStore("settings", () => {
  // 1. STATE (Initialize from localStorage if available)
  const storedInfoBar = localStorage.getItem("settings_showInfoBar");
  const storedSelectionColor = localStorage.getItem("settings_selectionColor");
  
  // Default to true if nothing is stored
  const showInfoBar = ref(storedInfoBar !== null ? JSON.parse(storedInfoBar) : true);
  const selectionColor = ref(storedSelectionColor || "#FFFF00");

  // 2. ACTIONS
  const toggleInfoBar = () => {
    showInfoBar.value = !showInfoBar.value;
  };

  const setSelectionColor = (color) => {
    selectionColor.value = color;
  };

  // 3. PERSISTENCE (Automatically save changes)
  watch(showInfoBar, (newValue) => {
    localStorage.setItem("settings_showInfoBar", JSON.stringify(newValue));
  });

  watch(selectionColor, (newValue) => {
    localStorage.setItem("settings_selectionColor", newValue);
  });

  return {
    showInfoBar,
    toggleInfoBar,
    selectionColor,
    setSelectionColor,
  };
});