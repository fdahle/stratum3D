<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('cancel')">
      <div class="modal-content">

        <header class="modal-header">
          <h3>Configure Upload</h3>
          <button class="close-btn" title="Close" @click="$emit('cancel')">✕</button>
        </header>

        <div class="modal-body">
          <div
            v-for="(fs, i) in fileSettings"
            :key="fs.name + i"
            class="file-card"
          >
            <!-- Card header -->
            <div class="file-card-header">
              <span class="file-type-badge" :class="extClass(fs.name)">{{ extLabel(fs.name) }}</span>
              <span class="file-card-name">{{ fs.name }}</span>
              <span class="file-card-size">{{ formatSize(fs.size) }}</span>
              <button class="btn-remove-one" title="Remove" @click="$emit('remove', i)">×</button>
            </div>

            <!-- Companion: no settings -->
            <template v-if="isCompanion(fs.name)">
              <p class="companion-note">Companion file — processed automatically with its parent.</p>
            </template>

            <!-- Primary file settings -->
            <template v-else>
              <div class="file-card-settings">

                <!-- Display name — always -->
                <div class="field-group-sm">
                  <label>Display name</label>
                  <input
                    v-model="fs.displayName"
                    type="text"
                    :placeholder="defaultDisplayName(fs.name)"
                  >
                </div>

                <!-- GeoTIFF -->
                <template v-if="isGeoTiff(fs.name)">
                  <div class="settings-section">
                    <div class="settings-section-title">Optimisation</div>
                    <div class="field-group-sm">
                      <label>
                        Format
                        <FieldHint text="COG (Cloud Optimised GeoTIFF) enables efficient tile streaming. Requires GDAL on the server. The conversion runs in the background." />
                      </label>
                      <select v-model="fs.optimize">
                        <option value="">Store as-is</option>
                        <option value="cog">Convert to COG (requires GDAL)</option>
                      </select>
                    </div>
                  </div>
                  <div class="toggle-row">
                    <span class="toggle-row-label">Keep copy of original <FieldHint text="Retain the original file on the server alongside the processed version, so it can be downloaded later." /></span>
                    <div class="toggle-pill">
                      <input :id="`keep-${i}`" v-model="fs.keepOriginal" type="checkbox" class="toggle-input">
                      <label :for="`keep-${i}`" class="toggle-track"><span class="toggle-thumb"></span></label>
                    </div>
                  </div>
                </template>

                <!-- Point cloud -->
                <template v-if="isPointcloud(fs.name)">
                  <div class="settings-section">
                    <div class="settings-section-title">Optimisation</div>
                    <div class="field-group-sm">
                      <label>
                        Format
                        <FieldHint text="COPC (Cloud Optimised Point Cloud) enables progressive streaming. Requires PDAL/untwine. Runs in the background." />
                      </label>
                      <select v-model="fs.optimize">
                        <option value="">Store as-is</option>
                        <option value="copc">Convert to COPC (requires PDAL)</option>
                      </select>
                    </div>
                  </div>
                  <div class="toggle-row">
                    <span class="toggle-row-label">Keep copy of original <FieldHint text="Retain the original file on the server alongside the processed version, so it can be downloaded later." /></span>
                    <div class="toggle-pill">
                      <input :id="`keep-${i}`" v-model="fs.keepOriginal" type="checkbox" class="toggle-input">
                      <label :for="`keep-${i}`" class="toggle-track"><span class="toggle-thumb"></span></label>
                    </div>
                  </div>
                </template>

                <!-- CSV -->
                <template v-if="isCsv(fs.name)">
                  <div class="settings-section">
                    <div class="settings-section-title">Coordinate columns</div>
                    <div class="field-row-3">
                      <div class="field-group-sm">
                        <label>X / Longitude <FieldHint text="Column that holds the X (longitude / easting) coordinate." /></label>
                        <select v-if="csvHeaders(fs.name).length" v-model="fs.csvSettings.xColumn">
                          <option value="">— select —</option>
                          <option v-for="h in csvHeaders(fs.name)" :key="h" :value="h">{{ h }}</option>
                        </select>
                        <input v-else v-model="fs.csvSettings.xColumn" type="text" placeholder="lon">
                      </div>
                      <div class="field-group-sm">
                        <label>Y / Latitude <FieldHint text="Column that holds the Y (latitude / northing) coordinate." /></label>
                        <select v-if="csvHeaders(fs.name).length" v-model="fs.csvSettings.yColumn">
                          <option value="">— select —</option>
                          <option v-for="h in csvHeaders(fs.name)" :key="h" :value="h">{{ h }}</option>
                        </select>
                        <input v-else v-model="fs.csvSettings.yColumn" type="text" placeholder="lat">
                      </div>
                      <div class="field-group-sm">
                        <label>CRS <FieldHint text="EPSG code of the X/Y coordinates." /></label>
                        <input v-model="fs.csvSettings.crs" type="text" placeholder="EPSG:4326">
                      </div>
                    </div>
                  </div>
                </template>

                <!-- GeoJSON -->
                <template v-if="isGeoJson(fs.name)">
                  <div class="settings-section">
                    <div class="settings-section-title">Projection</div>
                    <div class="field-group-sm">
                      <label>Target CRS <FieldHint text="EPSG code to reproject to. Should match your map's CRS." /></label>
                      <input v-model="fs.shapeSettings.targetCrs" type="text" placeholder="EPSG:3031">
                    </div>
                  </div>

                  <div class="settings-section">
                    <div class="toggle-row toggle-row-flush">
                      <div>
                        <div class="settings-section-title" style="margin-bottom:0.1rem">Simplify geometry</div>
                        <div class="section-hint">Reduces vertex count (Douglas-Peucker). Shrinks file size but may lose detail.</div>
                      </div>
                      <div class="toggle-pill">
                        <input :id="`simplify-${i}`" v-model="fs.doSimplify" type="checkbox" class="toggle-input">
                        <label :for="`simplify-${i}`" class="toggle-track"><span class="toggle-thumb"></span></label>
                      </div>
                    </div>

                    <Transition name="slide-down">
                      <div v-if="fs.doSimplify" class="field-row-2">
                        <div class="field-group-sm">
                          <label>Tolerance (m) <FieldHint text="Higher = more aggressive. Units in the target CRS (usually metres)." /></label>
                          <input v-model.number="fs.shapeSettings.simplifyTolerance" type="number" min="0" placeholder="50">
                        </div>
                        <div class="field-group-sm">
                          <label>Coord precision <FieldHint text="Decimal places to keep. 0 = round to whole units, 6 = full precision." /></label>
                          <input v-model.number="fs.shapeSettings.coordinatePrecision" type="number" min="0" max="10" placeholder="0">
                        </div>
                      </div>
                    </Transition>
                  </div>
                  <div class="toggle-row">
                    <span class="toggle-row-label">Keep copy of original <FieldHint text="Retain the original file on the server alongside the processed version, so it can be downloaded later." /></span>
                    <div class="toggle-pill">
                      <input :id="`keep-${i}`" v-model="fs.keepOriginal" type="checkbox" class="toggle-input">
                      <label :for="`keep-${i}`" class="toggle-track"><span class="toggle-thumb"></span></label>
                    </div>
                  </div>
                </template>

              </div>
            </template>
          </div>
        </div>

        <footer class="modal-footer">
          <button class="btn-cancel" @click="$emit('cancel')">Cancel</button>
          <button class="btn-upload" @click="confirm">Upload &amp; Process</button>
        </footer>

      </div>
    </div>
  </Transition>
