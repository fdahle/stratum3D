<template>
  <div id="app">
    <div v-if="isConfigLoaded">
      <router-view />
    </div>

    <div v-else-if="configError" class="error-screen">
      <div class="error-modal">
        <div class="error-icon">⚠️</div>
        <h2>Configuration Error</h2>
        <div class="error-details">{{ configError }}</div>
        <button class="retry-btn" @click="reloadApp">Reload App</button>
      </div>
    </div>

    <div v-else class="loading">Loading Configuration...</div>
  </div>
</template>

<script setup>
import { ref, onMounted, provide } from "vue";
import yaml from "js-yaml";
import { CONFIG_SCHEMA } from "./constants/configSchema";

const appConfig = ref(null);
const isConfigLoaded = ref(false);
const configError = ref(null);

// --- 1. RESTORE THIS MISSING PART ---
const layerManagerRef = ref(null);
provide("layerManager", layerManagerRef);
// ------------------------------------

provide("config", appConfig);

// function to validate the config
const validateConfig = (config) => {
  if (!config) throw new Error("Configuration file is empty.");

  // 1. Basic Structure Checks
  if (!config.view) throw new Error("Missing 'view' section.");
  CONFIG_SCHEMA.view.required.forEach((field) => {
    if (config.view[field] === undefined) {
      throw new Error(`view.${field} is required.`);
    }
  });

  // 2. Validate Base Layers
  if (!Array.isArray(config.base_layers) || config.base_layers.length === 0) {
    throw new Error("You must define at least one base layer.");
  }

  const baseOrders = [];
  config.base_layers.forEach((layer, index) => {
    const prefix = `base_layers[${index}] (${layer.name || "unnamed"})`;

    // Check type validity
    if (!CONFIG_SCHEMA.layerTypes[layer.type]) {
      throw new Error(
        `${prefix}: Invalid type '${layer.type}'. Allowed: ${Object.keys(
          CONFIG_SCHEMA.layerTypes
        ).join(", ")}`
      );
    }

    // Check specific attributes for that type
    const requiredFields = CONFIG_SCHEMA.layerTypes[layer.type].required;
    requiredFields.forEach((field) => {
      if (!layer[field])
        throw new Error(
          `${prefix}: Missing required field '${field}' for type '${layer.type}'.`
        );
    });

    // Check Order Logic
    if (typeof layer.order !== "number")
      throw new Error(`${prefix}: 'order' must be a number.`);
    baseOrders.push(layer.order);
  });

  // Check for duplicate orders in base layers
  if (new Set(baseOrders).size !== baseOrders.length) {
    throw new Error("Base layers must have unique 'order' values.");
  }

  // 3. Validate Overlay Layers
  if (config.overlay_layers) {
    config.overlay_layers.forEach((layer, index) => {
      const prefix = `overlay_layers[${index}] (${layer.name || "unnamed"})`;

      if (layer.type !== "geojson") {
        throw new Error(
          `${prefix}: Currently only 'geojson' is supported for overlays.`
        );
      }

      const requiredGeoJson = CONFIG_SCHEMA.layerTypes.geojson.required;
      requiredGeoJson.forEach((field) => {
        if (!layer[field])
          throw new Error(`${prefix}: Missing required field '${field}'.`);
      });
    });
  }

  // 4. Global Logic: Ensure exactly one visible base layer
  const visibleBaseLayers = config.base_layers.filter((l) => l.visible);
  if (visibleBaseLayers.length === 0) {
    throw new Error(
      "No base layer is set to 'visible: true'. The map will be empty."
    );
  }
  if (visibleBaseLayers.length > 1) {
    throw new Error(
      "Multiple base layers are set to 'visible: true'. Please choose only one default."
    );
  }

  return true;
};

onMounted(async () => {
  try {
    const res = await fetch("/config.yaml");
    if (!res.ok) throw new Error(`Config not found: ${res.status}`);
    const txt = await res.text();
    const parsed = yaml.load(txt);

    // validateConfig(parsed); // Uncomment if you have the function

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