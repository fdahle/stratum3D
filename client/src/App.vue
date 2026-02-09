<template>
  <div id="app">
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
import { ref, onMounted, provide } from "vue";
import yaml from "js-yaml";
import { validateConfig } from "./constants/configValidation";
import { STRINGS } from "./constants/strings";

const appConfig = ref(null);
const isConfigLoaded = ref(false);
const configError = ref(null);

// --- 1. RESTORE THIS MISSING PART ---
const layerManagerRef = ref(null);
provide("layerManager", layerManagerRef);
// ------------------------------------

provide("config", appConfig);

onMounted(async () => {
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
      console.warn('Failed to apply website settings:', e);
    }
  } catch (e) {
    console.error(e);
    configError.value = e.message;
  }
});

const reloadApp = () => window.location.reload();
</script>

<style>
/* Global Styles */
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
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
.error-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background: #f3f4f6;
}
.error-modal {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  text-align: center;
}
.retry-btn {
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}
</style>