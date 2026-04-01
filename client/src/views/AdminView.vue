<template>
  <!-- ── Password Gate ─────────────────────────────────────────── -->
  <div v-if="!isAuthenticated" class="admin-gate">
    <div class="gate-card">
      <div v-if="isFirstRun" class="setup-welcome-banner">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <span>First-run setup — choose a password to protect this admin panel.</span>
      </div>
      <div class="gate-icon">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>

      <!-- First-run: create a new password -->
      <template v-if="isFirstRun">
        <h2 class="gate-title">Create Admin Password</h2>
        <p class="gate-subtitle">Choose a password to protect this panel.</p>

        <form class="gate-form" @submit.prevent="createPassword">
          <div class="field-group" :class="{ 'field-error': loginError }">
            <label for="admin-password">Password</label>
            <input
              id="admin-password"
              ref="passwordFieldRef"
              v-model="password"
              type="password"
              placeholder="Choose a password"
              autocomplete="new-password"
              :disabled="isLoading"
            />
          </div>
          <div class="field-group" :class="{ 'field-error': loginError }">
            <label for="admin-password-confirm">Confirm Password</label>
            <input
              id="admin-password-confirm"
              v-model="passwordConfirm"
              type="password"
              placeholder="Repeat your password"
              autocomplete="new-password"
              :disabled="isLoading"
            />
            <p v-if="loginError" class="error-hint">{{ loginError }}</p>
          </div>

          <button type="submit" class="btn-primary btn-full" :disabled="isLoading || !password || !passwordConfirm">
            <span v-if="isLoading">Creating…</span>
            <span v-else>Create Password</span>
          </button>
        </form>
      </template>

      <!-- Returning user: sign in -->
      <template v-else>
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
      </template>
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
          Admin Panel
        </span>
        <nav class="admin-nav">
          <template v-if="hasExistingConfig">
            <a href="/" class="nav-back">← Back to map</a>
            <button class="btn-signout" @click="logout">Sign out</button>
          </template>
        </nav>
      </div>
    </header>

    <main class="admin-main">
      <div v-if="!hasExistingConfig" class="banner banner-setup">
        🎉 Welcome! Configure your map below and click <strong>Save Configuration</strong> to get started.
      </div>
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
              <input v-model="draft.crs" type="text" placeholder="EPSG:3857" @input="crsChangeSaveConfirming = false" @change="onCrsChange" />
              <p v-if="crsWarning" class="field-warn">⚠ {{ crsWarning }}</p>
              <p v-if="crsChangedWithData" class="field-warn">
                ⚠ CRS changed from <strong>{{ loadedCrs }}</strong> — server-uploaded data layers were preprocessed for the old CRS. Re-process your data files after saving.
              </p>
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

        <!-- ── 4a. Map Background ───────────────────────────────── -->
        <section class="admin-section">
          <div class="section-header-simple">
            <h2 class="section-title">Map Background</h2>
            <p class="section-desc">Pinned OSM tile layer — URL auto-selected by CRS. Independent of the Base Layers list below.</p>
          </div>
          <label class="perm-card" :class="{ 'perm-card-on': osmBackground }">
            <div class="perm-card-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
              </svg>
            </div>
            <div class="perm-card-body">
              <span class="perm-card-title">OSM Background</span>
              <span class="perm-card-desc">{{ osmBgLabel }}</span>
            </div>
            <div class="perm-toggle-wrap">
              <input id="osm-bg-toggle" v-model="osmBackground" type="checkbox" class="perm-toggle-input" />
              <label for="osm-bg-toggle" class="perm-slider"></label>
            </div>
          </label>
        </section>

        <!-- ── 4. Base Layers ─────────────────────────────────── -->
        <LayersSection
          title="Basemaps"
          description="Additional tile/WMS/WMTS basemaps shown in the map's layer switcher, rendered above the OSM background."
          layer-group="base"
          :layers="draft.basemaps"
          @update:layers="draft.basemaps = $event"
        />

        <!-- ── 5 + 6. Data Layers (upload + manage) ─────────────── -->
        <DataLayersSection
          :auth-header="currentAuthHeader"
          @update:layers="draft.data_layers = $event"
        />

        <!-- ── 7. Viewer Permissions ──────────────────────────── -->
        <section class="admin-section">
          <div class="section-header-simple">
            <h2 class="section-title">Viewer Permissions</h2>
            <p class="section-desc">Control which actions are available to users in the map and 3D viewer.</p>
          </div>
          <div class="permissions-grid">
            <label class="perm-card" :class="{ 'perm-card-on': draft.ui.map_download }">
              <div class="perm-card-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <div class="perm-card-body">
                <span class="perm-card-title">Map — Download</span>
                <span class="perm-card-desc">Users can download map data files</span>
              </div>
              <div class="perm-toggle-wrap">
                <input :id="`perm-map-dl`" v-model="draft.ui.map_download" type="checkbox" class="perm-toggle-input" />
                <label :for="`perm-map-dl`" class="perm-slider"></label>
              </div>
            </label>

            <label class="perm-card" :class="{ 'perm-card-on': draft.ui.map_upload }">
              <div class="perm-card-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div class="perm-card-body">
                <span class="perm-card-title">Map — Upload</span>
                <span class="perm-card-desc">Users can drag &amp; drop files onto the map</span>
              </div>
              <div class="perm-toggle-wrap">
                <input :id="`perm-map-ul`" v-model="draft.ui.map_upload" type="checkbox" class="perm-toggle-input" />
                <label :for="`perm-map-ul`" class="perm-slider"></label>
              </div>
            </label>

            <label class="perm-card" :class="{ 'perm-card-on': draft.ui.viewer_download }">
              <div class="perm-card-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  <circle cx="19" cy="5" r="3" fill="currentColor" opacity="0.35" stroke="none"/>
                </svg>
              </div>
              <div class="perm-card-body">
                <span class="perm-card-title">3D Viewer — Download</span>
                <span class="perm-card-desc">Users can export 3D scene data</span>
              </div>
              <div class="perm-toggle-wrap">
                <input :id="`perm-v-dl`" v-model="draft.ui.viewer_download" type="checkbox" class="perm-toggle-input" />
                <label :for="`perm-v-dl`" class="perm-slider"></label>
              </div>
            </label>

            <label class="perm-card" :class="{ 'perm-card-on': draft.ui.viewer_upload }">
              <div class="perm-card-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  <circle cx="19" cy="5" r="3" fill="currentColor" opacity="0.35" stroke="none"/>
                </svg>
              </div>
              <div class="perm-card-body">
                <span class="perm-card-title">3D Viewer — Upload</span>
                <span class="perm-card-desc">Users can load 3D files into the viewer</span>
              </div>
              <div class="perm-toggle-wrap">
                <input :id="`perm-v-ul`" v-model="draft.ui.viewer_upload" type="checkbox" class="perm-toggle-input" />
                <label :for="`perm-v-ul`" class="perm-slider"></label>
              </div>
            </label>
          </div>
        </section>

        <!-- ── 8. Danger Zone ────────────────────────────────────── -->
        <section class="admin-section danger-zone">
          <div class="section-header-simple">
            <h2 class="section-title danger-title">Danger Zone</h2>
            <p class="section-desc">Irreversible actions — use with care.</p>
          </div>
          <div class="fields-stack">
            <div class="danger-row">
              <div class="danger-row-text">
                <strong>Reset configuration</strong>
                <span>Deletes the config file <em>and</em> the admin password. On next visit you can set a fresh password and reconfigure everything from scratch.</span>
              </div>
              <div v-if="!resetConfirming" class="danger-row-action">
                <button
                  class="btn-danger"
                  :disabled="!hasExistingConfig"
                  :title="!hasExistingConfig ? 'No configuration exists yet' : undefined"
                  @click="resetConfirming = true"
                >Reset Config…</button>
              </div>
              <div v-else class="danger-row-action danger-confirm">
                <span class="danger-confirm-label">Are you sure?</span>
                <button class="btn-danger" :disabled="isResetting" @click="resetConfig">
                  <span v-if="isResetting">Resetting…</span>
                  <span v-else>Yes, delete it</span>
                </button>
                <button class="btn-secondary" @click="resetConfirming = false">Cancel</button>
              </div>
            </div>

            <hr class="danger-divider" />

            <div class="danger-row">
              <div class="danger-row-text">
                <strong>Delete all uploaded files</strong>
                <span>Permanently removes all GeoTIFFs, GeoJSON shapes, 3D models and point clouds from the server. Layer URLs referencing these files will break.</span>
              </div>
              <div v-if="!deleteFilesConfirming" class="danger-row-action">
                <button class="btn-danger" @click="deleteFilesConfirming = true">Delete All Files…</button>
              </div>
              <div v-else class="danger-row-action danger-confirm">
                <span class="danger-confirm-label">Are you sure?</span>
                <button class="btn-danger" :disabled="isDeletingFiles" @click="deleteAllFiles">
                  <span v-if="isDeletingFiles">Deleting…</span>
                  <span v-else>Yes, delete all</span>
                </button>
                <button class="btn-secondary" @click="deleteFilesConfirming = false">Cancel</button>
              </div>
            </div>
          </div>
        </section>

        <!-- ── 9. Developer ─────────────────────────────────────── -->
        <section v-if="!isFirstRun" class="admin-section">
          <div class="section-header-simple">
            <h2 class="section-title">Developer</h2>
            <p class="section-desc">Inspect the YAML that will be written when you save.</p>
          </div>
          <details class="collapsible yaml-collapsible">
            <summary>View config YAML</summary>
            <div class="collapsible-body yaml-collapsible-body">
              <div class="yaml-inline-header">
                <button class="btn-secondary btn-sm" @click="navigator.clipboard.writeText(yamlPanelText)">Copy</button>
              </div>
              <pre class="yaml-pre yaml-pre-inline">{{ yamlPanelText }}</pre>
            </div>
          </details>
        </section>
      </div>

    </main>

    <!-- Save bar — outside the scroll region so it's always visible -->
    <div class="save-bar">
      <p v-if="validationError" class="save-error">{{ validationError }}</p>
      <template v-if="crsChangeSaveConfirming">
        <p class="save-error">
          ⚠ CRS changed from <strong>{{ loadedCrs }}</strong> to <strong>{{ draft.crs }}</strong>. Server-uploaded layers may not display correctly until re-processed. Save anyway?
        </p>
        <div class="save-confirm-row">
          <button class="btn-save btn-save-warn" :disabled="isSaving" @click="saveConfig">
            <span v-if="isSaving">Saving…</span>
            <span v-else>Yes, save anyway</span>
          </button>
          <button class="btn-secondary" @click="crsChangeSaveConfirming = false">Cancel</button>
        </div>
      </template>
      <template v-else>
        <button class="btn-save" :disabled="isSaving" @click="saveConfig">
          <span v-if="isSaving">Saving…</span>
          <span v-else>Save Configuration</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import yaml from 'js-yaml';
