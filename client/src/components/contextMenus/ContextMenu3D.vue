<template>
  <div v-if="visible">
    <div class="overlay" @click="close"></div>

    <div
      class="context-menu"
      :style="{ top: `${y}px`, left: `${x}px` }"
      @click.stop
    >
      <ul>
        <li @click="emitAction('info')">ℹ️ Layer Info</li>
        <li @click="emitAction('zoom')">🔍 Zoom to Layer</li>
        <li @click="emitAction('fit')">📐 Fit to View</li>

        <!-- Inline point size slider — only for point cloud layers -->
        <template v-if="payload?.type === 'pointcloud'">
          <li class="separator"></li>
          <li class="point-size-item" @click.stop>
            <span class="ps-label">⬤ Point size</span>
            <div class="ps-control">
              <input
                type="range" min="1" max="10" step="0.5"
                :value="currentPointSize"
                @input="handlePointSizeInput(+$event.target.value)"
                @click.stop
              />
              <span class="ps-value">{{ currentPointSize }}px</span>
            </div>
          </li>
        </template>

        <li class="separator"></li>
        <li @click="emitAction('remove')">🗑️ Remove Layer</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const visible = ref(false);
const x = ref(0);
const y = ref(0);
const payload = ref(null);
const currentPointSize = ref(2);

const emit = defineEmits(["action", "point-size-change"]);

const open = (event, data) => {
  const mouseEvent = event.originalEvent || event;

  x.value = mouseEvent.clientX;
  y.value = mouseEvent.clientY;

  payload.value = data;

  // Initialise slider from current material
  if (data?.type === 'pointcloud' && data.object) {
    let size = 2;
    data.object.traverse((child) => {
      if (child.isPoints && child.material) size = child.material.size;
    });
    currentPointSize.value = size;
  }

  visible.value = true;
};

const close = () => {
  visible.value = false;
};

const emitAction = (type) => {
  emit("action", { type, layer: payload.value });
  close();
};

const handlePointSizeInput = (size) => {
  currentPointSize.value = size;
  emit("point-size-change", { size, layer: payload.value });
};

defineExpose({ open, close });
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  background: white;
  border: 1px solid #ccc;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  min-width: 200px;
  font-family: "Segoe UI", sans-serif;
  font-size: 13px;
  color: #333;
}

.theme-dark .context-menu {
  background: #2a2a2a;
  border: 1px solid #555;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.6);
  color: #e0e0e0;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9998;
  cursor: default;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
}

.theme-dark li {
  border-bottom: 1px solid #444;
}

li:last-child {
  border-bottom: none;
}

li:hover {
  background: #f0f0f0;
}

.theme-dark li:hover {
  background: #3a3a3a;
}

.separator {
  height: 1px;
  background: #eee;
  padding: 0;
  margin: 2px 0;
  cursor: default;
}

.theme-dark .separator {
  background: #444;
}

/* --- Point size inline control --- */
.point-size-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  cursor: default;
  padding: 8px 12px;
}

.point-size-item:hover {
  background: transparent;
}

.ps-label {
  font-size: 12px;
  font-weight: 600;
  color: #555;
}

.theme-dark .ps-label {
  color: #bbb;
}

.ps-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ps-control input[type=range] {
  flex: 1;
  accent-color: #007bff;
  cursor: pointer;
}

.ps-value {
  font-size: 11px;
  color: #007bff;
  min-width: 30px;
  text-align: right;
  font-family: 'Courier New', monospace;
}
</style>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  background: white;
  border: 1px solid #ccc;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  min-width: 160px;
  font-family: "Segoe UI", sans-serif;
  font-size: 13px;
  color: #333;
}

.theme-dark .context-menu {
  background: #2a2a2a;
  border: 1px solid #555;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.6);
  color: #e0e0e0;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9998;
  cursor: default;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
}

.theme-dark li {
  border-bottom: 1px solid #444;
}

li:last-child {
  border-bottom: none;
}

li:hover {
  background: #f0f0f0;
}

.theme-dark li:hover {
  background: #3a3a3a;
}

.separator {
  height: 1px;
  background: #eee;
  padding: 0;
  margin: 2px 0;
  cursor: default;
}

.theme-dark .separator {
  background: #444;
}

.separator:hover {
  background: #eee;
}

.theme-dark .separator:hover {
  background: #444;
}
</style>
