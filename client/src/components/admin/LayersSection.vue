<template>
  <section class="admin-section">
    <div class="section-header">
      <div>
        <h2 class="section-title">{{ title }}</h2>
        <p class="section-desc">{{ description }}</p>
      </div>
      <button class="btn-add" @click="openAdd">{{ layerGroup === 'base' ? 'Add Basemap' : 'Add Layer' }}</button>
    </div>

    <div v-if="sectionWarnings.length" class="section-warn-box">
      <p v-for="w in sectionWarnings" :key="w" class="section-warn-line">⚠ {{ w }}</p>
    </div>

    <div v-if="layers.length === 0" class="empty-state">
      No {{ layerGroup === 'base' ? 'basemaps' : 'layers' }} yet. Click <strong>{{ layerGroup === 'base' ? 'Add Basemap' : 'Add Layer' }}</strong> to get started.
    </div>

    <div v-else class="layer-list">
      <div
        v-for="(layer, idx) in layers"
        :key="layer.name + idx"
        class="layer-row"
      >
        <div class="layer-drag-handle" title="Layer order is controlled by the Order field">⠿</div>

        <!-- Type badge -->
        <span class="type-badge" :class="`type-${layer.type}`">{{ layer.type }}</span>

        <!-- Visibility dot -->
        <span
          class="vis-dot"
          :class="{ visible: layer.visible }"
          :title="layer.visible ? 'Visible' : 'Hidden'"
        ></span>

        <div class="layer-info">
          <span class="layer-name">{{ layer.name }}</span>
          <span class="layer-url" :title="layer.url">{{ truncateUrl(layer.url) }}</span>
        </div>

        <div class="layer-order">
          <span class="order-label">order</span>
          <span class="order-val">{{ layer.order }}</span>
        </div>

        <div class="layer-actions">
          <button class="action-btn" title="Edit" @click="openEdit(idx)">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="action-btn action-btn-danger" title="Delete" @click="removeLayer(idx)">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <LayerEditorModal
      :is-open="isModalOpen"
      :layer="editingLayer"
      :layer-group="layerGroup"
      :auth-header="authHeader"
      @save="onModalSave"
      @cancel="isModalOpen = false"
    />
  </section>
</template>

<script setup>
import { ref, computed } from 'vue';
import LayerEditorModal from '../modals/admin/LayerEditorModal.vue';

const props = defineProps({
  title:       String,
  description: String,
  layerGroup:  String,  // 'base' | 'overlay'
  layers:      Array,
  authHeader:  { type: String, default: '' },
});

const emit = defineEmits(['update:layers']);

const isModalOpen  = ref(false);
const editingLayer = ref(null);
const editingIndex = ref(-1);

// ── Section warnings ─────────────────────────────────────────────
const sectionWarnings = computed(() => {
  const warnings = [];
  const layers = props.layers ?? [];

  if (props.layerGroup === 'base') {
    const visCount = layers.filter(l => l.visible).length;
    if (visCount > 1)
      warnings.push(`${visCount} base layers are marked visible — exactly one should be visible at a time.`);
    if (layers.length > 0 && visCount === 0)
      warnings.push('No base layer is set as visible — the map will have no background.');
  }

  const orders = layers.map(l => l.order);
  const dupeOrders = orders.filter((o, i) => orders.indexOf(o) !== i);
  if (dupeOrders.length)
    warnings.push(`Duplicate order value(s): ${[...new Set(dupeOrders)].join(', ')} — layers may render in an unpredictable order.`);

  const names = layers.map(l => l.name).filter(Boolean);
  const dupeNames = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupeNames.length)
    warnings.push(`Duplicate layer name(s): ${[...new Set(dupeNames)].map(n => `"${n}"`).join(', ')}.`);

  return warnings;
});

function openAdd() {
  editingLayer.value = null;
  editingIndex.value = -1;
  isModalOpen.value  = true;
}

function openEdit(idx) {
  editingLayer.value = { ...props.layers[idx] };
  editingIndex.value = idx;
  isModalOpen.value  = true;
}

function removeLayer(idx) {
  const updated = [...props.layers];
  updated.splice(idx, 1);
  emit('update:layers', updated);
}

function onModalSave(layer) {
  const updated = [...props.layers];
  if (editingIndex.value >= 0) {
    updated[editingIndex.value] = layer;
  } else {
    updated.push(layer);
  }
  emit('update:layers', updated);
  isModalOpen.value = false;
}

function truncateUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? '…' + u.pathname.slice(-28) : u.pathname;
    return u.hostname + path;
  } catch {
    return url.length > 50 ? url.slice(0, 48) + '…' : url;
  }
}
</script>

<style scoped>
.admin-section {
  background: var(--admin-surface, #fff);
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 10px;
  padding: 1.25rem;
  font-family: "Segoe UI", sans-serif;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-title {
  margin: 0 0 0.2rem;
  font-size: 1rem;
  font-weight: 600;
}

.section-desc {
  margin: 0;
  font-size: 0.8rem;
  color: var(--admin-muted, #777);
}

.btn-add {
  flex-shrink: 0;
  padding: 0.45rem 0.9rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.825rem;
  font-weight: 600;
  cursor: pointer;
  font-family: "Segoe UI", sans-serif;
  white-space: nowrap;
}
.btn-add:hover { background: #2563eb; }

.empty-state {
  padding: 1.25rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--admin-muted, #777);
  background: var(--admin-bg, #f3f4f6);
  border-radius: 6px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.layer-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 7px;
  background: var(--admin-bg, #f9fafb);
  font-size: 0.875rem;
}

.layer-drag-handle {
  color: var(--admin-muted, #aaa);
  cursor: default;
  font-size: 1rem;
  line-height: 1;
  user-select: none;
}

.type-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}
.type-tile   { background: rgba(99,102,241,0.15); color: #6366f1; }
.type-wmts   { background: rgba(168,85,247,0.15); color: #a855f7; }
.type-wms    { background: rgba(236,72,153,0.15); color: #ec4899; }
.type-geojson  { background: rgba(34,197,94,0.15);  color: #16a34a; }
.type-geotiff  { background: rgba(249,115,22,0.15); color: #ea580c; }

.vis-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--admin-border, #ccc);
  flex-shrink: 0;
}
.vis-dot.visible { background: #22c55e; }

.layer-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}
.layer-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.layer-url {
  font-size: 0.75rem;
  color: var(--admin-muted, #777);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-order {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  min-width: 36px;
}
.order-label { font-size: 0.65rem; color: var(--admin-muted, #aaa); text-transform: uppercase; }
.order-val   { font-size: 0.875rem; font-weight: 600; }

.layer-actions {
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  background: transparent;
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 5px;
  cursor: pointer;
  color: var(--admin-muted, #777);
  transition: background 0.12s, color 0.12s;
}
.action-btn:hover { background: var(--admin-surface, #fff); color: var(--admin-text, #1a1a1a); }
.action-btn-danger:hover { background: rgba(239,68,68,0.08); color: #ef4444; border-color: rgba(239,68,68,0.3); }

.section-warn-box {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.75rem;
}
.section-warn-line {
  margin: 0;
  padding: 0.3rem 0.6rem;
  font-size: 0.78rem;
  color: #b45309;
  background: rgba(217, 119, 6, 0.09);
  border: 1px solid rgba(217, 119, 6, 0.25);
  border-radius: 4px;
}
</style>
