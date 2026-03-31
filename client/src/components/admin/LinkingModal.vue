<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="link-modal">

        <!-- ── Header ─── -->
        <header class="modal-header">
          <h3>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" class="header-icon">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            Link 3D Assets &mdash; {{ filename }}
          </h3>
          <div class="header-right">
            <button class="btn-save" :disabled="saving || loading" @click="save">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
            <button class="close-btn" @click="$emit('close')" title="Close">✕</button>
          </div>
        </header>

        <!-- ── Loading / Error ─── -->
        <div v-if="loading" class="modal-status">Loading…</div>
        <div v-else-if="loadError" class="modal-status modal-error">{{ loadError }}</div>

        <!-- ── Body ─── -->
        <div v-else class="link-modal-body">

          <!-- Left: asset palette -->
          <aside class="assets-panel">
            <div class="panel-section">
              <div class="panel-section-title">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                </svg>
                3D Models
              </div>
              <div v-if="!models.length" class="panel-empty">None uploaded</div>
              <div
                v-for="m in models"
                :key="m.dataPath"
                class="asset-item asset-item--model"
                draggable="true"
                @dragstart="onDragStart($event, 'model', m.dataPath)"
                @dragend="dragging = null"
              >
                <span class="asset-name" :title="m.filename">{{ shortName(m.filename) }}</span>
              </div>
            </div>

            <div class="panel-section">
              <div class="panel-section-title">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="5"  r="1.2"/><circle cx="19" cy="8"  r="1.2"/><circle cx="5"  cy="8"  r="1.2"/>
                  <circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="16" r="1.2"/><circle cx="5"  cy="16" r="1.2"/>
                  <circle cx="12" cy="19" r="1.2"/>
                </svg>
                Point Clouds
              </div>
              <div v-if="!pointclouds.length" class="panel-empty">None uploaded</div>
              <div
                v-for="pc in pointclouds"
                :key="pc.dataPath"
                class="asset-item asset-item--pc"
                draggable="true"
                @dragstart="onDragStart($event, 'pointcloud', pc.dataPath)"
                @dragend="dragging = null"
              >
                <span class="asset-name" :title="pc.filename">{{ shortName(pc.filename) }}</span>
              </div>
            </div>

            <p class="drag-hint">Drag assets onto features →</p>
          </aside>

          <!-- Right: feature drop targets -->
          <div class="features-panel">
            <div class="features-header">
              <span class="features-count">{{ features.length }} feature{{ features.length !== 1 ? 's' : '' }}</span>
              <input v-model="filterQuery" class="features-search" placeholder="Filter features…" />
              <button v-if="hasAnyAssignment" class="btn-clear-all" @click="clearAll" title="Remove all assignments">
                Clear all
              </button>
            </div>

            <div class="features-list">
              <div
                v-for="f in filteredFeatures"
                :key="f.featureId"
                class="feature-row"
                :class="{ 'drag-over': dragOverId === f.featureId }"
                @dragover.prevent="dragOverId = f.featureId"
                @dragleave.prevent="dragOverId === f.featureId && (dragOverId = null)"
                @drop.prevent="onDrop(f.featureId)"
              >
                <div class="feature-name-col">
                  <span class="feature-primary">{{ f.displayName }}</span>
                  <span v-if="f.secondary" class="feature-secondary">{{ f.secondary }}</span>
                </div>
                <div class="feature-chips">
                  <span
                    v-for="url in getAssign(f.featureId).models"
                    :key="url"
                    class="chip chip-model"
                    :title="url"
                  >
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5"
                         stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                    </svg>
                    {{ shortName(url.split('/').pop()) }}
                    <button class="chip-rm" @click.stop="removeAsset(f.featureId, 'model', url)">×</button>
                  </span>
                  <span
                    v-for="url in getAssign(f.featureId).pointclouds"
                    :key="url"
                    class="chip chip-pc"
                    :title="url"
                  >
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5"
                         stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="1.2"/>
                      <circle cx="19" cy="8" r="1.2"/><circle cx="5" cy="8" r="1.2"/>
                      <circle cx="19" cy="16" r="1.2"/><circle cx="5" cy="16" r="1.2"/>
                    </svg>
                    {{ shortName(url.split('/').pop()) }}
                    <button class="chip-rm" @click.stop="removeAsset(f.featureId, 'pointcloud', url)">×</button>
                  </span>
                  <span
                    v-if="!getAssign(f.featureId).models.length && !getAssign(f.featureId).pointclouds.length"
                    class="no-assign-hint"
                  >drop here</span>
                </div>
              </div>

              <div v-if="filteredFeatures.length === 0 && features.length > 0" class="features-empty">
                No features match "{{ filterQuery }}".
              </div>
              <div v-if="features.length === 0" class="features-empty">
                This GeoJSON has no features with a <code>_featureId</code>.
              </div>
            </div>
          </div>
        </div>

        <!-- ── Footer status bar ─── -->
        <div v-if="saveError" class="modal-footer-bar modal-footer-error">{{ saveError }}</div>
        <div v-if="saveSuccess" class="modal-footer-bar modal-footer-success">{{ saveSuccess }}</div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { getApiUrl } from '../../utils/config.js';

