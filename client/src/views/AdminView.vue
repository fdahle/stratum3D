<template>
  <!-- ── Password Gate ─────────────────────────────────────────── -->
  <div v-if="!isAuthenticated" class="admin-gate">
    <div class="gate-card">
      <div class="gate-icon">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>

      <h2 class="gate-title">Admin Access</h2>
      <p class="gate-subtitle">Hist Map Configuration</p>

      <form class="gate-form" @submit.prevent="attemptLogin">
        <div class="field-group" :class="{ 'field-error': loginError }">
          <label for="admin-password">Password</label>
          <input
            id="admin-password"
            ref="passwordFieldRef"
            v-model="password"
            type="password"
            placeholder="Enter admin password"
            autocomplete="current-password"
            :disabled="isLoading"
          />
          <p v-if="loginError" class="error-hint">{{ loginError }}</p>
        </div>

        <button type="submit" class="btn-primary btn-full" :disabled="isLoading || !password">
          <span v-if="isLoading">Verifying…</span>
          <span v-else>Sign In</span>
        </button>
      </form>

      <a class="gate-back" href="/">← Back to map</a>
    </div>
  </div>

  <!-- ── Admin Layout (authenticated) ─────────────────────────── -->
  <div v-else class="admin-layout">
    <header class="admin-header">
      <div class="admin-header-inner">
        <span class="admin-brand">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          Hist Map Admin
        </span>
        <nav class="admin-nav">
          <a href="/" class="nav-back">← Back to map</a>
          <button class="btn-signout" @click="logout">Sign out</button>
        </nav>
      </div>
    </header>

    <main class="admin-main">
      <div v-if="loadError" class="banner banner-error">{{ loadError }}</div>
      <div v-if="saveSuccess" class="banner banner-success">Configuration saved successfully.</div>

      <div class="editor-grid">
        <!-- ── 1. Website ─────────────────────────────────────── -->
        <section class="admin-section">
          <div class="section-header-simple">
            <h2 class="section-title">Website</h2>
            <p class="section-desc">Page title, favicon and search bar defaults.</p>
          </div>
          <div class="fields-stack">
            <div class="field-row-2">
              <div class="field-group">
                <label>Site Title</label>
                <input v-model="draft.website.title" type="text" placeholder="Hist Map" />
              </div>
              <div class="field-group">
                <label>Favicon URL<FieldHint text="URL to the browser tab icon. Can be a relative path (e.g. /vite.svg) or an absolute HTTPS URL." /></label>
                <input v-model="draft.website.favicon" type="text" placeholder="/vite.svg" />
              </div>
            </div>
            <div class="field-row-2">
              <div class="field-group">
                <label>Search Placeholder</label>
                <input v-model="draft.website.search.placeholder" type="text" placeholder="Search..." />
              </div>
              <div class="field-group">
                <label>Search Default Query<FieldHint text="Pre-fills the search bar when the map loads. Leave blank for an empty search bar." /></label>
                <input v-model="draft.website.search.defaultQuery" type="text" placeholder="" />
              </div>
            </div>
          </div>
        </section>

        <!-- ── 2. Map View ────────────────────────────────────── -->
        <section class="admin-section">
          <div class="section-header-simple">
            <h2 class="section-title">Map View</h2>
            <p class="section-desc">Initial centre, zoom level and extent constraints.</p>
          </div>
          <div class="fields-stack">
            <div class="field-row-2">
              <div class="field-group">
                <label>Centre X (projected)<FieldHint text="X coordinate in the map's projection units. For EPSG:4326 use longitude (decimal degrees)." /></label>
                <input v-model.number="draft.view.center[0]" type="number" />
              </div>
              <div class="field-group">
                <label>Centre Y (projected)<FieldHint text="Y coordinate in the map's projection units. For EPSG:4326 use latitude (decimal degrees)." /></label>
                <input v-model.number="draft.view.center[1]" type="number" />
              </div>
            </div>
            <div class="field-row-3">
              <div class="field-group">
                <label>Zoom<FieldHint text="Initial zoom level when the map loads. Higher values zoom in further (0 = world view, 14 ≈ street level)." /></label>
                <input v-model.number="draft.view.zoom" type="number" min="0" max="28" step="0.5" />
              </div>
              <div class="field-group">
                <label>Min Zoom<FieldHint text="Furthest out the user can zoom. Must be ≤ initial Zoom and less than Max Zoom." /></label>
                <input v-model.number="draft.view.minZoom" type="number" min="0" max="28" />
              </div>
              <div class="field-group">
                <label>Max Zoom<FieldHint text="Furthest in the user can zoom. Must be ≥ initial Zoom and greater than Min Zoom." /></label>
                <input v-model.number="draft.view.maxZoom" type="number" min="0" max="28" />
              </div>
            </div>
            <div class="field-group">
              <label>Extent<FieldHint text="Restricts panning to this bounding box in projected units. Users cannot navigate outside it. Leave blank for unlimited panning." /><span class="hint"> [minX, minY, maxX, maxY] — leave blank for none</span></label>
              <input v-model="viewExtentStr" type="text" placeholder="-20037508, -20037508, 20037508, 20037508" @blur="parseViewExtent" />
            </div>
            <div v-if="viewWarnings.length" class="warnings-block">
              <p v-for="w in viewWarnings" :key="w" class="field-warn">⚠ {{ w }}</p>
            </div>
          </div>
        </section>

        <!-- ── 3. CRS ─────────────────────────────────────────── -->
        <section class="admin-section">
          <div class="section-header-simple">
            <h2 class="section-title">Coordinate Reference System</h2>
            <p class="section-desc">Use any EPSG code. Add a custom proj string for non-standard CRS.</p>
          </div>
          <div class="fields-stack">
            <div class="field-group">
              <label>EPSG Code <span class="required">*</span><FieldHint text="Standard CRS identifier. Common values: EPSG:3857 (Web Mercator), EPSG:4326 (WGS84), EPSG:3031 (Antarctic)." /></label>
              <input v-model="draft.crs" type="text" placeholder="EPSG:3857" />
              <p v-if="crsWarning" class="field-warn">⚠ {{ crsWarning }}</p>
            </div>
            <details class="collapsible">
              <summary>Custom Projection Parameters</summary>
              <div class="collapsible-body">
                <div class="field-group">
                  <label>Proj String<FieldHint text="Only needed for non-standard projections not in the browser's built-in list. Use PROJ4 syntax, e.g. +proj=stere +lat_0=-90 +datum=WGS84." /></label>
                  <input v-model="draft.projection_params.proj_string" type="text" placeholder="+proj=stere ..." />
                </div>
                <div class="field-group">
                  <label>Projection Extent<FieldHint text="Full bounding box of the custom CRS in projected metres. Required when using a custom proj string." /><span class="hint"> [minX, minY, maxX, maxY]</span></label>
                  <input v-model="projExtentStr" type="text" placeholder="-12367396, -12367396, 12367396, 12367396" @blur="parseProjExtent" />
                </div>
              </div>
            </details>
          </div>
        </section>

        <!-- ── 4. Base Layers ─────────────────────────────────── -->
        <LayersSection
          title="Base Layers"
          description="Background tile layers. Exactly one must be visible at a time."
          layer-group="base"
          :layers="draft.base_layers"
          @update:layers="draft.base_layers = $event"
        />

        <!-- ── 5. Overlay Layers ──────────────────────────────── -->
        <LayersSection
          title="Overlay Layers"
          description="Data layers (GeoJSON, GeoTIFF) rendered on top of the base map."
          layer-group="overlay"
          :layers="draft.overlay_layers"
          @update:layers="draft.overlay_layers = $event"
        />

        <!-- ── 6. Viewer Permissions ──────────────────────────── -->
        <section class="admin-section">
          <div class="section-header-simple">
            <h2 class="section-title">Viewer Permissions</h2>
            <p class="section-desc">Control which actions are available to users in the map and 3D viewer.</p>
          </div>
          <div class="fields-stack">
            <label class="toggle-row">
              <input type="checkbox" v-model="draft.ui.allow_download" />
              Allow layer download (map &amp; 3D viewer)
            </label>
            <label class="toggle-row">
              <input type="checkbox" v-model="draft.ui.allow_upload" />
              Allow file upload (map &amp; 3D viewer)
            </label>
          </div>
        </section>

        <!-- ── 7. Upload Data ─────────────────────────────────── -->
        <UploadSection :auth-header="currentAuthHeader" />
      </div>

    </main>

    <!-- Save bar — outside the scroll region so it's always visible -->
    <div class="save-bar">
      <p v-if="validationError" class="save-error">{{ validationError }}</p>
      <button class="btn-save" :disabled="isSaving" @click="saveConfig">
        <span v-if="isSaving">Saving…</span>
        <span v-else>Save Configuration</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import yaml from 'js-yaml';
