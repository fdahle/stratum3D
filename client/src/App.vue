<template>
  <div id="app">
    <div v-if="isConfigLoaded" class="app-layout">
      <button class="menu-toggle" @click="isSidebarOpen = !isSidebarOpen">
        ☰
      </button>

      <SideBar
        class="main-sidebar"
        :class="{ open: isSidebarOpen }"
        @open-settings="isSettingsOpen = true"
      />

      <div
        v-if="isSidebarOpen"
        class="sidebar-overlay"
        @click="isSidebarOpen = false"
      ></div>

      <div class="map-area">
        <MapWidget />
        <SearchBar />

        <div
          class="bottom-left-control"
          :class="{ 'has-info-bar': settingsStore.showInfoBar }"
        >
          <BaseMapSwitcher />
        </div>

        <InformationBar v-if="settingsStore.showInfoBar" />

        <AttributePanel />
      </div>

      <Settings :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
    </div>

    <div v-else-if="configError" class="error-screen">
      <div class="error-modal">
        <div class="error-icon">⚠️</div>
        <h2>Configuration Error</h2>
        <p>
          The app could not be loaded because <code>config.yaml</code> has
          errors.
        </p>

        <div class="error-details">
          {{ configError }}
        </div>

        <button class="retry-btn" @click="reloadApp">Reload App</button>
      </div>
    </div>

    <div v-else class="loading">Loading Configuration...</div>
  </div>
</template>

<script setup>

//import libraries
import { ref, onMounted, provide } from "vue";
import yaml from "js-yaml";

// import components
import AttributePanel from "./components/AttributePanel.vue";
import BaseMapSwitcher from "./components/BaseMapSwitcher.vue";
import InformationBar from "./components/InformationBar.vue";
import MapWidget from "./components/MapWidget.vue";
import SearchBar from "./components/SearchBar.vue";
import SideBar from "./components/SideBar.vue";
import Settings from "./components/modals/Settings.vue";
import { useSettingsStore } from "./stores/settingsStore";

// import constants
import { CONFIG_SCHEMA } from "./constants/configSchema";

// config variables
const appConfig = ref(null); // the configuration object
const isConfigLoaded = ref(false); // flag to indicate if config is loaded
const configError = ref(null); // contains any error during config load

// function to validate the config
const validateConfig = (config) => {
  if (!config) throw new Error("Configuration file is empty.");

  // 1. Basic Structure Checks
  if (!config.view) throw new Error("Missing 'view' section.");
  CONFIG_SCHEMA.view.required.forEach(field => {
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
    const prefix = `base_layers[${index}] (${layer.name || 'unnamed'})`;
    
    // Check type validity
    if (!CONFIG_SCHEMA.layerTypes[layer.type]) {
      throw new Error(`${prefix}: Invalid type '${layer.type}'. Allowed: ${Object.keys(CONFIG_SCHEMA.layerTypes).join(", ")}`);
    }

    // Check specific attributes for that type
    const requiredFields = CONFIG_SCHEMA.layerTypes[layer.type].required;
    requiredFields.forEach(field => {
      if (!layer[field]) throw new Error(`${prefix}: Missing required field '${field}' for type '${layer.type}'.`);
    });

    // Check Order Logic
    if (typeof layer.order !== 'number') throw new Error(`${prefix}: 'order' must be a number.`);
    baseOrders.push(layer.order);
  });

  // Check for duplicate orders in base layers
  if (new Set(baseOrders).size !== baseOrders.length) {
    throw new Error("Base layers must have unique 'order' values.");
  }

  // 3. Validate Overlay Layers
  if (config.overlay_layers) {
    config.overlay_layers.forEach((layer, index) => {
      const prefix = `overlay_layers[${index}] (${layer.name || 'unnamed'})`;
      
      if (layer.type !== "geojson") {
        throw new Error(`${prefix}: Currently only 'geojson' is supported for overlays.`);
      }

      const requiredGeoJson = CONFIG_SCHEMA.layerTypes.geojson.required;
      requiredGeoJson.forEach(field => {
        if (!layer[field]) throw new Error(`${prefix}: Missing required field '${field}'.`);
      });
    });
  }

  // 4. Global Logic: Ensure exactly one visible base layer
  const visibleBaseLayers = config.base_layers.filter(l => l.visible);
  if (visibleBaseLayers.length === 0) {
    throw new Error("No base layer is set to 'visible: true'. The map will be empty.");
  }
  if (visibleBaseLayers.length > 1) {
    throw new Error("Multiple base layers are set to 'visible: true'. Please choose only one default.");
  }

  return true;
};

