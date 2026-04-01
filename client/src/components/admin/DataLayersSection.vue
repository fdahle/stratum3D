<template>
  <section class="admin-section">
    <div class="section-header">
      <div>
        <h2 class="section-title">Data Layers</h2>
        <p class="section-desc">Uploaded layers — GeoJSON, GeoTIFF, 3D models, point clouds.</p>
      </div>
      <label class="btn-add" :class="{ 'btn-add-disabled': uploadPending }" :title="uploadPending ? 'Upload in progress…' : 'Add new layer'">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;flex-shrink:0">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ uploadPending ? 'Uploading…' : 'Add Layer' }}
        <input v-if="!uploadPending" type="file" multiple accept=".geojson,.json,.tif,.tiff,.csv" style="display:none" @change="onFilesSelected" />
      </label>
    </div>

    <!-- Upload error banner -->
    <div v-if="uploadError" class="upload-error-banner">
      <span>{{ uploadError }}</span>
      <button class="banner-close" @click="uploadError = ''">✕</button>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && !layers.length" class="empty-state">Loading layers…</div>

    <!-- Empty state -->
    <div v-else-if="!isLoading && !layers.length" class="empty-state">
      No data layers yet. Click <strong>Add Layer</strong> to upload files.
    </div>

    <!-- Layer cards -->
    <div v-if="layers.length" class="layer-list">
      <div
        v-for="layer in sortedLayers"
        :key="layer.id"
        class="layer-card"
        :class="{
          'layer-card-optimizing': layer.status === 'optimizing',
          'layer-card-error':      layer.status === 'error',
          'layer-card-editing':    editingId === layer.id,
        }"
      >
        <!-- ─── Card header row ─────────────────────────────── -->
        <div class="lc-header">
          <span class="type-badge" :class="`type-${layer.fileType}`">{{ layer.fileType }}</span>

          <div class="lc-names">
            <span class="lc-display-name">{{ layer.layerConfig?.displayName || layer.originalName }}</span>
            <span v-if="layer.layerConfig?.displayName && layer.layerConfig.displayName !== layer.originalName" class="lc-original-name" :title="layer.originalName">{{ layer.originalName }}</span>
          </div>

          <!-- Status pill -->
          <div class="lc-status">
            <template v-if="layer.status === 'optimizing'">
              <svg class="spin" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M12 2a10 10 0 0110 10" opacity="0.3"/><path d="M12 2a10 10 0 000 20a10 10 0 0010-10"/>
              </svg>
              <span class="status-text status-optimizing">Optimizing…</span>
            </template>
            <template v-else-if="layer.status === 'error'">
              <span class="status-text status-error" :title="layer.processingLog?.at(-1) ?? 'Processing error'">⚠ Error</span>
            </template>
            <template v-else-if="layer.optimized">
              <span class="status-text status-ok">✓ Optimized</span>
            </template>
          </div>

          <!-- Card action buttons -->
          <div class="lc-actions">
            <!-- Manage 3D: upload & link 3D models/point clouds (GeoJSON layers only) -->
            <button
              v-if="layer.fileType === 'geojson'"
              class="action-btn action-btn-link3d"
              title="Upload & link 3D models / point clouds to features"
              :disabled="layer.status === 'optimizing'"
              @click="openLinkModal(layer)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </button>
            <button
              class="action-btn"
              :class="{ 'action-btn-active': editingId === layer.id }"
              :disabled="layer.status === 'optimizing'"
              :title="editingId === layer.id ? 'Close editor' : 'Edit layer settings'"
              @click="toggleEdit(layer)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              class="action-btn action-btn-danger"
              :disabled="layer.status === 'optimizing' || deletePending[layer.id]"
              title="Delete this layer"
              @click="confirmDelete(layer)"
            >
              <svg v-if="!deletePending[layer.id]" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
              <span v-else style="font-size:11px">…</span>
            </button>
          </div>
        </div>

        <!-- Sub-files strip -->
        <div v-if="layer.subFiles?.length" class="lc-subfiles">
          <!-- For GeoJSON: show model/pointcloud counts + linked summary -->
          <template v-if="layer.fileType === 'geojson'">
            <span
              v-for="group in subfileGroups(layer)"
              :key="group.role"
              class="subfile-chip"
              :class="'subfile-chip-' + group.role"
              :title="group.names.join(', ')"
            >{{ group.count }} {{ group.label }}</span>
          </template>
          <!-- For other types: show role chips as before -->
          <template v-else>
            <span v-for="sf in layer.subFiles" :key="sf.id" class="subfile-chip" :title="sf.originalName">
              {{ sf.role }}
            </span>
          </template>
        </div>

        <!-- ─── Delete confirmation bar ────────────────────── -->
        <div v-if="deleteConfirmId === layer.id" class="lc-confirm-bar">
          <span class="confirm-text">Delete <strong>{{ layer.layerConfig?.displayName || layer.originalName }}</strong> permanently?</span>
          <button class="btn-danger-sm" :disabled="deletePending[layer.id]" @click="doDelete(layer.id)">
            {{ deletePending[layer.id] ? 'Deleting…' : 'Yes, delete' }}
          </button>
          <button class="btn-secondary-sm" @click="deleteConfirmId = null">Cancel</button>
        </div>

        <!-- ─── Inline edit panel ───────────────────────────── -->
        <div v-if="editingId === layer.id" class="lc-edit-panel">
          <div class="edit-row">
            <div class="edit-field edit-field-grow">
              <label>Display name</label>
              <input v-model="editDraft.displayName" type="text" :placeholder="layer.originalName" />
            </div>
            <div class="edit-field edit-field-sm">
              <label>Order</label>
              <input v-model.number="editDraft.order" type="number" min="0" />
            </div>
            <div class="edit-field edit-field-toggle">
              <label>Visible</label>
              <div class="toggle-switch">
                <input :id="`vis-${layer.id}`" v-model="editDraft.visible" type="checkbox" />
                <label :for="`vis-${layer.id}`" class="slider"></label>
              </div>
            </div>
          </div>

          <!-- GeoJSON extras -->
          <template v-if="layer.fileType === 'geojson'">
            <div class="edit-row">
              <div class="edit-field">
                <label>Badge color</label>
                <div class="color-row">
                  <input type="color" class="color-swatch"
                    :value="/^#[0-9a-f]{6}$/i.test(editDraft.color) ? editDraft.color : '#0088ff'"
                    @input="editDraft.color = $event.target.value" />
                  <input v-model="editDraft.color" type="text" placeholder="#0088ff" />
                </div>
              </div>
              <div class="edit-field">
                <label>Stroke color</label>
                <div class="color-row">
                  <input type="color" class="color-swatch"
                    :value="/^#[0-9a-f]{6}$/i.test(editDraft.stroke_color) ? editDraft.stroke_color : '#0088ff'"
                    @input="editDraft.stroke_color = $event.target.value" />
                  <input v-model="editDraft.stroke_color" type="text" placeholder="#0088ff" />
                </div>
              </div>
              <div class="edit-field">
                <label>Fill color</label>
                <div class="color-row">
                  <input type="color" class="color-swatch"
                    :value="/^#[0-9a-f]{6}$/i.test(editDraft.fill_color) ? editDraft.fill_color : '#000000'"
                    :disabled="!editDraft.fill_color || editDraft.fill_color === 'none'"
                    @input="editDraft.fill_color = $event.target.value" />
                  <input v-model="editDraft.fill_color" type="text" placeholder="none" />
                </div>
              </div>
            </div>
          </template>

          <!-- GeoTIFF extras -->
          <template v-if="layer.fileType === 'geotiff'">
            <div class="edit-row">
              <div class="edit-field edit-field-grow">
                <label>Attribution</label>
                <input v-model="editDraft.attribution" type="text" placeholder="© Source" />
              </div>
            </div>
          </template>

          <!-- Edit panel footer -->
          <div class="edit-footer">
            <a
              v-if="layer.keepOriginal"
              :href="getApiUrl('/admin/layers/' + layer.id + '/original')"
              download
              class="btn-secondary-sm"
              title="Download the original unoptimized file"
            >↓ Original</a>
            <span class="edit-footer-spacer" />
            <span v-if="editError" class="edit-error">{{ editError }}</span>
            <button class="btn-secondary-sm" @click="cancelEdit">Cancel</button>
            <button class="btn-primary-sm" :disabled="editSaving" @click="saveEdit(layer.id)">
              {{ editSaving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload settings modal -->
    <UploadSettingsModal
      :is-open="showUploadModal"
      :files="pendingFiles"
      @confirm="doUpload"
      @cancel="cancelUpload"
      @remove="removePendingFile"
    />

    <!-- Feature-level 3D linking modal -->
    <LinkingModal
      :is-open="linkModal.open"
      :layer-id="linkModal.layerId"
      :auth-header="props.authHeader"
      @close="linkModal.open = false"
      @saved="fetchLayers"
    />

  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getApiUrl } from '../../utils/config';
import UploadSettingsModal from '../modals/admin/UploadSettingsModal.vue';
import LinkingModal from '../modals/admin/LinkingModal.vue';

const props = defineProps({
  authHeader: { type: String, default: '' },
});

const emit = defineEmits(['update:layers']);

// ── State ───────────────────────────────────────────────────────
const layers        = ref([]);
const isLoading     = ref(false);
const loadError     = ref('');
const uploadError   = ref('');
const uploadPending = ref(false);
const deletePending = ref({});
const deleteConfirmId = ref(null);
const editingId     = ref(null);
const editDraft     = ref({});
const editSaving    = ref(false);
const editError     = ref('');
const pendingFiles  = ref([]);
const showUploadModal = ref(false);
let pollTimer = null;

// Linking modal state
const linkModal = ref({ open: false, layerId: '' });

// ── Computed ────────────────────────────────────────────────────
const sortedLayers = computed(() =>
  [...layers.value].sort((a, b) => (a.layerConfig?.order ?? 0) - (b.layerConfig?.order ?? 0))
);
const hasOptimizing = computed(() =>
  layers.value.some(l => l.status === 'optimizing')
);

// ── Lifecycle ───────────────────────────────────────────────────
onMounted(async () => {
  await fetchLayers();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});

// ── API helpers ─────────────────────────────────────────────────
function authHeaders(extra = {}) {
  return { Authorization: props.authHeader, ...extra };
}

async function fetchLayers() {
  if (!props.authHeader) return;
  isLoading.value = true;
  loadError.value = '';
  try {
    const res = await fetch(getApiUrl('/admin/layers'), { headers: authHeaders() });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    layers.value = await res.json();
    emitLayers();
  } catch (err) {
    loadError.value = err.message;
  } finally {
    isLoading.value = false;
  }
}

// ── Polling ─────────────────────────────────────────────────────
function startPolling() {
  pollTimer = setInterval(async () => {
    if (!hasOptimizing.value) return;
    await fetchLayers();
  }, 4000);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// ── Config emission ─────────────────────────────────────────────
function metaToEntry(meta) {
  const lc = meta.layerConfig || {};
  const url = getApiUrl(`data/layers/${meta.id}/${meta.id}${meta.extension}`);
  const entry = {
    name:    lc.displayName || meta.originalName,
    url,
    type:    lc.type || meta.fileType,
    visible: lc.visible ?? true,
    order:   lc.order   ?? 0,
  };
  const extras = ['color', 'stroke_color', 'fill_color', 'attribution', 'tileSize'];
  for (const k of extras) {
    if (lc[k] != null) entry[k] = lc[k];
  }
  return entry;
}

function emitLayers() {
  // Only emit layer types that make sense as map config entries
  const configEntries = layers.value
    .filter(l => ['geojson', 'geotiff'].includes(l.fileType))
    .map(metaToEntry);
  emit('update:layers', configEntries);
}

// ── Upload flow ─────────────────────────────────────────────────
function onFilesSelected(e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length) return;
  const allowed = new Set(['.geojson', '.json', '.tif', '.tiff', '.csv']);
  const bad = files.filter(f => !allowed.has('.' + f.name.split('.').pop().toLowerCase()));
  if (bad.length) {
    uploadError.value = `Unsupported type(s): ${bad.map(f => f.name).join(', ')}. Only GeoJSON, GeoTIFF, and CSV files can be added as layers.`;
    return;
  }
  pendingFiles.value = files;
  showUploadModal.value = true;
}

function cancelUpload() {
  pendingFiles.value  = [];
  showUploadModal.value = false;
}

function removePendingFile(index) {
  pendingFiles.value.splice(index, 1);
  if (!pendingFiles.value.length) showUploadModal.value = false;
}

async function doUpload(settings) {
  showUploadModal.value = false;
  uploadPending.value   = true;
  uploadError.value     = '';

  const formData = new FormData();
  for (const file of pendingFiles.value) {
    formData.append('files', file);
  }
  formData.append('settings', JSON.stringify(settings));

  try {
    const res = await fetch(getApiUrl('/admin/upload'), {
      method: 'POST',
      headers: { Authorization: props.authHeader },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Upload failed (${res.status})`);
    }
    pendingFiles.value = [];
    await fetchLayers();
  } catch (err) {
    uploadError.value = err.message;
  } finally {
    uploadPending.value = false;
  }
}

// ── Sub-file display ────────────────────────────────────────────
function subfileGroups(layer) {
  const subs = layer.subFiles ?? [];
  const models      = subs.filter(sf => sf.role === 'model');
  const pointclouds = subs.filter(sf => sf.role === 'pointcloud');
  const groups = [];
  if (models.length)      groups.push({ role: 'model',      count: models.length,      label: models.length === 1 ? 'model' : 'models',             names: models.map(sf => sf.originalName) });
  if (pointclouds.length) groups.push({ role: 'pointcloud', count: pointclouds.length, label: pointclouds.length === 1 ? 'point cloud' : 'point clouds', names: pointclouds.map(sf => sf.originalName) });
  return groups;
}

// ── Delete flow ─────────────────────────────────────────────────
function confirmDelete(layer) {
  deleteConfirmId.value = layer.id;
  editingId.value = null;    // close edit panel if open
}

async function doDelete(id) {
  deletePending.value = { ...deletePending.value, [id]: true };
  try {
    const res = await fetch(getApiUrl(`/admin/layers/${id}`), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Delete failed (${res.status})`);
    }
    layers.value = layers.value.filter(l => l.id !== id);
    deleteConfirmId.value = null;
    emitLayers();
  } catch (err) {
    uploadError.value = err.message;
  } finally {
    const next = { ...deletePending.value };
    delete next[id];
    deletePending.value = next;
  }
}

function openLinkModal(layer) {
  linkModal.value = { open: true, layerId: layer.id };
}

// ── Edit flow ───────────────────────────────────────────────────
function toggleEdit(layer) {
  if (editingId.value === layer.id) {
    cancelEdit();
    return;
  }
  deleteConfirmId.value = null;
  const lc = layer.layerConfig || {};
  editDraft.value = {
    displayName:  lc.displayName  ?? '',
    visible:      lc.visible      ?? true,
    order:        lc.order        ?? 0,
    // GeoJSON extras
    color:        lc.color        ?? '',
    stroke_color: lc.stroke_color ?? '',
    fill_color:   lc.fill_color   ?? '',
    // GeoTIFF extras
    attribution:  lc.attribution  ?? '',
  };
  editingId.value = layer.id;
  editError.value = '';
}

function cancelEdit() {
  editingId.value = null;
  editError.value = '';
}

async function saveEdit(id) {
  editSaving.value = true;
  editError.value  = '';
  try {
    // Strip empty strings before sending
    const patch = Object.fromEntries(
      Object.entries(editDraft.value).filter(([, v]) => v !== '' && v != null)
    );
    const res = await fetch(getApiUrl(`/admin/layers/${id}`), {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Save failed (${res.status})`);
    }
    const updated = await res.json();
    // Update local layer record
    const idx = layers.value.findIndex(l => l.id === id);
    if (idx !== -1) layers.value[idx] = updated;
    editingId.value = null;
    emitLayers();
  } catch (err) {
    editError.value = err.message;
  } finally {
    editSaving.value = false;
  }
}
</script>

<style scoped>
/* ── Section header ─────────────────────────────────────────── */
.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.1rem;
}
.section-title { font-size: 1.05rem; font-weight: 600; margin: 0 0 0.2rem; }
.section-desc  { font-size: 0.8rem; color: var(--text-muted, #888); margin: 0; }

/* btn-add — label wraps a hidden file input */
.btn-add {
  display: inline-flex; align-items: center;
  padding: 0.4rem 0.85rem; border-radius: 6px; border: none;
  background: var(--accent, #3b82f6); color: #fff;
  font-size: 0.82rem; font-weight: 500; cursor: pointer; white-space: nowrap;
  transition: background 0.15s, opacity 0.15s;
  user-select: none;
}
.btn-add:hover:not(.btn-add-disabled) { background: var(--accent-hover, #2563eb); }
.btn-add-disabled { opacity: 0.55; cursor: default; }

/* ── Upload error ───────────────────────────────────────────── */
.upload-error-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);
  border-radius: 6px; padding: 0.55rem 0.8rem; margin-bottom: 0.75rem;
  font-size: 0.82rem; color: #ef4444;
}
.banner-close {
  background: none; border: none; cursor: pointer; color: #ef4444; font-size: 1rem; line-height: 1; padding: 0;
}

/* ── Empty / loading ────────────────────────────────────────── */
.empty-state {
  padding: 2rem 1rem; text-align: center;
  font-size: 0.85rem; color: var(--admin-muted, #777);
  border: 1px dashed var(--admin-border, #e0e0e0);
  border-radius: 8px;
}

/* ── Layer list ─────────────────────────────────────────────── */
.layer-list { display: flex; flex-direction: column; gap: 0.5rem; }

.layer-card {
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 8px;
  background: var(--admin-surface, #fff);
  overflow: hidden;
  transition: border-color 0.15s;
}
.layer-card:hover { border-color: var(--admin-border, #c0c0c0); filter: brightness(0.98); }
.layer-card-editing { border-color: #3b82f6 !important; }
.layer-card-optimizing { opacity: 0.65; pointer-events: none; }
.layer-card-error { border-color: rgba(239,68,68,0.45) !important; }

/* ── Card header ────────────────────────────────────────────── */
.lc-header {
  display: flex; align-items: center; gap: 0.65rem;
  padding: 0.6rem 0.85rem;
}

.type-badge {
  flex-shrink: 0;
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem; border-radius: 4px;
  background: var(--admin-bg, #f3f4f6); color: var(--admin-muted, #777);
}
.type-geojson    { background: rgba(34,197,94,0.15);  color: #15803d; }
.type-geotiff    { background: rgba(168,85,247,0.15); color: #6d28d9; }
.type-model      { background: rgba(251,191,36,0.15); color: #b45309; }
.type-pointcloud { background: rgba(56,189,248,0.15); color: #0369a1; }
:global(body.theme-dark) .type-geojson    { color: #4ade80; }
:global(body.theme-dark) .type-geotiff    { color: #c084fc; }
:global(body.theme-dark) .type-model      { color: #fbbf24; }
:global(body.theme-dark) .type-pointcloud { color: #38bdf8; }

.lc-names { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.lc-display-name { font-size: 0.88rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--admin-text, #1a1a1a); }
.lc-original-name { font-size: 0.72rem; color: var(--admin-muted, #777); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.lc-status { display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0; }
.status-text { font-size: 0.75rem; font-weight: 500; }
.status-optimizing { color: #d97706; }
.status-error      { color: #dc2626; }
.status-ok         { color: #16a34a; }
:global(body.theme-dark) .status-optimizing { color: #fbbf24; }
:global(body.theme-dark) .status-error      { color: #f87171; }
:global(body.theme-dark) .status-ok         { color: #4ade80; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.9s linear infinite; }

/* ── Card action buttons ────────────────────────────────────── */
.lc-actions { display: flex; gap: 0.3rem; flex-shrink: 0; }
.action-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 5px; border: 1px solid var(--admin-border, #e0e0e0);
  background: transparent; color: var(--admin-muted, #777); cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.action-btn:hover:not(:disabled) { background: var(--admin-bg, #f3f4f6); border-color: var(--admin-muted, #aaa); color: var(--admin-text, #1a1a1a); }
.action-btn:disabled { opacity: 0.35; cursor: default; }
.action-btn-active { background: rgba(59,130,246,0.15) !important; border-color: rgba(59,130,246,0.5) !important; color: #3b82f6 !important; }
.action-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.4); color: #dc2626; }
.action-btn-link3d { color: #7c3aed; border-color: rgba(124,58,237,0.3); }
.action-btn-link3d:hover:not(:disabled) { background: rgba(124,58,237,0.08); border-color: rgba(124,58,237,0.5); color: #7c3aed; }

/* ── Sub-files strip ────────────────────────────────────────── */
.lc-subfile-uploading {
  padding: 0.35rem 0.8rem;
  font-size: 0.78rem;
  color: var(--admin-muted, #777);
  border-top: 1px solid var(--admin-border, #e0e0e0);
}
.lc-subfile-error {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  padding: 0.35rem 0.8rem;
  font-size: 0.78rem;
  color: #dc2626;
  border-top: 1px solid rgba(239,68,68,0.2);
  background: rgba(239,68,68,0.06);
}
.lc-subfiles {
  display: flex; flex-wrap: wrap; gap: 0.3rem;
  padding: 0 0.85rem 0.6rem; border-top: 1px solid var(--admin-border, #e0e0e0);
  margin-top: -0.05rem; padding-top: 0.4rem;
}
.subfile-chip {
  font-size: 0.7rem; padding: 0.1rem 0.45rem; border-radius: 3px;
  background: var(--admin-bg, #f3f4f6); color: var(--admin-muted, #777); border: 1px solid var(--admin-border, #e0e0e0); text-transform: capitalize;
}
.subfile-chip-model      { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.subfile-chip-pointcloud { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }

/* ── Delete confirm bar ─────────────────────────────────────── */
.lc-confirm-bar {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.55rem 0.85rem;
  background: rgba(239,68,68,0.08); border-top: 1px solid rgba(239,68,68,0.2);
  font-size: 0.82rem;
}
.confirm-text { flex: 1; color: var(--admin-text, #1a1a1a); }
.btn-danger-sm {
  padding: 0.28rem 0.7rem; border-radius: 5px; border: none; cursor: pointer;
  background: #dc2626; color: #fff; font-size: 0.8rem; font-weight: 500;
  transition: background 0.12s;
}
.btn-danger-sm:hover:not(:disabled) { background: #b91c1c; }
.btn-danger-sm:disabled { opacity: 0.5; cursor: default; }

/* ── Inline edit panel ──────────────────────────────────────── */
.lc-edit-panel {
  padding: 0.85rem;
  border-top: 1px solid var(--admin-border, #e0e0e0);
  background: var(--admin-bg, #f3f4f6);
  display: flex; flex-direction: column; gap: 0.7rem;
}

.edit-row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.edit-field { display: flex; flex-direction: column; gap: 0.25rem; }
.edit-field label { font-size: 0.75rem; color: var(--admin-muted, #777); font-weight: 500; }
.edit-field input[type="text"],
.edit-field input[type="number"] {
  padding: 0.35rem 0.6rem; border-radius: 5px;
  border: 1px solid var(--admin-border, #e0e0e0);
  background: var(--admin-input-bg, #fff); color: var(--admin-text, #1a1a1a);
  font-size: 0.83rem;
}
.edit-field input:focus { outline: none; border-color: #3b82f6; }

.edit-field-grow { flex: 1; min-width: 14rem; }
.edit-field-sm   { width: 6rem; }
.edit-field-toggle { align-items: flex-start; }

/* toggle switch (same as used elsewhere in admin) */
.toggle-switch { position: relative; display: inline-block; width: 36px; height: 20px; margin-top: 3px; }
.toggle-switch input { opacity: 0; width:0; height:0; }
.slider {
  position: absolute; cursor: pointer; inset: 0; border-radius: 20px;
  background: var(--admin-border, #ccc); transition: background 0.2s;
}
.slider::before {
  content:''; position:absolute; height:14px; width:14px; left:3px; bottom:3px;
  border-radius:50%; background:#fff; transition: transform 0.2s;
}
input:checked + .slider { background: #3b82f6; }
input:checked + .slider::before { transform: translateX(16px); }

/* Color row */
.color-row { display: flex; gap: 0.4rem; align-items: center; }
.color-swatch { width: 28px; height: 28px; padding: 1px; border-radius: 4px; border: 1px solid var(--admin-border, #e0e0e0); background:none; cursor:pointer; }
.color-row input[type="text"] { flex: 1; }

/* Edit footer */
.edit-footer { display: flex; align-items: center; gap: 0.5rem; }
.edit-footer-spacer { flex: 1; }
.edit-error { font-size: 0.78rem; color: #dc2626; }

.btn-primary-sm {
  padding: 0.3rem 0.75rem; border-radius: 5px; border: none; cursor: pointer;
  background: var(--accent, #3b82f6); color: #fff; font-size: 0.8rem; font-weight: 500;
  transition: background 0.12s;
}
.btn-primary-sm:hover:not(:disabled) { background: var(--accent-hover, #2563eb); }
.btn-primary-sm:disabled { opacity: 0.55; cursor: default; }

.btn-secondary-sm {
  padding: 0.3rem 0.75rem; border-radius: 5px; cursor: pointer; font-size: 0.8rem;
  background: transparent; color: var(--admin-muted, #777);
  border: 1px solid var(--admin-border, #e0e0e0);
  transition: background 0.12s, color 0.12s;
  text-decoration: none; display: inline-flex; align-items: center;
}
.btn-secondary-sm:hover { background: var(--admin-bg, #f3f4f6); color: var(--admin-text, #1a1a1a); }
</style>