import { getApiUrl } from '../utils/config';
import { validateConfig } from '../constants/configValidation';
import LayersSection from '../components/admin/LayersSection.vue';
import FieldHint from '../components/admin/FieldHint.vue';
import UploadSection from '../components/admin/UploadSection.vue';

// ── State ──────────────────────────────────────────────────────
const isAuthenticated  = ref(false);
const isLoading        = ref(false);
const isSaving         = ref(false);
const password         = ref('');
const loginError       = ref('');
const loadError        = ref('');
const saveSuccess      = ref(false);
const validationError  = ref('');
const passwordFieldRef = ref(null);

const SESSION_KEY = 'admin_auth';

// ── Draft config ───────────────────────────────────────────────
function blankDraft() {
  return {
    website: { title: 'Hist Map', favicon: '/vite.svg', search: { placeholder: 'Search...', defaultQuery: '' } },
    view: { center: [0, 0], zoom: 7, minZoom: 0, maxZoom: 28, extent: null },
    crs: 'EPSG:3857',
    projection_params: { proj_string: '', extent: null },
    base_layers: [],
    overlay_layers: [],
    ui: { allow_download: true, allow_upload: true },
  };
}

const draft = ref(blankDraft());
const viewExtentStr = ref('');
const projExtentStr = ref('');

