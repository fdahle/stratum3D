<template>
  <div id="app" :class="'theme-' + theme">
    <div v-if="isConfigLoaded">
      <router-view />
    </div>

    <div v-else-if="configError" class="error-screen">
      <div class="error-modal">
        <div class="error-icon">{{ STRINGS.errors.warning || '⚠️' }}</div>
        <h2>{{ STRINGS.config.error }}</h2>
        <div class="error-details">{{ configError }}</div>
        <button class="retry-btn" @click="reloadApp">{{ STRINGS.config.reloadApp }}</button>
      </div>
    </div>

    <div v-else class="loading">{{ STRINGS.config.loading }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, provide, watch } from "vue";
import { storeToRefs } from "pinia";
import yaml from "js-yaml";
import { validateConfig } from "./constants/configValidation";
import { STRINGS } from "./constants/strings";
import { useSettingsStore } from "./stores/settingsStore";
import { logger } from "./utils/logger";
import { enableDevMode } from "./utils/devTools";

const appConfig = ref(null);
const isConfigLoaded = ref(false);
const configError = ref(null);

// Theme management
const settingsStore = useSettingsStore();
const { theme } = storeToRefs(settingsStore);

// Apply theme to document body
watch(theme, (newTheme) => {
  document.body.className = `theme-${newTheme}`;
}, { immediate: true });

// --- 1. RESTORE THIS MISSING PART ---
const layerManagerRef = ref(null);
provide("layerManager", layerManagerRef);
// ------------------------------------

provide("config", appConfig);

onMounted(async () => {
  // Enable development tools in dev mode
  if (import.meta.env.DEV) {
    enableDevMode();
  }
  
  try {
    const res = await fetch("/config.yaml");
    if (!res.ok) throw new Error(`Config not found: ${res.status}`);
    const txt = await res.text();
    const parsed = yaml.load(txt);

    // Validate configuration
    validateConfig(parsed);

    appConfig.value = parsed;
    isConfigLoaded.value = true;
    
    // Apply website settings (title and favicon) if provided
    try {
      const site = parsed.website || {};
      if (site.title) {
        document.title = site.title;
      }

      if (site.favicon) {
        // Update existing <link rel="icon"> or create one
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = site.favicon;
      }
    } catch (e) {
      logger.warn('App', 'Failed to apply website settings:', e);
    }
  } catch (e) {
    logger.error('App', 'Failed to load config:', e);
    configError.value = e.message;
  }
});

const reloadApp = () => window.location.reload();
</script>

<style>
@import './assets/error-screen.css';

/* Global Styles */
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Dark theme (default) */
body.theme-dark {
  background: #1a1a1a;
  color: #e0e0e0;
}

/* Light theme */
body.theme-light {
  background: #ffffff;
  color: #1a1a1a;
}

#app {
  height: 100%;
  width: 100%;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #666;
}

.theme-light .loading {
  color: #999;
}
</style>