</template>

<script setup>
import { watch, ref } from 'vue';
import FieldHint from './FieldHint.vue';

const props = defineProps({
  isOpen: Boolean,
  files:  { type: Array, default: () => [] },
});

const emit = defineEmits(['confirm', 'cancel', 'remove']);

const GEOJSON_EXTS    = new Set(['.geojson', '.json']);
const GEOTIFF_EXTS    = new Set(['.tif', '.tiff']);
const POINTCLOUD_EXTS = new Set(['.las', '.laz']);
const CSV_EXTS        = new Set(['.csv']);
const COMPANION_EXTS  = new Set(['.mtl', '.jpg', '.jpeg', '.png', '.bmp', '.tga', '.gif', '.webp']);

function extOf(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.copc.laz')) return '.copc.laz';
  return '.' + lower.split('.').pop();
}

function isGeoJson(name)    { return GEOJSON_EXTS.has(extOf(name)); }
function isGeoTiff(name)    { return GEOTIFF_EXTS.has(extOf(name)); }
function isPointcloud(name) { const e = extOf(name); return POINTCLOUD_EXTS.has(e) || e === '.copc.laz'; }
function isCsv(name)        { return CSV_EXTS.has(extOf(name)); }
function isCompanion(name)  { return COMPANION_EXTS.has(extOf(name)) || extOf(name) === '.mtl'; }

