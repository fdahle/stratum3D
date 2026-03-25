<template>
  <div v-if="visible">
    <div class="overlay" @click="close"></div>

    <div
      class="context-menu"
      :style="{ top: `${y}px`, left: `${x}px` }"
      @click.stop
    >
      <ul>
        <li @click="emitAction('info')"><span class="menu-icon" v-html="ICON_INFO_SM"></span> Layer Info</li>
        <li @click="emitAction('zoom')"><span class="menu-icon" v-html="ICON_ZOOM_SM"></span> Zoom to Layer</li>
        <li @click="emitAction('fit')"><span class="menu-icon" v-html="ICON_FIT_SM"></span> Fit to View</li>

        <li class="separator"></li>
        <li class="danger" @click="handleRemove()"><span class="menu-icon" v-html="ICON_TRASH_SM"></span> Remove Layer</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const ICON_INFO_SM   = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>`;
const ICON_ZOOM_SM   = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const ICON_FIT_SM    = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const ICON_TRASH_SM  = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

const visible = ref(false);
const x = ref(0);
const y = ref(0);
const payload = ref(null);

const emit = defineEmits(["action"]);

const open = (event, data) => {
  const mouseEvent = event.originalEvent || event;

  x.value = mouseEvent.clientX;
  y.value = mouseEvent.clientY;

  payload.value = data;
  visible.value = true;
};

const close = () => {
  visible.value = false;
};

const emitAction = (type) => {
  emit("action", { type, layer: payload.value });
  close();
};

const handleRemove = () => {
  const name = payload.value?.name || 'this layer';
  if (!confirm(`Remove "${name}"? This cannot be undone.`)) return;
  emitAction('remove');
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
  display: flex;
  align-items: center;
  gap: 7px;
}

.menu-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: #555;
}

.theme-dark .menu-icon {
  color: #aaa;
}

li.danger {
  color: #dc2626;
}

.theme-dark li.danger {
  color: #f87171;
}

li.danger:hover {
  background: #fee2e2;
}

.theme-dark li.danger:hover {
  background: #3a1a1a;
}

.theme-dark li {
  border-bottom: 1px solid #444;
}

li:last-child {
  border-bottom: none;
}

li:has(+ .separator) {
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
  border-bottom: none;
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
