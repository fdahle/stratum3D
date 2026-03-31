<template>
  <section class="admin-section">
    <div class="section-header-simple">
      <h2 class="section-title">Upload Data</h2>
      <p class="section-desc">
        Upload one or more data files. GeoJSON is auto-reprojected and simplified.
        Upload 3D models (.obj, .ply, .stl) or point clouds (.las, .laz) <em>together with</em>
        a GeoJSON to automatically link features — no manual editing needed.
      </p>
    </div>

    <!-- Drop zone -->
    <div
      class="drop-zone"
      :class="{ 'drop-active': isDragging, 'has-files': selectedFiles.length > 0 }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="!selectedFiles.length && fileInputRef.click()"
    >
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept=".geojson,.json,.tif,.tiff,.obj,.ply,.stl,.las,.laz,.mtl,.jpg,.jpeg,.png,.bmp,.tga"
        class="file-input-hidden"
        @change="onFileSelected"
      />

      <template v-if="!selectedFiles.length">
        <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p class="drop-label">
          Drop files here or
          <button class="btn-link" @click.stop="fileInputRef.click()">browse</button>
        </p>
        <p class="drop-hint">
          .geojson .json .tif .tiff .obj .ply .stl .las .laz .mtl + textures &mdash; max 500 MB each
        </p>
      </template>

      <template v-else>
        <ul class="file-list">
          <li v-for="(f, i) in selectedFiles" :key="f.name + f.size" class="file-list-item">
            <span class="file-type-badge" :class="extClass(f.name)">{{ extLabel(f.name) }}</span>
            <span class="file-list-name">{{ f.name }}</span>
            <span class="file-list-size">{{ formatSize(f.size) }}</span>
            <button class="btn-remove-one" title="Remove" @click.stop="removeFile(i)">×</button>
          </li>
        </ul>
        <div class="file-list-footer">
          <button class="btn-link" @click.stop="fileInputRef.click()">Add more files</button>
          <button class="btn-link btn-link-danger" @click.stop="clearFiles">Clear all</button>
        </div>
      </template>
    </div>

    <!-- Progress bar -->
    <div v-if="status === 'uploading'" class="progress-wrap">
      <div class="progress-track">
        <div class="progress-bar" :style="{ width: progress + '%' }"></div>
      </div>
      <span class="progress-label">{{ progress }}%</span>
    </div>

    <!-- Results (one per processed file) -->
    <div v-if="results.length" class="upload-results">
      <div v-for="r in results" :key="r.dataPath" class="upload-result">
        <div class="result-header">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <strong>{{ r.filename }}</strong>
          <span v-if="r.featureCount" class="result-badge">{{ r.featureCount.toLocaleString() }} features</span>
          <span class="result-type-badge">{{ r.type }}</span>
        </div>

        <ul v-if="r.steps?.length" class="result-steps">
          <li v-for="step in r.steps" :key="step">{{ step }}</li>
        </ul>

        <div class="result-url-box">
          <label class="result-url-label">
            URL:
            <FieldHint text="Copy this URL and paste it into the URL field when adding a new layer." />
          </label>
          <div class="result-url-row">
            <code class="result-url">{{ getApiUrl(r.dataPath) }}</code>
            <button class="btn-copy" :class="{ copied: copiedPath === r.dataPath }" @click="copyUrl(r.dataPath)">
              {{ copiedPath === r.dataPath ? '✓ Copied' : 'Copy' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <p v-if="errorMsg" class="upload-error">&#9888; {{ errorMsg }}</p>

    <div class="upload-actions">
      <button
        class="btn-upload"
        :disabled="!selectedFiles.length || status === 'uploading'"
        @click="doUpload"
      >
        <span v-if="status === 'uploading'">Uploading…</span>
        <span v-else>Upload &amp; Process</span>
      </button>
    </div>

    <!-- Manage existing files -->
    <details class="manage-section">
      <summary class="manage-summary" @click="loadExisting">
        Manage existing files
        <span v-if="existingLoading" class="manage-spin">⟳</span>
      </summary>

      <div v-if="!existingLoaded && !existingLoading && !errorMsg" class="manage-empty">
        Expand to load…
      </div>
      <div v-if="errorMsg && !existingLoaded" class="manage-empty manage-error">⚠ {{ errorMsg }}</div>

      <div v-if="existingLoaded" class="manage-grid">
        <!-- GeoJSON files with Re-link -->
        <template v-if="existing.shapes.length">
          <div class="manage-group-header">
            <p class="manage-group-label">GeoJSON shapes</p>
            <button
              v-if="existing.shapes.length > 1"
              class="btn-manage btn-relink btn-relink-all"
              :disabled="existing.shapes.some(f => relinkPending[f.filename])"
              title="Auto-assign 3D assets to ALL GeoJSON files at once"
              @click="relinkAll"
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
              Assign 3D — all
            </button>
          </div>
          <div v-for="f in existing.shapes" :key="f.dataPath" class="manage-row-wrap">
            <div class="manage-row">
            <div class="manage-file-info">
              <span class="manage-filename">{{ f.filename }}</span>
            </div>
            <div class="manage-row-actions">
              <button
                class="btn-manage btn-link3d"
                :title="'Manually link 3D models and point clouds to specific features via drag & drop'"
                @click="openLinkingModal(f.filename)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                Link 3D
              </button>
              <button
                class="btn-manage btn-relink"
                :class="{ 'btn-relink-ok': relinkResults[f.filename]?.ok, 'btn-relink-err': relinkResults[f.filename]?.err }"
                :disabled="relinkPending[f.filename]"
                :title="'Auto-assign 3D: scans all 3D models and point clouds on the server and embeds matching URLs into this GeoJSON\'s features. Run after uploading new 3D or point cloud files.'"
                @click="doRelink(f.filename)"
              >
                <svg v-if="!relinkPending[f.filename] && !relinkResults[f.filename]" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                </svg>
                <span v-if="relinkPending[f.filename]">Linking…</span>
                <span v-else-if="relinkResults[f.filename]?.ok">✓ {{ relinkResults[f.filename].msg }}</span>
                <span v-else-if="relinkResults[f.filename]?.err">✗ {{ relinkResults[f.filename].msg }}</span>
                <span v-else>Assign 3D</span>
              </button>
              <a class="btn-manage btn-file-download" :href="getApiUrl(f.dataPath)" :download="f.filename" title="Download file">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button class="btn-manage btn-file-copy" :class="{ 'btn-file-copy-ok': copiedPath === f.dataPath }" :title="'Copy URL to clipboard'" @click="copyUrl(f.dataPath)">
                <svg v-if="copiedPath !== f.dataPath" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                {{ copiedPath === f.dataPath ? '✓ Copied' : 'Copy URL' }}
              </button>
              <button
                class="btn-manage btn-file-delete"
                :disabled="deletePending[`shapes/${f.filename}`]"
                title="Delete file from server"
                @click="deleteFile('shapes', f.filename)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                {{ deletePending[`shapes/${f.filename}`] ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
            </div>
            <div
              v-if="relinkResults[f.filename]?.ok && relinkResults[f.filename]?.details"
              class="relink-details"
            >
              <template v-if="Object.keys(relinkResults[f.filename].details.models).length || Object.keys(relinkResults[f.filename].details.pointclouds).length">
                <span
                  v-for="(count, stem) in relinkResults[f.filename].details.models"
                  :key="'m-' + stem"
                  class="relink-detail-tag relink-detail-model"
                >{{ stem }} <span class="relink-detail-count">{{ count }}</span></span>
                <span
                  v-for="(count, stem) in relinkResults[f.filename].details.pointclouds"
                  :key="'pc-' + stem"
                  class="relink-detail-tag relink-detail-pc"
                >{{ stem }} <span class="relink-detail-count">{{ count }}</span></span>
              </template>
              <span v-else class="relink-detail-none">No assets matched</span>
            </div>
          </div>
        </template>

        <!-- 3D models -->
        <template v-if="existing.models?.length">
          <p class="manage-group-label">3D models</p>
          <div v-for="f in existing.models" :key="f.dataPath" class="manage-row">
            <span class="manage-filename">{{ f.filename }}</span>
            <div class="manage-row-actions">
              <a class="btn-manage btn-file-download" :href="getApiUrl(f.dataPath)" :download="f.filename" title="Download file">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button class="btn-manage btn-file-copy" :class="{ 'btn-file-copy-ok': copiedPath === f.dataPath }" :title="'Copy URL to clipboard'" @click="copyUrl(f.dataPath)">
                <svg v-if="copiedPath !== f.dataPath" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                {{ copiedPath === f.dataPath ? '✓ Copied' : 'Copy URL' }}
              </button>
              <button
                class="btn-manage btn-file-delete"
                :disabled="deletePending[`models/${f.filename}`]"
                title="Delete file from server"
                @click="deleteFile('models', f.filename)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                {{ deletePending[`models/${f.filename}`] ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </div>
        </template>

        <!-- Point clouds -->
        <template v-if="existing.pointclouds?.length">
          <p class="manage-group-label">Point clouds</p>
          <div v-for="f in existing.pointclouds" :key="f.dataPath" class="manage-row">
            <span class="manage-filename">{{ f.filename }}</span>
            <div class="manage-row-actions">
              <a class="btn-manage btn-file-download" :href="getApiUrl(f.dataPath)" :download="f.filename" title="Download file">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button class="btn-manage btn-file-copy" :class="{ 'btn-file-copy-ok': copiedPath === f.dataPath }" :title="'Copy URL to clipboard'" @click="copyUrl(f.dataPath)">
                <svg v-if="copiedPath !== f.dataPath" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                {{ copiedPath === f.dataPath ? '✓ Copied' : 'Copy URL' }}
              </button>
              <button
                class="btn-manage btn-file-delete"
                :disabled="deletePending[`pointclouds/${f.filename}`]"
                title="Delete file from server"
                @click="deleteFile('pointclouds', f.filename)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                {{ deletePending[`pointclouds/${f.filename}`] ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </div>
        </template>

        <!-- GeoTIFFs -->
        <template v-if="existing.geotiffs?.length">
          <p class="manage-group-label">GeoTIFFs</p>
          <div v-for="f in existing.geotiffs" :key="f.dataPath" class="manage-row">
            <span class="manage-filename">{{ f.filename }}</span>
            <div class="manage-row-actions">
              <a class="btn-manage btn-file-download" :href="getApiUrl(f.dataPath)" :download="f.filename" title="Download file">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button class="btn-manage btn-file-copy" :class="{ 'btn-file-copy-ok': copiedPath === f.dataPath }" :title="'Copy URL to clipboard'" @click="copyUrl(f.dataPath)">
                <svg v-if="copiedPath !== f.dataPath" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                {{ copiedPath === f.dataPath ? '✓ Copied' : 'Copy URL' }}
              </button>
              <button
                class="btn-manage btn-file-delete"
                :disabled="deletePending[`geotiffs/${f.filename}`]"
                title="Delete file from server"
                @click="deleteFile('geotiffs', f.filename)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                {{ deletePending[`geotiffs/${f.filename}`] ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </div>
        </template>

        <p v-if="!existing.shapes.length && !existing.models?.length && !existing.pointclouds?.length && !existing.geotiffs?.length"
           class="manage-empty">No files found on server.</p>
      </div>
    </details>
  </section>

  <!-- Linking modal — rendered outside the section so it isn't constrained by its layout -->
  <LinkingModal
    :is-open="linkingModal.open"
    :filename="linkingModal.filename"
    :auth-header="authHeader"
    @close="linkingModal.open = false"
  />
</template>

<script setup>
import { ref } from 'vue';
import { getApiUrl } from '../../utils/config';
import FieldHint from './FieldHint.vue';
import LinkingModal from './LinkingModal.vue';

const props = defineProps({
  authHeader: { type: String, required: true },
});

// ── Linking modal ──────────────────────────────────────────────────────────────
const linkingModal = ref({ open: false, filename: '' });

function openLinkingModal(filename) {
  linkingModal.value = { open: true, filename };
}

const ALLOWED_EXTS = new Set([
  'geojson', 'json', 'tif', 'tiff',
  'obj', 'ply', 'stl', 'las', 'laz',
  'mtl', 'jpg', 'jpeg', 'png', 'bmp', 'tga', 'webp',
]);

const TYPE_MAP = {
  geojson: 'geojson', json: 'geojson',
  tif: 'geotiff', tiff: 'geotiff',
  obj: '3d', ply: '3d', stl: '3d',
  las: 'pointcloud', laz: 'pointcloud',
  mtl: 'companion', jpg: 'companion', jpeg: 'companion',
  png: 'companion', bmp: 'companion', tga: 'companion', webp: 'companion',
};

const fileInputRef = ref(null);
const selectedFiles = ref([]);
const isDragging   = ref(false);
const status       = ref('idle'); // idle | uploading | done | error
const progress     = ref(0);
const results      = ref([]);
const errorMsg     = ref('');
const copiedPath   = ref('');

// Manage panel
const existing        = ref({ shapes: [], geotiffs: [], models: [], pointclouds: [] });
const existingLoaded  = ref(false);
const existingLoading = ref(false);
const relinkPending   = ref({});  // filename → bool
const relinkResults   = ref({});  // filename → { ok, err, msg }
const deletePending   = ref({});  // "category/filename" → bool

// ── Helpers ────────────────────────────────────────────────────────────────────

function getExt(name) { return name.split('.').pop().toLowerCase(); }

function extLabel(name) {
  const ext = getExt(name);
  const type = TYPE_MAP[ext];
  return type === 'geojson' ? 'GeoJSON'
       : type === 'geotiff' ? 'GeoTIFF'
       : type === '3d'      ? '3D'
       : type === 'pointcloud' ? 'LiDAR'
       : ext.toUpperCase();
}

function extClass(name) {
  const ext = getExt(name);
  return TYPE_MAP[ext] ?? 'companion';
}

function formatSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

// ── File selection ─────────────────────────────────────────────────────────────

function onFileSelected(e) {
  addFiles(Array.from(e.target.files ?? []));
  // Reset input so the same file can be re-selected after removal
  e.target.value = '';
}

function onDrop(e) {
  isDragging.value = false;
  const dropped = Array.from(e.dataTransfer?.files ?? []);
  const bad = dropped.filter(f => !ALLOWED_EXTS.has(getExt(f.name)));
  if (bad.length) {
    errorMsg.value = `Unsupported type(s): ${bad.map(f => getExt(f.name)).join(', ')}`;
    return;
  }
  addFiles(dropped);
}

function addFiles(newFiles) {
  const existingNames = new Set(selectedFiles.value.map(f => f.name));
  const toAdd = newFiles.filter(f => !existingNames.has(f.name));
  selectedFiles.value = [...selectedFiles.value, ...toAdd];
  results.value  = [];
  errorMsg.value = '';
  status.value   = 'idle';
  progress.value = 0;
}

function removeFile(index) {
  selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index);
}

function clearFiles() {
  selectedFiles.value = [];
  results.value  = [];
  errorMsg.value = '';
  status.value   = 'idle';
  progress.value = 0;
  if (fileInputRef.value) fileInputRef.value.value = '';
}

// ── Upload ─────────────────────────────────────────────────────────────────────

function doUpload() {
  if (!selectedFiles.value.length || status.value === 'uploading') return;

  const formData = new FormData();
  for (const file of selectedFiles.value) {
    formData.append('files', file);
  }

  status.value   = 'uploading';
  progress.value = 0;
  results.value  = [];
  errorMsg.value = '';

  const xhr = new XMLHttpRequest();

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      progress.value = Math.round((e.loaded / e.total) * 100);
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const data = JSON.parse(xhr.responseText);
        results.value = Array.isArray(data) ? data : [data];
        status.value  = 'done';
      } catch {
        errorMsg.value = 'Server returned an unexpected response.';
        status.value   = 'error';
      }
    } else {
      try {
        const body = JSON.parse(xhr.responseText);
        errorMsg.value = body.error || `Server error: ${xhr.status}`;
      } catch {
        errorMsg.value = `Server error: ${xhr.status}`;
      }
      status.value = 'error';
    }
  };

  xhr.onerror = () => {
    errorMsg.value = 'Network error — could not reach the server.';
    status.value   = 'error';
  };

  xhr.open('POST', getApiUrl('/admin/upload'));
  xhr.setRequestHeader('Authorization', props.authHeader);
  xhr.send(formData);
}