// ── Live warnings ──────────────────────────────────────────────
const viewWarnings = computed(() => {
  const warnings = [];
  const v = draft.value.view;
  const { zoom, minZoom, maxZoom, extent, center } = v;
  if (minZoom != null && maxZoom != null && minZoom >= maxZoom) {
    warnings.push('Min Zoom must be less than Max Zoom.');
  } else {
    if (minZoom != null && zoom != null && minZoom > zoom)
      warnings.push('Min Zoom is greater than initial Zoom — the map will open outside the allowed range.');
    if (maxZoom != null && zoom != null && maxZoom < zoom)
      warnings.push('Max Zoom is less than initial Zoom — the map will open outside the allowed range.');
  }
  if (extent?.length === 4 && center?.length === 2) {
    const [cx, cy] = center;
    const [x0, y0, x1, y1] = extent;
    if (cx < x0 || cx > x1 || cy < y0 || cy > y1)
      warnings.push('Centre is outside the defined extent — the initial view will be panned out of bounds.');
  }
  return warnings;
});

const crsWarning = computed(() => {
  const crs = (draft.value.crs || '').trim();
  if (!crs) return '';
  if (!/^EPSG:\d+$/i.test(crs))
    return 'CRS should be in the format EPSG:XXXX (e.g. EPSG:3857 for Web Mercator).';
  return '';
});

function parseViewExtent() {
  const nums = viewExtentStr.value.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
  draft.value.view.extent = nums.length === 4 ? nums : null;
}
function parseProjExtent() {
  const nums = projExtentStr.value.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
  draft.value.projection_params.extent = nums.length === 4 ? nums : null;
}

