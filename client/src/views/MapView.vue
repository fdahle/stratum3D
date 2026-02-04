<template>
  <div class="app-layout">
    <button class="menu-toggle" @click="isLayerPanelOpen = !isLayerPanelOpen">
      ☰
    </button>

    <LayerPanel
      class="main-layerpanel"
      :class="{ open: isLayerPanelOpen }"
      @open-settings="isSettingsOpen = true"
    />

    <div
      v-if="isLayerPanelOpen"
      class="layerpanel-overlay"
      @click="isLayerPanelOpen = false"
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
</template>

<script setup>
import { ref, inject } from "vue";
import AttributePanel from "../components/AttributePanel.vue";
import BaseMapSwitcher from "../components/BaseMapSwitcher.vue";
import InformationBar from "../components/InformationBar.vue";
import MapWidget from "../components/MapWidget.vue";
import SearchBar from "../components/SearchBar.vue";
import LayerPanel from "../components/LayerPanel.vue";
import Settings from "../components/modals/Settings.vue";
import { useSettingsStore } from "../stores/settingsStore";

// Re-setup the local state
const settingsStore = useSettingsStore();
const isSettingsOpen = ref(false);
const isLayerPanelOpen = ref(false);

// Note: Config is now provided by App.vue, so we Inject it if needed,
// or just rely on the components using it.
</script>

<style scoped>
/* --- DEFAULT DESKTOP STYLES --- */
.app-layout {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
}

.main-layerpanel {
  width: 280px;
  flex-shrink: 0;
  z-index: 2000;
  background: white;
}

.map-area {
  flex: 1;
  position: relative;
  min-width: 0;
}

.menu-toggle {
  display: none;
}

.layerpanel-overlay {
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

  .main-layerpanel {
    position: absolute;
    top: 0;
    left: -280px;
    height: 100%;
    transition: left 0.3s ease-in-out;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
  }

  .main-layerpanel.open {
    left: 0;
  }

  .layerpanel-overlay {
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