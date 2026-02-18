import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useSettingsStore = defineStore("settings", () => {
  // 1. STATE (Initialize from localStorage if available)
  const storedInfoBar = localStorage.getItem("settings_showInfoBar");
  const storedSelectionColor = localStorage.getItem("settings_selectionColor");
  const storedTheme = localStorage.getItem("settings_theme");
  
  // Default to true if nothing is stored
  const showInfoBar = ref(storedInfoBar !== null ? JSON.parse(storedInfoBar) : true);
  const selectionColor = ref(storedSelectionColor || "#FFFF00");
  const theme = ref(storedTheme || "dark");
  
  // Arrow buttons for layer ordering (default: hidden, use drag & drop)
  const storedShowArrowButtons = localStorage.getItem("settings_showArrowButtons");
  const showArrowButtons = ref(storedShowArrowButtons !== null ? JSON.parse(storedShowArrowButtons) : false);

  // 2. ACTIONS
  const toggleInfoBar = () => {
    showInfoBar.value = !showInfoBar.value;
  };

  const setSelectionColor = (color) => {
    selectionColor.value = color;
  };

  const toggleTheme = () => {
    theme.value = theme.value === "dark" ? "light" : "dark";
  };

  const setTheme = (newTheme) => {
    theme.value = newTheme;
  };
  
  const toggleArrowButtons = () => {
    showArrowButtons.value = !showArrowButtons.value;
  };

  // 3. PERSISTENCE (Automatically save changes)
  watch(showInfoBar, (newValue) => {
    localStorage.setItem("settings_showInfoBar", JSON.stringify(newValue));
  });

  watch(selectionColor, (newValue) => {
    localStorage.setItem("settings_selectionColor", newValue);
  });

  watch(theme, (newValue) => {
    localStorage.setItem("settings_theme", newValue);
  });
  
  watch(showArrowButtons, (newValue) => {
    localStorage.setItem("settings_showArrowButtons", JSON.stringify(newValue));
  });

  return {
    showInfoBar,
    toggleInfoBar,
    selectionColor,
    setSelectionColor,
    theme,
    toggleTheme,
    setTheme,
    showArrowButtons,
    toggleArrowButtons,
  };
});