function defaultDisplayName(name) {
  const base = name.split('.').slice(0, -1).join('.');
  return base.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const csvHeaderMap = ref({});

async function readCsvHeaders(file) {
  try {
    const text = await file.slice(0, 4096).text();
    const firstLine = text.split('\n')[0];
    const delim = firstLine.includes(';') ? ';' : ',';
    return firstLine.split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
  } catch { return []; }
}

function csvHeaders(name) { return csvHeaderMap.value[name] ?? []; }

function guessXYColumns(headers) {
  const lower = headers.map(h => h.toLowerCase());
  const xGuess = headers[lower.findIndex(h => ['lon', 'lng', 'longitude', 'x', 'easting'].includes(h))] ?? '';
  const yGuess = headers[lower.findIndex(h => ['lat', 'latitude', 'y', 'northing'].includes(h))] ?? '';
  return { xGuess, yGuess };
}

const fileSettings = ref([]);

watch(() => props.files, async (files) => {
  csvHeaderMap.value = {};
  fileSettings.value = await Promise.all(files.map(async f => {
    let csvSettings = { xColumn: '', yColumn: '', crs: 'EPSG:4326' };
    if (isCsv(f.name)) {
      const headers = await readCsvHeaders(f);
      csvHeaderMap.value[f.name] = headers;
      const { xGuess, yGuess } = guessXYColumns(headers);
      csvSettings = { xColumn: xGuess, yColumn: yGuess, crs: 'EPSG:4326' };
    }
    return {
      name: f.name, size: f.size,
      displayName: '', optimize: '', keepOriginal: false,
      doSimplify: true,
      csvSettings,
      shapeSettings: { targetCrs: 'EPSG:3031', simplifyTolerance: 50, coordinatePrecision: 0 },
    };
  }));
}, { immediate: true });

function confirm() {
  const settings = {};
  for (const s of fileSettings.value) {
    settings[s.name] = {
      displayName:  s.displayName || defaultDisplayName(s.name),
      visible:      true,
      optimize:     s.optimize || undefined,
      keepOriginal: s.keepOriginal,
      csvSettings:  s.csvSettings,
      shapeSettings: {
        ...s.shapeSettings,
        simplifyTolerance:   s.doSimplify ? s.shapeSettings.simplifyTolerance   : 0,
        coordinatePrecision: s.doSimplify ? s.shapeSettings.coordinatePrecision : 0,
      },
    };
  }
  emit('confirm', settings);
}

function extLabel(name) {
  if (isCsv(name)) return 'CSV';
  const e = extOf(name).replace('.', '').toUpperCase();
  if (e === 'COPC.LAZ') return 'COPC';
  return e || '?';
}

function extClass(name) {
  if (isGeoJson(name))    return 'badge-geojson';
  if (isGeoTiff(name))    return 'badge-geotiff';
  if (isPointcloud(name)) return 'badge-pointcloud';
  if (isCsv(name))        return 'badge-csv';
  const e = extOf(name).replace('.', '');
  if (['obj', 'ply', 'stl'].includes(e)) return 'badge-model';
  return 'badge-companion';
}

function formatSize(bytes) {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<style scoped>
/* ── Modal shell ─────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}

.modal-content {
  background: var(--admin-surface, #fff);
  color: var(--admin-text, #1a1a1a);
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.2);
  width: min(700px, 100%);
  display: flex; flex-direction: column;
  max-height: 90vh;
  font-family: "Segoe UI", system-ui, sans-serif;
}

.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--admin-border, #e0e0e0);
  flex-shrink: 0;
}
.modal-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }

.close-btn {
  background: transparent; border: none; cursor: pointer;
  color: var(--admin-muted, #777); font-size: 1rem;
  padding: 0.25rem 0.5rem; border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.close-btn:hover { background: var(--admin-bg, #f3f4f6); color: var(--admin-text, #1a1a1a); }

.modal-body {
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex; flex-direction: column; gap: 0.75rem;
  flex: 1;
}

.modal-footer {
  display: flex; justify-content: flex-end; gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--admin-border, #e0e0e0);
  flex-shrink: 0;
}

.btn-cancel {
  background: var(--admin-bg, #f3f4f6);
  color: var(--admin-text, #1a1a1a);
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 6px; padding: 0.45rem 1rem;
  cursor: pointer; font-size: 0.85rem; font-weight: 500;
  transition: background 0.15s;
}
.btn-cancel:hover { background: var(--admin-border, #e0e0e0); }

.btn-upload {
  background: #3b82f6; color: #fff;
  border: none; border-radius: 6px; padding: 0.45rem 1.1rem;
  cursor: pointer; font-size: 0.85rem; font-weight: 500;
  transition: background 0.15s;
}
.btn-upload:hover { background: #2563eb; }

/* ── File card ───────────────────────────────────────────────── */
.file-card {
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 8px;
  background: var(--admin-surface, #fff);
  overflow: hidden;
}

.file-card-header {
  display: flex; align-items: center; gap: 0.55rem;
  padding: 0.5rem 0.8rem;
  background: var(--admin-bg, #f3f4f6);
  border-bottom: 1px solid var(--admin-border, #e0e0e0);
}
.file-card-name {
  flex: 1; font-size: 0.85rem; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-card-size { font-size: 0.75rem; color: var(--admin-muted, #777); white-space: nowrap; }

.btn-remove-one {
  background: none; border: none; cursor: pointer;
  color: var(--admin-muted, #777); font-size: 1.15rem; line-height: 1;
  padding: 0.1rem 0.3rem; border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.btn-remove-one:hover { background: rgba(239,68,68,.12); color: #ef4444; }

.file-card-settings { padding: 0.7rem 0.85rem; display: flex; flex-direction: column; gap: 0.6rem; }
.companion-note { padding: 0.45rem 0.85rem; font-size: 0.78rem; color: var(--admin-muted, #777); margin: 0; }

/* ── Type badges ─────────────────────────────────────────────── */
.file-type-badge {
  font-size: 0.64rem; font-weight: 700; letter-spacing: .06em;
  padding: 0.15rem 0.4rem; border-radius: 4px;
  text-transform: uppercase; white-space: nowrap; flex-shrink: 0;
}
.badge-geojson    { background: #dcfce7; color: #15803d; }
.badge-geotiff    { background: #dbeafe; color: #1d4ed8; }
.badge-model      { background: #ede9fe; color: #6d28d9; }
.badge-pointcloud { background: #e0f2fe; color: #0369a1; }
.badge-companion  { background: var(--admin-bg, #f3f4f6); color: var(--admin-muted, #777); }
.badge-csv        { background: #ffedd5; color: #c2410c; }
:global(body.theme-dark) .badge-geojson    { background: #1a4d2e; color: #4ade80; }
:global(body.theme-dark) .badge-geotiff    { background: #1e3a5f; color: #60a5fa; }
:global(body.theme-dark) .badge-model      { background: #3b2a6e; color: #c4b5fd; }
:global(body.theme-dark) .badge-pointcloud { background: #1a3a4d; color: #38bdf8; }
:global(body.theme-dark) .badge-csv        { background: #3d2b1a; color: #fb923c; }

/* ── Form fields ─────────────────────────────────────────────── */
.field-group-sm { display: flex; flex-direction: column; gap: 0.3rem; }
.field-group-sm label {
  font-size: 0.8rem; font-weight: 500;
  color: var(--admin-text, #1a1a1a);
  display: flex; align-items: center; gap: 0.3rem;
}
.field-group-sm input,
.field-group-sm select {
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--admin-input-border, #ccc);
  border-radius: 6px;
  background: var(--admin-input-bg, #fff);
  color: var(--admin-text, #1a1a1a);
  font-size: 0.875rem;
  width: 100%;
}
.field-group-sm input:focus,
.field-group-sm select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
.field-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.field-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.6rem; }

/* ── Settings section block ──────────────────────────────────── */
.settings-section {
  display: flex; flex-direction: column; gap: 0.5rem;
  background: var(--admin-bg, #f3f4f6);
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 6px;
  padding: 0.65rem 0.75rem;
}
.settings-section-title {
  font-size: 0.7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: .07em;
  color: var(--admin-muted, #777);
}
.section-hint { font-size: 0.75rem; color: var(--admin-muted, #777); line-height: 1.4; }

/* ── Toggle rows ─────────────────────────────────────────────── */
.toggle-row {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  background: var(--admin-bg, #f3f4f6);
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  min-height: 2.2rem;
}
.toggle-row-flush {
  background: transparent; border: none; padding: 0;
  align-items: flex-start;
}
.toggle-row-label {
  font-size: 0.82rem; font-weight: 500;
  color: var(--admin-text, #1a1a1a);
  flex: 1; user-select: none;
  display: flex; align-items: center; gap: 0.3rem;
}

/* Toggle pill */
.toggle-pill { position: relative; flex-shrink: 0; }
.toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
  display: flex; align-items: center;
  width: 44px; height: 24px;
  background: var(--admin-border, #ccc);
  border-radius: 12px; cursor: pointer;
  transition: background 0.2s;
  padding: 0 3px;
}
.toggle-thumb {
  display: block; width: 18px; height: 18px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0,0,0,.3);
  transition: transform 0.2s cubic-bezier(.4,0,.2,1);
}
.toggle-input:checked + .toggle-track { background: #3b82f6; }
.toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(20px); }

/* ── Simplify expand/collapse ────────────────────────────────── */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: opacity 0.18s ease, max-height 0.22s ease;
  max-height: 120px; overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to { opacity: 0; max-height: 0; }

/* ── Modal transition ────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>