const props = defineProps({
  isOpen:     { type: Boolean, required: true },
  filename:   { type: String,  required: true },
  authHeader: { type: String,  required: true },
});

const emit = defineEmits(['close']);

// ── State ──────────────────────────────────────────────────────────────────────

const loading    = ref(false);
const loadError  = ref('');
const saving     = ref(false);
const saveError  = ref('');
const saveSuccess = ref('');

const models      = ref([]);  // { filename, dataPath }
const pointclouds = ref([]);  // { filename, dataPath }

// features: [{ featureId, displayName, secondary }]
const features = ref([]);

// assignments: { [featureId]: { models: string[], pointclouds: string[] } }
const assignments = ref({});

const filterQuery = ref('');
const dragging    = ref(null);  // { type, url }
const dragOverId  = ref(null);

// ── Computed ───────────────────────────────────────────────────────────────────

const filteredFeatures = computed(() => {
  const q = filterQuery.value.trim().toLowerCase();
  if (!q) return features.value;
  return features.value.filter(f =>
    f.displayName.toLowerCase().includes(q) ||
    (f.secondary && f.secondary.toLowerCase().includes(q))
  );
});

const hasAnyAssignment = computed(() =>
  Object.values(assignments.value).some(a => a.models.length || a.pointclouds.length)
);

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAssign(featureId) {
  if (!assignments.value[featureId]) {
    assignments.value[featureId] = { models: [], pointclouds: [] };
  }
  return assignments.value[featureId];
}

/** Strip UUID prefix and truncate for display */
function shortName(filename) {
  const noUuid = filename
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '')
    .replace(/^[0-9a-f]{8}_/i, '');
  return noUuid.length > 30 ? noUuid.slice(0, 27) + '…' : noUuid;
}

const SYSTEM_KEYS = new Set(['_featureId', '_model3dUrls', '_pointcloudUrls', '_layerId']);

function buildFeatureMeta(feature) {
  const props  = feature.properties ?? {};
  const fid    = props._featureId ?? null;
  const values = [];
  let displayName = null;

  for (const [k, v] of Object.entries(props)) {
    if (SYSTEM_KEYS.has(k) || v === null || v === undefined || v === '') continue;
    const s = String(v);
    if (s.length > 0 && s.length < 100) {
      if (!displayName) displayName = s;
      else values.push(`${k}: ${s}`);
      if (values.length >= 2) break;
    }
  }

  if (!displayName) displayName = fid ? fid.slice(0, 12) + '…' : 'Feature';
  const secondary = values.length ? values.join(' · ') : null;
  return { featureId: fid, displayName, secondary };
}

// ── Drag & Drop ────────────────────────────────────────────────────────────────

function onDragStart(event, type, url) {
  dragging.value = { type, url };
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', url);
}