import { useRoute, useRouter } from 'vue-router';
import { getApiUrl } from '../utils/config';
import { validateConfig } from '../constants/configValidation';
import LayersSection from '../components/admin/LayersSection.vue';
import FieldHint from '../components/ui/FieldHint.vue';
import DataLayersSection from '../components/admin/DataLayersSection.vue';

// ── State ──────────────────────────────────────────────────────
const route = useRoute();
const router = useRouter();
const isFirstRun = ref(false);          // true when no password is set yet
const hasExistingConfig = ref(false);   // true once a config has been loaded or saved
const isAuthenticated  = ref(false);
const isLoading        = ref(false);
const isSaving         = ref(false);
const isResetting           = ref(false);
const resetConfirming       = ref(false);
const deleteFilesConfirming = ref(false);
const isDeletingFiles       = ref(false);
const newPassword        = ref('');
const newPasswordConfirm = ref('');
const changingPassword   = ref(false);
const changePasswordError = ref('');
const changePasswordOk   = ref(false);

const password         = ref('');
const passwordConfirm  = ref('');
const loginError       = ref('');
const loadError        = ref('');
const saveSuccess      = ref(false);
const validationError  = ref('');
const passwordFieldRef = ref(null);
const loadedCrs             = ref(null);  // CRS from the last saved config
const crsChangeSaveConfirming = ref(false); // waiting for user to ack CRS change before saving