// Manage / Re-link ──────────────────────────────────────────────────────────────

async function loadExisting() {
  // Only fetch once per open; re-open the <details> will call this again but guard it
  if (existingLoaded.value || existingLoading.value) return;
  existingLoading.value = true;
  errorMsg.value = '';
  try {
    const res = await fetch(getApiUrl('/admin/uploads'), {
      headers: { Authorization: props.authHeader },
    });
    if (res.status === 503) {
      errorMsg.value = 'Admin access is not configured on the server.';
    } else if (!res.ok) {
      errorMsg.value = `Could not load files: server error ${res.status}.`;
    } else {
      existing.value = await res.json();
      existingLoaded.value = true;
    }
  } catch {
    errorMsg.value = 'Network error — could not reach the server.';
  } finally {
    existingLoading.value = false;
  }
}

async function doRelink(filename) {
  relinkPending.value = { ...relinkPending.value, [filename]: true };
  relinkResults.value = { ...relinkResults.value, [filename]: null };

  try {
    const res = await fetch(getApiUrl('/admin/relink'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: props.authHeader,
      },
      body: JSON.stringify({ filename }),
    });
    const data = await res.json();
    if (res.ok) {
      const msg = data.linkedCount
        ? `${data.linkedCount} feature(s) linked`
        : 'No matches found';
      relinkResults.value = { ...relinkResults.value, [filename]: { ok: true, msg, details: data.linkedAssets ?? null } };
    } else {
      relinkResults.value = { ...relinkResults.value, [filename]: { err: true, msg: data.error ?? 'Error' } };
    }
  } catch {
    relinkResults.value = { ...relinkResults.value, [filename]: { err: true, msg: 'Network error' } };
  } finally {
    relinkPending.value = { ...relinkPending.value, [filename]: false };
  }
}