function onDrop(featureId) {
  dragOverId.value = null;
  if (!dragging.value) return;
  const { type, url } = dragging.value;
  const assign = getAssign(featureId);
  if (type === 'model') {
    if (!assign.models.includes(url)) assign.models = [...assign.models, url];
  } else {
    if (!assign.pointclouds.includes(url)) assign.pointclouds = [...assign.pointclouds, url];
  }
  dragging.value = null;
}

function removeAsset(featureId, type, url) {
  const assign = getAssign(featureId);
  if (type === 'model') {
    assign.models = assign.models.filter(u => u !== url);
  } else {
    assign.pointclouds = assign.pointclouds.filter(u => u !== url);
  }
}

function clearAll() {
  for (const fid of Object.keys(assignments.value)) {
    assignments.value[fid] = { models: [], pointclouds: [] };
  }
}

// ── Data loading ───────────────────────────────────────────────────────────────

watch(() => props.isOpen, async (open) => {
  if (!open) {
    saveError.value   = '';
    saveSuccess.value = '';
    return;
  }
  await loadData();
});

async function loadData() {
  loading.value   = true;
  loadError.value = '';
  saveError.value = '';
  saveSuccess.value = '';
  try {
    const [uploadsRes, geojsonRes] = await Promise.all([
      fetch(getApiUrl('/admin/uploads'), { headers: { Authorization: props.authHeader } }),
      fetch(getApiUrl(`data/shapes/${props.filename}`)),
    ]);
    if (!uploadsRes.ok) throw new Error(`Failed to load assets (${uploadsRes.status})`);
    if (!geojsonRes.ok) throw new Error(`Failed to load GeoJSON (${geojsonRes.status})`);

    const uploads = await uploadsRes.json();
    const geojson = await geojsonRes.json();

    models.value      = uploads.models      ?? [];
    pointclouds.value = uploads.pointclouds ?? [];

    const initial = {};
    features.value = (geojson.features ?? [])
      .map(f => {
        const meta = buildFeatureMeta(f);
        if (meta.featureId) {
          initial[meta.featureId] = {
            models:      Array.isArray(f.properties?._model3dUrls)    ? [...f.properties._model3dUrls]    : [],
            pointclouds: Array.isArray(f.properties?._pointcloudUrls) ? [...f.properties._pointcloudUrls] : [],
          };
        }
        return meta;
      })
      .filter(f => f.featureId);

    assignments.value = initial;
    filterQuery.value = '';
  } catch (err) {
    loadError.value = err.message ?? 'Failed to load data.';
  } finally {
    loading.value = false;
  }
}

// ── Save ───────────────────────────────────────────────────────────────────────