const SESSION_KEY = 'admin_auth';
const osmBackground = ref(true);  // separate from basemaps — MapWidget injects the right tile per CRS

// ── Draft config ───────────────────────────────────────────────
function blankDraft() {
  return {
    website: { title: 'Hist Map', favicon: '/vite.svg', search: { placeholder: 'Search...', defaultQuery: '' } },
    view: { center: [0, 0], zoom: 7, minZoom: 0, maxZoom: 28, extent: null },
    crs: 'EPSG:3857',
    projection_params: { proj_string: '', extent: null },
    basemaps:     [],
    data_layers:  [],
    ui: { map_download: true, map_upload: true, viewer_download: true, viewer_upload: true },
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

// CRS presets: view settings applied automatically when the user sets a matching EPSG code.
// The OSM background tile is handled separately (MapWidget picks the right URL per CRS).
const CRS_VIEW_PRESETS = {
  'EPSG:3031': { label: 'WGS 84 / Antarctic Polar Stereographic', center: [0, -75], zoom: 3, minZoom: 0, maxZoom: 14 },
  'EPSG:3575': { label: 'WGS 84 / North Pole LAEA Europe',        center: [0, 85],  zoom: 3, minZoom: 0, maxZoom: 14 },
  'EPSG:4326': { label: 'WGS 84 (geographic / flat)',             center: [0, 20],  zoom: 3, minZoom: 0, maxZoom: 19 },
};

const crsPreset = computed(() => {
  const code = (draft.value.crs || '').trim().toUpperCase();
  return CRS_VIEW_PRESETS[code] ?? null;
});

// Human-readable description of the OSM background tile source for the current CRS.
const osmBgLabel = computed(() => {
  const crs = (draft.value.crs || 'EPSG:3857').trim().toUpperCase();
  if (crs === 'EPSG:3031') return 'GBIF OSM Bright — Antarctic Polar (EPSG:3031)';
  if (crs === 'EPSG:3575') return 'GBIF OSM Bright — Arctic (EPSG:3575)';
  return 'OpenStreetMap (standard tiles)';
});

const yamlPanelText = computed(() => {
  try { return yaml.dump(buildConfig(), { lineWidth: 120, noRefs: true }); }
  catch { return '(error generating YAML)'; }
});

// Called when user commits a CRS value (on blur/enter). Auto-applies the matching
// view settings so the map is immediately usable.
function onCrsChange() {
  crsChangeSaveConfirming.value = false;
  const preset = crsPreset.value;
  if (!preset) return;
  draft.value.view.center  = [...preset.center];
  draft.value.view.zoom    = preset.zoom;
  draft.value.view.minZoom = preset.minZoom;
  draft.value.view.maxZoom = preset.maxZoom;
  viewExtentStr.value      = '';
  draft.value.view.extent  = null;
}

const crsWarning = computed(() => {
  const crs = (draft.value.crs || '').trim();
  if (!crs) return '';
  if (!/^EPSG:\d+$/i.test(crs))
    return 'CRS should be in the format EPSG:XXXX (e.g. EPSG:3857 for Web Mercator).';
  return '';
});

// True when overlay layers reference server-uploaded files that were preprocessed
// for a specific CRS, so changing the map CRS would misalign them.
const hasServerLayers = computed(() =>
  draft.value.data_layers.some(l => l.url?.startsWith(getApiUrl('data/')))
);
const crsChangedWithData = computed(() =>
  loadedCrs.value !== null &&
  draft.value.crs !== loadedCrs.value &&
  hasServerLayers.value
);

// ── Backup file list ───────────────────────────────────────────


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
  d.basemaps    = config.basemaps    ?? config.base_layers    ?? d.basemaps;
  // Auto-detect migration: if old config has tile layers in basemaps but no explicit
  // osm_background field, keep osmBackground off so the existing base tiles still render.
  osmBackground.value = config.osm_background ?? (config.basemaps?.length > 0 || config.base_layers?.length > 0 ? false : true);
  d.data_layers = config.data_layers ?? config.overlay_layers ?? d.data_layers;
  if (config.ui) {
    d.ui.map_download    = config.ui.map_download    ?? config.ui.allow_download ?? true;
    d.ui.map_upload      = config.ui.map_upload      ?? config.ui.allow_upload   ?? true;
    d.ui.viewer_download = config.ui.viewer_download ?? config.ui.allow_download ?? true;
    d.ui.viewer_upload   = config.ui.viewer_upload   ?? config.ui.allow_upload   ?? true;
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
  out.osm_background = osmBackground.value;
  out.basemaps    = d.basemaps;
  out.data_layers = d.data_layers;
  out.ui = {
    map_download:    d.ui.map_download,
    map_upload:      d.ui.map_upload,
    viewer_download: d.ui.viewer_download,
    viewer_upload:   d.ui.viewer_upload,
  };
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
async function verifyPassword(pwd) {
  const res = await fetch(getApiUrl('/admin/verify'), {
    headers: { Authorization: buildAuthHeader(pwd) },
  });
  if (res.status === 401 || res.status === 403) throw new Error('Invalid password');
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
}

async function fetchConfig(pwd) {
  const res = await fetch(getApiUrl('/config'), {
    headers: { Authorization: buildAuthHeader(pwd) },
  });
  if (res.status === 404) return null;  // No config yet — fresh install
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return yaml.load(await res.text());
}

// ── Create password (first run) ───────────────────────────────
async function createPassword() {
  loginError.value = '';
  if (password.value.length < 6) {
    loginError.value = 'Password must be at least 6 characters.';
    return;
  }
  if (password.value !== passwordConfirm.value) {
    loginError.value = 'Passwords do not match.';
    return;
  }
  isLoading.value = true;
  try {
    const res = await fetch(getApiUrl('/admin/set-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server error: ${res.status}`);
    }
    // Auto-login with the new password
    const pwd = password.value;
    password.value        = '';
    passwordConfirm.value = '';
    isFirstRun.value      = false;
    sessionStorage.setItem(SESSION_KEY, pwd);
    const config = await fetchConfig(pwd);
    loadConfigIntoDraft(config ?? {});
    loadedCrs.value         = config ? (config.crs ?? null) : null;
    hasExistingConfig.value = config !== null;
    isAuthenticated.value   = true;
  } catch (err) {
    loginError.value = err.message;
  } finally {
    isLoading.value = false;
  }
}

// ── Auth ───────────────────────────────────────────────────────
async function attemptLogin() {
  if (!password.value) return;
  isLoading.value  = true;
  loginError.value = '';
  try {
    await verifyPassword(password.value);
    const config = await fetchConfig(password.value);
    loadConfigIntoDraft(config ?? {});
    loadedCrs.value         = config ? (config.crs ?? null) : null;
    hasExistingConfig.value = config !== null;
    sessionStorage.setItem(SESSION_KEY, password.value);
    isAuthenticated.value   = true;
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
  osmBackground.value   = true;
  draft.value           = blankDraft();
  password.value        = '';
  passwordConfirm.value = '';
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
    crsChangeSaveConfirming.value = false;
    return;
  }
  // If server-hosted layers exist and the CRS changed, require an explicit acknowledgment
  if (crsChangedWithData.value && !crsChangeSaveConfirming.value) {
    crsChangeSaveConfirming.value = true;
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
    saveSuccess.value       = true;
    hasExistingConfig.value = true;
    loadedCrs.value = draft.value.crs;
    crsChangeSaveConfirming.value = false;
    setTimeout(() => { saveSuccess.value = false; }, 5000);
  } catch (err) {
    validationError.value = err.message;
  } finally {
    isSaving.value = false;
  }
}

// ── Backup ────────────────────────────────────────────────────
function backupConfig() {
  const config = buildConfig();
  const yamlText = yaml.dump(config, { lineWidth: 120, noRefs: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const a = document.createElement('a');
  a.href = 'data:text/yaml;charset=utf-8,' + encodeURIComponent(yamlText);
  a.download = `config-backup-${ts}.yaml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ── Reset ─────────────────────────────────────────────────────
async function resetConfig() {
  isResetting.value = true;
  try {
    const res = await fetch(getApiUrl('/config'), {
      method: 'DELETE',
      headers: { Authorization: buildAuthHeader(getStoredPassword()) },
    });
    if (res.status === 401 || res.status === 403) throw new Error('Session expired. Please sign out and sign back in.');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server error: ${res.status}`);
    }
    // Config deleted — clear session and go back to the admin login gate
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = '/admin';
  } catch (err) {
    validationError.value = err.message;
    resetConfirming.value = false;
  } finally {
    isResetting.value = false;
  }
}

// ── Change password ────────────────────────────────────────────
async function changePassword() {
  changePasswordError.value = '';
  changePasswordOk.value    = false;
  if (newPassword.value.length < 6) {
    changePasswordError.value = 'Password must be at least 6 characters.';
    return;
  }
  if (newPassword.value !== newPasswordConfirm.value) {
    changePasswordError.value = 'Passwords do not match.';
    return;
  }
  changingPassword.value = true;
  try {
    const res = await fetch(getApiUrl('/admin/change-password'), {
      method: 'POST',
      headers: { Authorization: buildAuthHeader(getStoredPassword()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPassword.value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server error: ${res.status}`);
    }
    // Update stored password so subsequent requests still work
    sessionStorage.setItem(SESSION_KEY, newPassword.value);
    newPassword.value        = '';
    newPasswordConfirm.value = '';
    changePasswordOk.value   = true;
    setTimeout(() => { changePasswordOk.value = false; }, 5000);
  } catch (err) {
    changePasswordError.value = err.message;
  } finally {
    changingPassword.value = false;
  }
}

// ── Delete all files ───────────────────────────────────────────
async function deleteAllFiles() {
  isDeletingFiles.value = true;
  try {
    // Fetch all layers then delete each one
    const listRes = await fetch(getApiUrl('/admin/layers'), {
      headers: { Authorization: buildAuthHeader(getStoredPassword()) },
    });
    if (!listRes.ok) throw new Error(`Server error: ${listRes.status}`);
    const allLayers = await listRes.json();
    await Promise.all(allLayers.map(l =>
      fetch(getApiUrl(`/admin/layers/${l.id}`), {
        method: 'DELETE',
        headers: { Authorization: buildAuthHeader(getStoredPassword()) },
      })
    ));
    deleteFilesConfirming.value = false;
  } catch (err) {
    validationError.value = err.message;
    deleteFilesConfirming.value = false;
  } finally {
    isDeletingFiles.value = false;
  }
}

// ── Warn before leaving during first-time setup ─────────────────
function handleBeforeUnload(e) {
  if (isAuthenticated.value && !hasExistingConfig.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload));

// ── Auto-restore session ───────────────────────────────────────
onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  // Always check whether a password exists — determines which gate form to show
  try {
    const res = await fetch(getApiUrl('/admin/setup-status'));
    if (res.ok) {
      const s = await res.json();
      isFirstRun.value = !s.hasPassword;
    }
  } catch { /* ignore, fall through to login form */ }

  if (isFirstRun.value) return;  // show create-password form, nothing to restore

  const stored = getStoredPassword();
  if (!stored) return;
  isLoading.value = true;
  try {
    await verifyPassword(stored);
    const config = await fetchConfig(stored);
    loadConfigIntoDraft(config ?? {});
    loadedCrs.value         = config ? (config.crs ?? null) : null;
    hasExistingConfig.value = config !== null;
    isAuthenticated.value   = true;
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
.toggle-label-text { flex: 1; }

.permissions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}
@media (max-width: 600px) {
  .permissions-grid { grid-template-columns: 1fr; }
}

/* ── Permission cards ──────────────────────────────────────── */
.perm-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 8px;
  background: var(--admin-bg, #f9fafb);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.perm-card:hover {
  border-color: #93c5fd;
  background: rgba(59,130,246,0.04);
}
.perm-card-on {
  border-color: rgba(59,130,246,0.45);
  background: rgba(59,130,246,0.06);
}
.perm-card-icon {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 7px;
  background: var(--admin-surface, #fff);
  border: 1px solid var(--admin-border, #e0e0e0);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--admin-muted, #777);
  transition: color 0.15s, border-color 0.15s;
}
.perm-card-on .perm-card-icon {
  color: #3b82f6;
  border-color: rgba(59,130,246,0.35);
  background: rgba(59,130,246,0.08);
}
.perm-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}
.perm-card-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--admin-text, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.perm-card-desc {
  font-size: 0.73rem;
  color: var(--admin-muted, #777);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.perm-toggle-wrap {
  flex-shrink: 0;
  position: relative;
  width: 36px;
  height: 20px;
}
.perm-toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.perm-slider {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: var(--admin-border, #ccc);
  cursor: pointer;
  transition: background 0.2s;
}
.perm-slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 0.2s;
}
.perm-toggle-input:checked + .perm-slider { background: #3b82f6; }
.perm-toggle-input:checked + .perm-slider::before { transform: translateX(16px); }
.perm-toggle-input:focus-visible + .perm-slider {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* ── Danger zone divider ───────────────────────────────────── */
.danger-divider {
  border: none;
  border-top: 1px solid rgba(239, 68, 68, 0.2);
  margin: 0.25rem 0;
}

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
.btn-save-warn { background: #d97706 !important; }
.btn-save-warn:hover:not(:disabled) { background: #b45309 !important; }
.save-confirm-row { display: flex; gap: 0.5rem; align-items: center; }

/* ── Backup section ────────────────────────────────────────── */
.backup-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.backup-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.88rem;
}
.backup-item-info span { color: #888; font-size: 0.82rem; }
.backup-files-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 0.7rem;
}
.backup-files-bar-label {
  font-size: 0.88rem;
  font-weight: 600;
  flex: 1;
}
.btn-icon-refresh {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 3px;
  border-radius: 4px;
  transition: color 0.15s;
}
.btn-icon-refresh:hover:not(:disabled) { color: #374151; }
.btn-icon-refresh:disabled { opacity: 0.4; cursor: default; }
.backup-msg { font-size: 0.85rem; color: #9ca3af; padding: 2px 0; }
.backup-msg--err { color: #ef4444; }
.backup-group { display: flex; flex-direction: column; gap: 3px; }
.backup-group-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9ca3af;
  padding: 6px 0 3px;
}
.backup-file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 4px 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
}
.backup-file-name {
  font-size: 0.82rem;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.btn-dl {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  background: transparent;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  font-family: "Segoe UI", sans-serif;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}
.btn-dl:hover:not(:disabled) { background: #f3f4f6; border-color: #9ca3af; }
.btn-dl:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-dl--all { align-self: flex-start; }
.btn-dl--file {
  padding: 3px 8px;
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.3);
}
.btn-dl--file:hover { background: rgba(59, 130, 246, 0.07); border-color: rgba(59, 130, 246, 0.5); }

/* ── Danger Zone ───────────────────────────────────────────── */
.danger-zone { border-color: rgba(239, 68, 68, 0.35) !important; }
.danger-title { color: #ef4444 !important; }
.danger-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}
.danger-row-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.88rem;
}
.danger-row-text strong { color: inherit; }
.danger-row-text span { color: #888; font-size: 0.82rem; }
.danger-row-action { flex-shrink: 0; display: flex; align-items: center; gap: 0.5rem; }
.danger-confirm { flex-wrap: wrap; }
.danger-confirm-label { font-size: 0.85rem; color: #ef4444; font-weight: 600; margin-right: 0.25rem; }
.btn-danger {
  padding: 0.5rem 1rem;
  background: transparent;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.5);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: "Segoe UI", sans-serif;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.btn-danger:hover:not(:disabled) { background: rgba(239, 68, 68, 0.08); border-color: #ef4444; }
.btn-danger:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-secondary {
  padding: 0.5rem 1rem;
  background: transparent;
  color: #555;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: "Segoe UI", sans-serif;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-secondary:hover { background: #f3f4f6; }

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
.banner-setup {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.35);
  color: #3b82f6;
}

/* ── Setup welcome banner (gate screen) ───────────────────── */
.setup-welcome-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #2563eb;
  border-radius: 8px;
  padding: 0.65rem 0.9rem;
  margin-bottom: 1.25rem;
  font-size: 0.85rem;
  line-height: 1.4;
  text-align: left;
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
.field-ok {
  margin: 0.25rem 0 0;
  padding: 0.3rem 0.5rem;
  font-size: 0.78rem;
  color: #15803d;
  background: rgba(21, 128, 61, 0.09);
  border: 1px solid rgba(21, 128, 61, 0.25);
  border-radius: 4px;
}

.yaml-collapsible { margin-top: 0; }
.yaml-collapsible-body { padding: 0; }
.yaml-inline-header {
  display: flex;
  justify-content: flex-end;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--admin-border, #e0e0e0);
}
.yaml-pre {
  margin: 0;
  padding: 1rem 1.2rem;
  font-size: 0.8rem;
  line-height: 1.55;
  font-family: 'Fira Code', 'Consolas', monospace;
  color: var(--admin-text, #374151);
  background: #f8f9fb;
  white-space: pre;
}
.yaml-pre-inline {
  max-height: 460px;
  overflow: auto;
  border-radius: 0 0 6px 6px;
}
</style>