async function relinkAll() {
  for (const f of existing.value.shapes) {
    await doRelink(f.filename);
  }
}

// ── Copy URL ───────────────────────────────────────────────────────────────────

async function copyUrl(dataPath) {
  try {
    await navigator.clipboard.writeText(getApiUrl(dataPath));
    copiedPath.value = dataPath;
    setTimeout(() => { copiedPath.value = ''; }, 2000);
  } catch { /* clipboard may be blocked */ }
}

// ── Delete file ────────────────────────────────────────────────────────────────

async function deleteFile(category, filename) {
  const key = `${category}/${filename}`;
  deletePending.value = { ...deletePending.value, [key]: true };
  try {
    const res = await fetch(getApiUrl(`/admin/uploads/${category}/${encodeURIComponent(filename)}`), {
      method: 'DELETE',
      headers: { Authorization: props.authHeader },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? `Failed to delete ${filename}`);
      return;
    }
    // Reload file list
    existingLoaded.value = false;
    existingLoading.value = false;
    await loadExisting();
  } catch {
    alert(`Network error while deleting ${filename}`);
  } finally {
    deletePending.value = { ...deletePending.value, [key]: false };
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

.section-header-simple { margin-bottom: 1rem; }
.section-title { margin: 0 0 0.2rem; font-size: 1rem; font-weight: 600; }
.section-desc  { margin: 0; font-size: 0.8rem; color: var(--admin-muted, #777); }

/* ── Drop zone ─────────────────────────────────────────────── */
.drop-zone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 1.75rem 1.5rem;
  border: 2px dashed var(--admin-border, #ccc);
  border-radius: 8px;
  background: var(--admin-bg, #f9fafb);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}
.drop-zone:hover        { border-color: #3b82f6; background: rgba(59,130,246,0.04); }
.drop-zone.drop-active  { border-color: #3b82f6; background: rgba(59,130,246,0.08); }
.drop-zone.has-files    { border-style: solid; border-color: #3b82f6; cursor: default; padding: 1rem; }

.drop-icon {
  width: 32px;
  height: 32px;
  color: var(--admin-muted, #aaa);
  margin-bottom: 0.25rem;
}

.drop-label {
  margin: 0;
  font-size: 0.875rem;
  color: var(--admin-text, #333);
}
.drop-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--admin-muted, #999);
}
.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: #3b82f6;
  font-size: inherit;
  cursor: pointer;
  font-family: "Segoe UI", sans-serif;
  text-decoration: underline;
}
.btn-link-danger { color: #ef4444; }

/* ── File list ─────────────────────────────────────────────── */
.file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.file-list-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--admin-surface, #fff);
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  text-align: left;
}
.file-type-badge {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: #e0e7ff;
  color: #3730a3;
  text-transform: uppercase;
}
.file-type-badge.geojson   { background: #dcfce7; color: #166534; }
.file-type-badge.geotiff   { background: #fef3c7; color: #92400e; }
.file-type-badge.\33 d,
.file-type-badge[class*="3d"] { background: #ede9fe; color: #5b21b6; }
.file-type-badge.pointcloud { background: #ffe4e6; color: #9f1239; }
.file-type-badge.companion  { background: #f3f4f6; color: #6b7280; }
.file-list-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--admin-text, #333);
}
.file-list-size {
  flex-shrink: 0;
  color: var(--admin-muted, #999);
  font-size: 0.75rem;
}
.btn-remove-one {
  flex-shrink: 0;
  background: transparent;
  border: none;
  font-size: 1rem;
  color: var(--admin-muted, #999);
  cursor: pointer;
  line-height: 1;
  padding: 0.1rem 0.25rem;
  border-radius: 4px;
}
.btn-remove-one:hover { color: #ef4444; background: rgba(239,68,68,0.08); }

.file-list-footer {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  margin-top: 0.4rem;
}

.file-input-hidden {
  position: absolute;
  width: 0; height: 0;
  opacity: 0; pointer-events: none;
}

/* ── Progress ──────────────────────────────────────────────── */
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.progress-track {
  flex: 1;
  height: 6px;
  background: var(--admin-border, #e0e0e0);
  border-radius: 3px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.2s;
}
.progress-label {
  font-size: 0.8rem;
  color: var(--admin-muted, #777);
  min-width: 32px;
  text-align: right;
}

/* ── Results ───────────────────────────────────────────────── */
.upload-results {
  margin-top: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.upload-result {
  padding: 0.85rem;
  background: rgba(34, 197, 94, 0.07);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 7px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  flex-wrap: wrap;
}
.result-badge {
  font-size: 0.72rem;
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
  border-radius: 4px;
  padding: 0.1rem 0.4rem;
  font-weight: 600;
}
.result-type-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: #e0e7ff;
  color: #3730a3;
  text-transform: uppercase;
}

.result-steps {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.78rem;
  color: var(--admin-muted, #555);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.result-url-box { margin-top: 0.25rem; }
.result-url-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.78rem;
  color: var(--admin-muted, #555);
  margin-bottom: 0.35rem;
}
.result-url-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.result-url {
  flex: 1;
  font-size: 0.78rem;
  background: var(--admin-bg, #f3f4f6);
  border: 1px solid var(--admin-border, #ddd);
  border-radius: 5px;
  padding: 0.35rem 0.55rem;
  word-break: break-all;
  color: var(--admin-text, #333);
  font-family: "Consolas", "Fira Code", monospace;
}
.btn-copy {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.7rem;
  font-size: 0.78rem;
  border: 1px solid var(--admin-border, #ccc);
  border-radius: 5px;
  background: var(--admin-surface, #fff);
  cursor: pointer;
  font-family: "Segoe UI", sans-serif;
  color: var(--admin-text, #333);
  text-decoration: none;
  transition: background 0.12s;
}
.btn-copy:hover  { background: var(--admin-bg, #f3f4f6); }
.btn-copy.copied { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.4); color: #16a34a; }

/* ── Error ─────────────────────────────────────────────────── */
.upload-error {
  margin: 0.75rem 0 0;
  padding: 0.4rem 0.6rem;
  font-size: 0.82rem;
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 5px;
}

/* ── Upload button ─────────────────────────────────────────── */
.upload-actions {
  margin-top: 0.85rem;
  display: flex;
  justify-content: flex-end;
}
.btn-upload {
  padding: 0.55rem 1.35rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: "Segoe UI", sans-serif;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
/* ── Manage panel ────────────────────────────────────────────── */
.manage-section {
  margin-top: 1rem;
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 7px;
  overflow: hidden;
}
.manage-summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--admin-text, #333);
  background: var(--admin-bg, #f9fafb);
  cursor: pointer;
  user-select: none;
  list-style: none;
}
.manage-summary::-webkit-details-marker { display: none; }
.manage-summary::before {
  content: '▶';
  font-size: 0.6rem;
  transition: transform 0.15s;
  color: var(--admin-muted, #999);
}
details[open] > .manage-summary::before { transform: rotate(90deg); }

.manage-spin {
  font-size: 0.8rem;
  color: #3b82f6;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.manage-grid {
  padding: 0.6rem 0.85rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.manage-group-label {
  margin: 0.5rem 0 0.2rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--admin-muted, #999);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.manage-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0.5rem 0 0.2rem;
}
.manage-group-header:first-child { margin-top: 0; }
.manage-group-header .manage-group-label { margin: 0; }
.manage-group-label:first-child { margin-top: 0; }

.btn-relink-all {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
}

.manage-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--admin-border, #f0f0f0);
}
.manage-row:last-child { border-bottom: none; }

.manage-file-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
}

.manage-filename {
  flex: 1;
  font-size: 0.8rem;
  color: var(--admin-text, #444);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "Consolas", monospace;
}

.manage-row-actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

/* Base style for all manage action buttons */
.btn-manage {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.6rem;
  font-size: 0.73rem;
  font-family: "Segoe UI", sans-serif;
  border-radius: 5px;
  border: 1px solid var(--admin-border, #d1d5db);
  background: var(--admin-surface, #fff);
  color: var(--admin-text, #374151);
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1.6;
  font-weight: 500;
  transition: background 0.12s, border-color 0.12s, color 0.12s, box-shadow 0.12s;
}
.btn-manage:hover:not(:disabled) {
  background: var(--admin-bg, #f3f4f6);
  border-color: #9ca3af;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
}
.btn-manage:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-relink { border-color: rgba(99,102,241,0.35); color: #4338ca; background: rgba(99,102,241,0.05); }
.btn-relink:hover:not(:disabled)      { background: #eef2ff; border-color: #818cf8; color: #3730a3; }
.btn-relink-ok                         { background: rgba(34,197,94,0.1);   border-color: rgba(34,197,94,0.4); color: #16a34a; }
.btn-relink-err                        { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.3); color: #b91c1c; }

.btn-link3d { border-color: rgba(14,165,233,0.35); color: #0369a1; background: rgba(14,165,233,0.05); }
.btn-link3d:hover { background: #e0f2fe; border-color: #38bdf8; color: #075985; }

.manage-row-wrap { display: flex; flex-direction: column; gap: 4px; margin-bottom: 2px; }
.relink-details  { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 6px 2px 6px; }
.relink-detail-tag {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 500; line-height: 1.4;
}
.relink-detail-model { background: rgba(99,102,241,0.1); color: #4338ca; border: 1px solid rgba(99,102,241,0.3); }
.relink-detail-pc    { background: rgba(14,165,233,0.1); color: #0369a1; border: 1px solid rgba(14,165,233,0.3); }
.relink-detail-count { font-weight: 700; font-size: 10px; opacity: 0.85; }
.relink-detail-none  { font-size: 11px; color: #9ca3af; font-style: italic; }

.btn-file-download { color: #0369a1; border-color: rgba(3,105,161,0.3); background: rgba(3,105,161,0.04); }
.btn-file-download:hover:not(:disabled) { background: #e0f2fe; border-color: #38bdf8; color: #0369a1; }
.btn-file-copy { color: var(--admin-text, #374151); }
.btn-file-copy:hover:not(:disabled)     { background: var(--admin-bg, #f3f4f6); }
.btn-file-copy-ok                       { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.4); color: #16a34a; }

.btn-file-delete {
  border-color: rgba(239,68,68,0.3);
  color: #dc2626;
  background: rgba(239,68,68,0.04);
}
.btn-file-delete:hover:not(:disabled) { background: rgba(239,68,68,0.1); border-color: #f87171; color: #b91c1c; }

.manage-empty {
  padding: 0.5rem 0;
  font-size: 0.8rem;
  color: var(--admin-muted, #999);
  margin: 0;
}
.manage-error { color: #ef4444 !important; font-size: 0.82rem; }

.btn-upload:hover:not(:disabled) { background: #2563eb; }
.btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