function loadConfigIntoDraft(config) {
  const d = blankDraft();
  if (config.website) {
    d.website.title   = config.website.title   ?? d.website.title;
    d.website.favicon = config.website.favicon ?? d.website.favicon;
    if (config.website.search) {
      d.website.search.placeholder  = config.website.search.placeholder  ?? d.website.search.placeholder;
      d.website.search.defaultQuery = config.website.search.defaultQuery ?? d.website.search.defaultQuery;
    }
  }
  if (config.view) {
    d.view.center  = config.view.center  ?? d.view.center;
    d.view.zoom    = config.view.zoom    ?? d.view.zoom;
    d.view.minZoom = config.view.minZoom ?? d.view.minZoom;
    d.view.maxZoom = config.view.maxZoom ?? d.view.maxZoom;
    d.view.extent  = config.view.extent  ?? null;
    viewExtentStr.value = d.view.extent ? d.view.extent.join(', ') : '';
  }
  d.crs = config.crs ?? d.crs;
  if (config.projection_params) {
    d.projection_params.proj_string = config.projection_params.proj_string ?? '';
    d.projection_params.extent      = config.projection_params.extent      ?? null;
    projExtentStr.value = d.projection_params.extent ? d.projection_params.extent.join(', ') : '';
  }
  d.base_layers    = config.base_layers    ?? [];
  d.overlay_layers = config.overlay_layers ?? [];
  if (config.ui) {
    d.ui.allow_download = config.ui.allow_download ?? true;
    d.ui.allow_upload   = config.ui.allow_upload   ?? true;
  }
  draft.value = d;
}

function buildConfig() {
  const d = draft.value;
  const out = {};
  out.website = {
    title: d.website.title, favicon: d.website.favicon,
    search: { placeholder: d.website.search.placeholder, defaultQuery: d.website.search.defaultQuery },
  };
  out.view = { center: d.view.center, zoom: d.view.zoom };
  if (d.view.extent)                  out.view.extent   = d.view.extent;
  if (d.view.minZoom !== undefined)   out.view.minZoom  = d.view.minZoom;
  if (d.view.maxZoom !== undefined)   out.view.maxZoom  = d.view.maxZoom;
  out.crs = d.crs;
  if (d.projection_params.proj_string?.trim()) {
    out.projection_params = { proj_string: d.projection_params.proj_string };
    if (d.projection_params.extent) out.projection_params.extent = d.projection_params.extent;
  }
  out.base_layers    = d.base_layers;
  out.overlay_layers = d.overlay_layers;
  out.ui = { allow_download: d.ui.allow_download, allow_upload: d.ui.allow_upload };
  return out;
}

// ── Helpers ────────────────────────────────────────────────────
function buildAuthHeader(pwd) {
  return 'Basic ' + btoa('admin:' + pwd);
}
function getStoredPassword() {
  return sessionStorage.getItem(SESSION_KEY);
}
// Reactive auth header — passed down to components that make authenticated requests
const currentAuthHeader = computed(() => buildAuthHeader(getStoredPassword() || ''));
async function fetchConfig(pwd) {
  const res = await fetch(getApiUrl('/config'), {
    headers: { Authorization: buildAuthHeader(pwd) },
  });
  if (res.status === 401 || res.status === 403) throw new Error('Invalid password');
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return yaml.load(await res.text());
}