async function save() {
  saving.value      = true;
  saveError.value   = '';
  saveSuccess.value = '';
  try {
    const res = await fetch(getApiUrl('/admin/manual-link'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: props.authHeader },
      body: JSON.stringify({ filename: props.filename, assignments: assignments.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
    saveSuccess.value = `Saved — ${data.linkedCount} feature${data.linkedCount !== 1 ? 's' : ''} have 3D assets.`;
  } catch (err) {
    saveError.value = err.message ?? 'Save failed.';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
/* ── Overlay & shell ─────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.link-modal {
  background: var(--admin-surface, #fff);
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 10px;
  width: 100%;
  max-width: 960px;
  height: 82vh;
  display: flex;
  flex-direction: column;
  font-family: "Segoe UI", sans-serif;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--admin-border, #e0e0e0);
  flex-shrink: 0;
  gap: 1rem;
}

.modal-header h3 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.header-icon { flex-shrink: 0; }

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn-save {
  background: var(--admin-accent, #3b82f6);
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 0.35rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  height: 30px;
}
.btn-save:hover:not(:disabled) { filter: brightness(1.1); }
.btn-save:disabled { opacity: 0.5; cursor: default; }

.close-btn {
  background: transparent;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: var(--admin-muted, #777);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  line-height: 1;
}
.close-btn:hover { background: var(--admin-bg, #f3f4f6); }

/* ── Loading / error placeholders ────────────────────────────────────────────── */
.modal-status {
  padding: 2rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--admin-muted, #777);
}
.modal-error { color: #ef4444; }

/* ── Two-column body ─────────────────────────────────────────────────────────── */
.link-modal-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Left: asset palette ─────────────────────────────────────────────────────── */
.assets-panel {
  width: 230px;
  flex-shrink: 0;
  border-right: 1px solid var(--admin-border, #e0e0e0);
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--admin-bg, #f9fafb);
}

.panel-section { display: flex; flex-direction: column; gap: 0.3rem; }

.panel-section-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--admin-muted, #777);
  padding: 0.3rem 0 0.2rem;
}

.panel-empty {
  font-size: 0.75rem;
  color: var(--admin-muted, #999);
  padding: 0.25rem 0.5rem;
  font-style: italic;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  border-radius: 5px;
  font-size: 0.75rem;
  cursor: grab;
  border: 1px solid transparent;
  user-select: none;
}
.asset-item:hover {
  border-color: var(--admin-border, #ddd);
  background: var(--admin-surface, #fff);
}
.asset-item:active { cursor: grabbing; }

.asset-item--model {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}
.asset-item--model:hover { background: #dbeafe; }

.asset-item--pc {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}
.asset-item--pc:hover { background: #dcfce7; }

.asset-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.drag-hint {
  margin-top: auto;
  padding-top: 0.5rem;
  font-size: 0.7rem;
  color: var(--admin-muted, #aaa);
  text-align: center;
}

/* ── Right: feature list ─────────────────────────────────────────────────────── */
.features-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.features-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid var(--admin-border, #e5e7eb);
  flex-shrink: 0;
}

.features-count {
  font-size: 0.75rem;
  color: var(--admin-muted, #777);
  white-space: nowrap;
}

.features-search {
  flex: 1;
  border: 1px solid var(--admin-border, #d1d5db);
  border-radius: 5px;
  padding: 0.3rem 0.6rem;
  font-size: 0.78rem;
  background: transparent;
  color: inherit;
  outline: none;
  min-width: 0;
}
.features-search:focus { border-color: var(--admin-accent, #3b82f6); }

.btn-clear-all {
  background: transparent;
  border: 1px solid var(--admin-border, #d1d5db);
  border-radius: 4px;
  padding: 0.25rem 0.55rem;
  font-size: 0.73rem;
  cursor: pointer;
  color: var(--admin-muted, #777);
  white-space: nowrap;
}
.btn-clear-all:hover { border-color: #ef4444; color: #ef4444; }

.features-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0;
}

.feature-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem 0.85rem;
  border-bottom: 1px solid var(--admin-border, #f0f0f0);
  transition: background 0.1s;
  min-height: 42px;
}
.feature-row:hover { background: var(--admin-bg, #f9fafb); }
.feature-row.drag-over {
  background: #eff6ff;
  border-color: #93c5fd;
  outline: 2px dashed #93c5fd;
  outline-offset: -2px;
}

.feature-name-col {
  display: flex;
  flex-direction: column;
  min-width: 140px;
  max-width: 200px;
  flex-shrink: 0;
}

.feature-primary {
  font-size: 0.8rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feature-secondary {
  font-size: 0.7rem;
  color: var(--admin-muted, #888);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feature-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  flex: 1;
  align-items: center;
  min-height: 26px;
}

.no-assign-hint {
  font-size: 0.7rem;
  color: var(--admin-muted, #bbb);
  font-style: italic;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.3rem 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 500;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-model {
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.chip-pc {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.chip-rm {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0 0.1rem;
  color: inherit;
  opacity: 0.6;
  flex-shrink: 0;
}
.chip-rm:hover { opacity: 1; }

.features-empty {
  padding: 1.5rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--admin-muted, #aaa);
}

/* ── Footer status bar ───────────────────────────────────────────────────────── */
.modal-footer-bar {
  padding: 0.5rem 1.25rem;
  font-size: 0.8rem;
  border-top: 1px solid var(--admin-border, #e5e7eb);
  flex-shrink: 0;
}
.modal-footer-error   { color: #ef4444; background: #fef2f2; }
.modal-footer-success { color: #15803d; background: #f0fdf4; }

/* ── Transition ──────────────────────────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
