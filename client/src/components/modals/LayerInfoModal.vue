<template>
  <teleport to="body">
    <div v-if="isVisible" class="lim-backdrop" @click.self="close">
      <div class="lim-modal">
        <div class="lim-header">
          <span class="lim-icon" v-html="ICON_INFO"></span>
          <h3 class="lim-title">{{ title }}</h3>
          <button class="lim-close" @click="close" title="Close">
            <span v-html="ICON_CLOSE"></span>
          </button>
        </div>

        <div class="lim-body">
          <table class="lim-table">
            <tbody>
              <template v-for="(row, i) in rows" :key="row.key">
                <!-- Visual separator before URL row -->
                <tr v-if="row.key === 'URL' && i > 0" class="lim-separator-row">
                  <td colspan="2"><hr class="lim-separator" /></td>
                </tr>
                <tr>
                  <td class="lim-key">{{ row.key }}</td>
                  <td class="lim-value">
                    <a v-if="row.key === 'URL'" :href="row.value" target="_blank" rel="noopener noreferrer" class="lim-url">{{ row.value }}</a>
                    <span v-else>{{ row.value }}</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { watch, onUnmounted } from 'vue';
import { ICON_INFO, ICON_CLOSE } from '@/constants/icons.js';

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  title:     { type: String, default: 'Layer Info' },
  rows:      { type: Array, default: () => [] },
});

const emit = defineEmits(['close']);
const close = () => emit('close');

const handleEsc = (e) => { if (e.key === 'Escape') close(); };

watch(() => props.isVisible, (val) => {
  if (val) document.addEventListener('keydown', handleEsc);
  else document.removeEventListener('keydown', handleEsc);
});

onUnmounted(() => document.removeEventListener('keydown', handleEsc));
</script>

<style scoped>
.lim-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lim-modal {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  min-width: 320px;
  max-width: 480px;
  width: 90%;
  font-family: "Segoe UI", sans-serif;
  overflow: hidden;
}

.theme-dark .lim-modal {
  background: #2a2a2a;
  color: #e0e0e0;
}

.lim-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: #343a40;
  color: #fff;
}

.lim-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.lim-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  flex: 1;
  color: #fff;
}

.lim-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: background 0.15s;
}
.lim-close:hover { background: rgba(255,255,255,0.15); color: #fff; }

.lim-body {
  padding: 12px 0;
  max-height: 60vh;
  overflow-y: auto;
}

.lim-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.lim-table tr:nth-child(even) {
  background: #f5f5f5;
}

.theme-dark .lim-table tr:nth-child(even) {
  background: #333;
}

.lim-key {
  padding: 8px 16px;
  font-weight: 600;
  color: #555;
  white-space: nowrap;
  width: 40%;
}

.theme-dark .lim-key {
  color: #aaa;
}

.lim-value {
  padding: 8px 16px;
  color: #222;
  word-break: break-all;
}

.theme-dark .lim-value {
  color: #e0e0e0;
}

.lim-url {
  color: #3b82f6;
  text-decoration: none;
  word-break: break-all;
}
.lim-url:hover { text-decoration: underline; }
.theme-dark .lim-url { color: #60a5fa; }

.lim-separator-row td { padding: 0 16px; }
.lim-separator { border: none; border-top: 1px solid #e5e7eb; margin: 4px 0; }
.theme-dark .lim-separator { border-top-color: #444; }
</style>