// ── Auth ───────────────────────────────────────────────────────
async function attemptLogin() {
  if (!password.value) return;
  isLoading.value  = true;
  loginError.value = '';
  try {
    const config = await fetchConfig(password.value);
    loadConfigIntoDraft(config);
    sessionStorage.setItem(SESSION_KEY, password.value);
    isAuthenticated.value = true;
  } catch (err) {
    loginError.value = err.message;
    password.value   = '';
    await new Promise(r => setTimeout(r, 0));
    passwordFieldRef.value?.focus();
  } finally {
    isLoading.value = false;
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  isAuthenticated.value = false;
  draft.value           = blankDraft();
  password.value        = '';
  loginError.value      = '';
}

// ── Save ───────────────────────────────────────────────────────
async function saveConfig() {
  validationError.value = '';
  saveSuccess.value     = false;
  const config = buildConfig();
  try {
    validateConfig(config);
  } catch (err) {
    validationError.value = err.message;
    return;
  }
  isSaving.value = true;
  try {
    const yamlText = yaml.dump(config, { lineWidth: 120, noRefs: true });
    const res = await fetch(getApiUrl('/config'), {
      method: 'PUT',
      headers: { 'Content-Type': 'text/yaml', Authorization: buildAuthHeader(getStoredPassword()) },
      body: yamlText,
    });
    if (res.status === 401 || res.status === 403) throw new Error('Session expired. Please sign out and sign back in.');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server error: ${res.status}`);
    }
    saveSuccess.value = true;
    setTimeout(() => { saveSuccess.value = false; }, 5000);
  } catch (err) {
    validationError.value = err.message;
  } finally {
    isSaving.value = false;
  }
}

// ── Auto-restore session ───────────────────────────────────────
onMounted(async () => {
  const stored = getStoredPassword();
  if (!stored) return;
  isLoading.value = true;
  try {
    const config = await fetchConfig(stored);
    loadConfigIntoDraft(config);
    isAuthenticated.value = true;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
/* ── Base font ─────────────────────────────────────────────── */
.admin-gate,
.admin-layout {
  font-family: "Segoe UI", sans-serif;
}

/* ── Shared ────────────────────────────────────────────────── */
.admin-gate,
.admin-layout {
  background: var(--admin-bg, #f3f4f6);
  color: var(--admin-text, #1a1a1a);
}

.admin-gate {
  min-height: 100vh;
}

:global(body.theme-dark) .admin-gate,
:global(body.theme-dark) .admin-layout {
  --admin-bg: #1a1a1a;
  --admin-text: #e0e0e0;
  --admin-surface: #2a2a2a;
  --admin-border: #444;
  --admin-muted: #999;
  --admin-input-bg: #333;
  --admin-input-border: #555;
  --admin-header-bg: #222;
  --admin-shadow: rgba(0,0,0,0.5);
}

:global(body.theme-light) .admin-gate,
:global(body.theme-light) .admin-layout {
  --admin-bg: #f3f4f6;
  --admin-text: #1a1a1a;
  --admin-surface: #ffffff;
  --admin-border: #e0e0e0;
  --admin-muted: #777;
  --admin-input-bg: #ffffff;
  --admin-input-border: #ccc;
  --admin-header-bg: #ffffff;
  --admin-shadow: rgba(0,0,0,0.1);
}

/* ── Gate ──────────────────────────────────────────────────── */
.admin-gate {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.gate-card {
  background: var(--admin-surface, #fff);
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 12px;
  box-shadow: 0 4px 24px var(--admin-shadow, rgba(0,0,0,0.1));
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 380px;
  text-align: center;
}

.gate-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  margin-bottom: 1.25rem;
}

.gate-title {
  margin: 0 0 0.25rem;
  font-size: 1.4rem;
  font-weight: 600;
}

.gate-subtitle {
  margin: 0 0 1.75rem;
  color: var(--admin-muted, #777);
  font-size: 0.9rem;
}

.gate-form { text-align: left; }

.gate-back {
  display: inline-block;
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: var(--admin-muted, #777);
  text-decoration: none;
}
.gate-back:hover { text-decoration: underline; }

/* ── Field (gate) ──────────────────────────────────────────── */
.field-group {
  margin-bottom: 1rem;
}
.field-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
}
.field-group input[type="text"],
.field-group input[type="password"],
.field-group input[type="number"] {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--admin-input-border, #ccc);
  border-radius: 6px;
  background: var(--admin-input-bg, #fff);
  color: var(--admin-text, #1a1a1a);
  font-size: 0.95rem;
  font-family: "Segoe UI", sans-serif;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.field-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
}
.field-group input:disabled { opacity: 0.6; cursor: not-allowed; }

.field-error input { border-color: #ef4444; }
.error-hint {
  margin: 0.4rem 0 0;
  font-size: 0.825rem;
  color: #ef4444;
}

/* ── Buttons ───────────────────────────────────────────────── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.65rem 1.25rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  font-family: "Segoe UI", sans-serif;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #2563eb; }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-full { width: 100%; }

/* ── Header ────────────────────────────────────────────────── */
.admin-header {
  background: var(--admin-header-bg, #fff);
  border-bottom: 1px solid var(--admin-border, #e0e0e0);
  position: sticky;
  top: 0;
  z-index: 10;
}
.admin-header-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.admin-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  font-size: 1rem;
}
.admin-nav { display: flex; align-items: center; gap: 1rem; }
.nav-back {
  font-size: 0.875rem;
  color: var(--admin-muted, #777);
  text-decoration: none;
}
.nav-back:hover { text-decoration: underline; }
.btn-signout {
  font-size: 0.825rem;
  padding: 0.35rem 0.75rem;
  background: transparent;
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 6px;
  color: var(--admin-text, #1a1a1a);
  cursor: pointer;
  font-family: "Segoe UI", sans-serif;
  transition: background 0.15s;
}
.btn-signout:hover { background: var(--admin-bg, #f3f4f6); }

/* ── Layout: self-contained scroll container ───────────────── */
.admin-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* ── Main / grid ───────────────────────────────────────────── */
.admin-main {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 1.5rem;
}
.editor-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
}

/* ── Section cards ─────────────────────────────────────────── */
.admin-section {
  background: var(--admin-surface, #fff);
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 10px;
  padding: 1.25rem;
}
.section-header-simple { margin-bottom: 1rem; }
.section-title { margin: 0 0 0.2rem; font-size: 1rem; font-weight: 600; }
.section-desc  { margin: 0; font-size: 0.8rem; color: var(--admin-muted, #777); }

.fields-stack { display: flex; flex-direction: column; gap: 0.75rem; }

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
}
.toggle-row input[type="checkbox"] { cursor: pointer; }

.field-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.field-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }

/* override field-group in section context */
.admin-section .field-group { margin-bottom: 0; }
.admin-section .field-group label {
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 0.3rem;
}
.admin-section .field-group input[type="text"],
.admin-section .field-group input[type="number"] {
  padding: 0.45rem 0.65rem;
  font-size: 0.875rem;
}

.required { color: #ef4444; margin-left: 2px; }
.hint { font-size: 0.75rem; color: var(--admin-muted, #777); margin-left: 4px; font-weight: 400; }

/* ── Collapsible ───────────────────────────────────────────── */
.collapsible {
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 6px;
}
.collapsible summary {
  padding: 0.5rem 0.75rem;
  font-size: 0.825rem;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  background: var(--admin-bg, #f3f4f6);
  border-radius: 5px 5px 0 0;
}
details.collapsible:not([open]) > summary {
  border-radius: 5px;
}
.collapsible-body {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border-top: 1px solid var(--admin-border, #e0e0e0);
}

/* ── Save bar ──────────────────────────────────────────────── */
.save-bar {
  flex-shrink: 0;
  background: var(--admin-header-bg, #fff);
  border-top: 1px solid var(--admin-border, #e0e0e0);
  padding: 0.85rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
}
.save-error {
  margin: 0;
  font-size: 0.85rem;
  color: #ef4444;
}
.btn-save {
  padding: 0.6rem 1.75rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: "Segoe UI", sans-serif;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.btn-save:hover:not(:disabled) { background: #2563eb; }
.btn-save:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── Banners ───────────────────────────────────────────────── */
.banner {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}
.banner-error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #ef4444;
}
.banner-success {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: #22c55e;
}

/* ── Inline warnings ───────────────────────────────────────── */
.warnings-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.field-warn {
  margin: 0.25rem 0 0;
  padding: 0.3rem 0.5rem;
  font-size: 0.78rem;
  color: #b45309;
  background: rgba(217, 119, 6, 0.09);
  border: 1px solid rgba(217, 119, 6, 0.25);
  border-radius: 4px;
}
</style>

