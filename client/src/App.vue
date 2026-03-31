<template>
  <div id="app" :class="'theme-' + theme">
    <!-- Config loaded normally, or admin route (works without config) -->
    <div v-if="isConfigLoaded || isAdminRoute">
      <router-view />
    </div>

    <!-- No config found — first-run setup screen -->
    <div v-else-if="needsSetup" class="error-screen">
      <div class="setup-modal">
        <div class="setup-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </div>
        <h2 class="setup-title">Welcome to Hist Map</h2>

        <!-- Step 1: set admin password -->
        <template v-if="!setupHasPassword">
          <p class="setup-desc">No admin password is set. Create one to protect the admin panel, then configure your map.</p>
          <form class="setup-pwd-form" @submit.prevent="submitSetupPassword">
            <div class="setup-pwd-group" :class="{ 'setup-pwd-error': setupPwdError }">
              <label for="setup-pwd">Admin Password</label>
              <input
                id="setup-pwd"
                v-model="setupPassword"
                type="password"
                placeholder="Choose a password (min. 6 characters)"
                autocomplete="new-password"
                :disabled="setupPwdLoading"
              />
              <p v-if="setupPwdError" class="setup-pwd-err-msg">{{ setupPwdError }}</p>
            </div>
            <button type="submit" class="setup-btn" :disabled="setupPwdLoading || setupPassword.length < 6">
              <span v-if="setupPwdLoading">Saving…</span>
              <span v-else>Set Password &amp; Continue →</span>
            </button>
          </form>
        </template>

        <!-- Step 2: open the wizard -->
        <template v-else>
          <p class="setup-desc">Password is set. Use the admin panel to configure your map for the first time.</p>
          <a class="setup-btn" href="/admin?setup=true">Open Setup Wizard →</a>
        </template>
      </div>
    </div>

    <!-- Other load errors -->
    <div v-else-if="configError" class="error-screen">
      <div class="error-modal">
        <div class="error-icon">{{ STRINGS.errors.warning || '⚠️' }}</div>
        <h2>{{ STRINGS.config.error }}</h2>
        <div class="error-details">{{ configError }}</div>
        <button class="retry-btn" @click="reloadApp">{{ STRINGS.config.reloadApp }}</button>
      </div>
    </div>

    <div v-else class="loading">{{ STRINGS.config.loading }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, provide, watch, computed } from "vue";
import { storeToRefs } from "pinia";
import yaml from "js-yaml";
import { useRoute } from "vue-router";
import { validateConfig } from "./constants/configValidation";
import { STRINGS } from "./constants/strings";
import { useSettingsStore } from "./stores/settingsStore";
import { logger } from "./utils/logger";
import { enableDevMode } from "./utils/devTools";
import { getApiUrl } from "./utils/config";

const appConfig = ref(null);
const isConfigLoaded = ref(false);
const configError = ref(null);
const needsSetup = ref(false);
const setupHasPassword = ref(false);
const setupPassword = ref('');
const setupPwdLoading = ref(false);
const setupPwdError = ref('');

// Allow the admin route to render even when config isn't loaded yet
const isAdminRoute = computed(() => route.path.startsWith('/admin'));

// Theme management
const settingsStore = useSettingsStore();
const { theme } = storeToRefs(settingsStore);

// Apply theme to document body
watch(theme, (newTheme) => {
  document.body.className = `theme-${newTheme}`;
}, { immediate: true });

// --- 1. RESTORE THIS MISSING PART ---
const layerManagerRef = ref(null);
provide("layerManager", layerManagerRef);
// ------------------------------------

provide("config", appConfig);

const route = useRoute();

// Build page title from config base + current route
function applyRouteTitle(baseTitle) {
  const routePageTitle = route.meta?.title
    ? (route.query?.n || route.meta.title)
    : null;
  document.title = routePageTitle ? `${baseTitle} — ${routePageTitle}` : baseTitle;
}

onMounted(async () => {
  // Enable development tools in dev mode
  if (import.meta.env.DEV) {
    enableDevMode();
  }
  
  try {
    const res = await fetch(getApiUrl('/config'));
    if (res.status === 404) {
      // No config yet — check if we also need a password
      const statusRes = await fetch(getApiUrl('/admin/setup-status')).catch(() => null);
      const status = statusRes?.ok ? await statusRes.json() : {};
      setupHasPassword.value = status.hasPassword ?? false;
      needsSetup.value = true;
      return;
    }
    if (!res.ok) throw new Error(`Config not found: ${res.status}`);
    const txt = await res.text();
    const parsed = yaml.load(txt);

    // Validate configuration
    validateConfig(parsed);

    appConfig.value = parsed;
    isConfigLoaded.value = true;
    
    // Apply website settings (title and favicon) if provided
    try {
      const site = parsed.website || {};
      if (site.title) {
        applyRouteTitle(site.title);
      }

      if (site.favicon) {
        // Update existing <link rel="icon"> or create one
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = site.favicon;
      }
    } catch (e) {
      logger.warn('App', 'Failed to apply website settings:', e);
    }
  } catch (e) {
    logger.error('App', 'Failed to load config:', e);
    configError.value = e.message;
  }
});

const reloadApp = () => window.location.reload();

async function submitSetupPassword() {
  setupPwdError.value = '';
  setupPwdLoading.value = true;
  try {
    const res = await fetch(getApiUrl('/admin/set-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: setupPassword.value }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
    setupHasPassword.value = true;
    setupPassword.value = '';
  } catch (e) {
    setupPwdError.value = e.message;
  } finally {
    setupPwdLoading.value = false;
  }
}
</script>

<style>
@import './assets/error-screen.css';

/* Global Styles */
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Dark theme (default) */
body.theme-dark {
  background: #1a1a1a;
  color: #e0e0e0;
}

/* Light theme */
body.theme-light {
  background: #ffffff;
  color: #1a1a1a;
}

#app {
  height: 100%;
  width: 100%;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #666;
}

.theme-light .loading {
  color: #999;
}

/* First-run setup modal */
.setup-modal {
  background: white;
  padding: 2.5rem 2rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  max-width: 440px;
  width: 90%;
  text-align: center;
}

.theme-dark .setup-modal {
  background: #2d2d2d;
  color: #e0e0e0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.setup-icon {
  display: flex;
  justify-content: center;
  color: #3b82f6;
  margin-bottom: 1rem;
}

.setup-title {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0 0 0.6rem;
  color: inherit;
}

.setup-desc {
  font-size: 0.92rem;
  color: #666;
  line-height: 1.55;
  margin: 0 0 1.8rem;
}

.theme-dark .setup-desc {
  color: #aaa;
}

.setup-btn {
  display: inline-block;
  background: #3b82f6;
  color: white;
  text-decoration: none;
  padding: 0.75rem 1.75rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.95rem;
  transition: background 0.2s;
}

.setup-btn:hover {
  background: #2563eb;
}

.setup-pwd-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.setup-pwd-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-align: left;
}

.setup-pwd-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
}

.theme-dark .setup-pwd-group label {
  color: #bbb;
}

.setup-pwd-group input {
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: "Segoe UI", sans-serif;
  outline: none;
  transition: border-color 0.15s;
  background: #fff;
  color: #111;
}

.theme-dark .setup-pwd-group input {
  background: #3a3a3a;
  border-color: #555;
  color: #e0e0e0;
}

.setup-pwd-group input:focus {
  border-color: #3b82f6;
}

.setup-pwd-error input {
  border-color: #ef4444;
}

.setup-pwd-err-msg {
  font-size: 0.8rem;
  color: #ef4444;
  margin: 0;
}
</style>