// provide config to the rest of the app
provide("config", appConfig);

// settings variables
const settingsStore = useSettingsStore();
const isSettingsOpen = ref(false);

// sidebar variables
const isSidebarOpen = ref(false);

// load configuration on mount
onMounted(async () => {
  try {
    const res = await fetch("/config.yaml");

    // Check status strictly
    if (!res.ok || res.status === 404) {
      throw new Error(`Configuration file not found (Status ${res.status})`);
    }

    // Prevent parsing if the server sent back index.html as a fallback
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      throw new Error("The server returned HTML instead of YAML. Check if the file name is correct.");
    }

    // Get text of the response
    const txt = await res.text();

    // Parse YAML
    let parsed;
    try {
      parsed = yaml.load(txt);
    } catch (e) {
      throw new Error(`YAML Syntax Error: ${e.message}`);
    }

    // Validate
    validateConfig(parsed);

    // Success
    appConfig.value = parsed;
    isConfigLoaded.value = true;

  } catch (e) {
    console.error(e);
    configError.value = e.message; // <--- Set the error to show modal
  }
});
</script>

<style>
/* GLOBAL RESETS */
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

.app-layout {
  display: flex;
  height: 100%;
  width: 100%;
  position: relative;
}

/* --- DEFAULT DESKTOP STYLES --- */
.main-sidebar {
  width: 280px;
  flex-shrink: 0;
  z-index: 2000;
  background: white;
}

.map-area {
  flex: 1;
  position: relative;
}

.menu-toggle {
  display: none;
}

.sidebar-overlay {
  display: none;
}

/* --- CONTROL POSITIONING --- */
.bottom-left-control {
  position: absolute;
  bottom: 25px;
  left: 20px;
  z-index: 1000;
  transition: bottom 0.3s ease; /* Smooth animation */
}

/* 4. ADDED: Moves switcher up when InfoBar is visible */
.bottom-left-control.has-info-bar {
  bottom: 40px; /* 28px bar + 12px gap */
}

/* --- MOBILE STYLES (Max Width 768px) --- */
@media (max-width: 768px) {
  .menu-toggle {
    display: block;
    position: absolute;
    top: 15px;
    left: 15px;
    z-index: 3000;
    background: white;
    border: none;
    font-size: 24px;
    padding: 8px 12px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  .main-sidebar {
    position: absolute;
    top: 0;
    left: -280px;
    height: 100%;
    transition: left 0.3s ease-in-out;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
  }

  .main-sidebar.open {
    left: 0;
  }

  .sidebar-overlay {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1500;
    backdrop-filter: blur(2px);
  }

  .bottom-left-control {
    bottom: 30px;
    left: 10px;
    transform: scale(0.9);
    transform-origin: bottom left;
  }

  /* Adjust mobile spacing for InfoBar */
  .bottom-left-control.has-info-bar {
    bottom: 45px;
  }

  .attribute-panel {
    width: 100% !important;
    height: 50% !important;
    top: auto !important;
    bottom: 0 !important;
    border-top: 2px solid #ddd;
  }
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-family: sans-serif;
  color: #666;
}

/* Add simple styles for the error modal */
.error-screen {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f3f4f6;
}
.error-modal {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  text-align: center;
}
.error-details {
  background: #fee2e2;
  color: #b91c1c;
  padding: 1rem;
  border-radius: 4px;
  margin: 1.5rem 0;
  text-align: left;
  font-family: monospace;
}
.retry-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
</style>