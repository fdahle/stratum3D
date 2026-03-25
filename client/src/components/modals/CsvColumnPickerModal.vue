<template>
  <Teleport to="body">
    <div v-if="isOpen" class="csv-overlay" @click.self="$emit('cancel')">
      <div class="csv-modal">
        <div class="csv-modal-header">
          <h3>Configure CSV Layer</h3>
          <button class="csv-close-btn" @click="$emit('cancel')">✕</button>
        </div>

        <div class="csv-modal-body">
          <p class="csv-filename">{{ fileName }}</p>

          <div class="csv-field-row">
            <label>X / Longitude column</label>
            <select v-model="xCol">
              <option value="">— select —</option>
              <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
            </select>
          </div>

          <div class="csv-field-row">
            <label>Y / Latitude column</label>
            <select v-model="yCol">
              <option value="">— select —</option>
              <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
            </select>
          </div>

          <div class="csv-field-row">
            <label>Coordinate system</label>
            <select v-model="crs">
              <option value="EPSG:4326">EPSG:4326 — WGS 84 (lon/lat)</option>
              <option value="EPSG:3857">EPSG:3857 — Web Mercator</option>
              <option value="custom">Custom…</option>
            </select>
          </div>

          <div v-if="crs === 'custom'" class="csv-field-row">
            <label>Custom CRS</label>
            <input
              v-model="customCrs"
              type="text"
              class="csv-crs-input"
              placeholder="e.g. EPSG:32632"
            />
          </div>

          <div class="csv-preview-label">
            Preview (first {{ sampleRows.length }} row{{ sampleRows.length !== 1 ? 's' : '' }})
          </div>
          <div class="csv-preview-wrap">
            <table class="csv-preview-table">
              <thead>
                <tr>
                  <th
                    v-for="col in columns"
                    :key="col"
                    :class="{ 'col-active': col === xCol || col === yCol }"
                  >{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in sampleRows" :key="i">
                  <td
                    v-for="col in columns"
                    :key="col"
                    :class="{ 'col-active': col === xCol || col === yCol }"
                  >{{ row[col] ?? '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="csv-modal-footer">
          <span v-if="validationMsg" class="csv-validation-msg">{{ validationMsg }}</span>
          <div class="csv-footer-btns">
            <button class="csv-btn csv-btn-cancel" @click="$emit('cancel')">Cancel</button>
            <button
              class="csv-btn csv-btn-confirm"
              :disabled="!isValid"
              @click="onConfirm"
            >Add Layer</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  isOpen: Boolean,
  fileName: { type: String, default: '' },
  columns: { type: Array, default: () => [] },
  sampleRows: { type: Array, default: () => [] },
  preselectedX: { type: String, default: '' },
  preselectedY: { type: String, default: '' },
});

const emit = defineEmits(['confirm', 'cancel']);

const xCol = ref('');
const yCol = ref('');
const crs = ref('EPSG:4326');
const customCrs = ref('');

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      xCol.value = props.preselectedX || '';
      yCol.value = props.preselectedY || '';
      crs.value = 'EPSG:4326';
      customCrs.value = '';
    }
  },
  { immediate: true },
);

const effectiveCrs = computed(() => {
  if (crs.value === 'custom') return customCrs.value.trim() || 'EPSG:4326';
  return crs.value;
});

const isValid = computed(
  () =>
    !!xCol.value &&
    !!yCol.value &&
    xCol.value !== yCol.value &&
    (crs.value !== 'custom' || !!customCrs.value.trim()),
);

const validationMsg = computed(() => {
  if (xCol.value && yCol.value && xCol.value === yCol.value)
    return 'X and Y columns must be different.';
  return '';
});

const onConfirm = () => {
  if (!isValid.value) return;
  emit('confirm', { xCol: xCol.value, yCol: yCol.value, crs: effectiveCrs.value });
};
</script>

<style scoped>
.csv-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.csv-modal {
  background: #1e2228;
  border: 1px solid #3a3f4a;
  border-radius: 8px;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  color: #d4d8e0;
  font-size: 13px;
}

.csv-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #3a3f4a;
  flex-shrink: 0;
}

.csv-modal-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #e8eaf0;
}

.csv-close-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
}

.csv-close-btn:hover {
  background: #2e333d;
  color: #d4d8e0;
}

.csv-modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.csv-filename {
  margin: 0;
  font-size: 12px;
  color: #7a8090;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csv-field-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.csv-field-row label {
  flex: 0 0 180px;
  font-size: 12px;
  color: #a0a8b8;
}

.csv-field-row select,
.csv-crs-input {
  flex: 1;
  background: #252b34;
  border: 1px solid #3a3f4a;
  border-radius: 4px;
  color: #d4d8e0;
  padding: 5px 8px;
  font-size: 12px;
  outline: none;
}

.csv-field-row select:focus,
.csv-crs-input:focus {
  border-color: #5b8af0;
}

.csv-preview-label {
  font-size: 11px;
  color: #7a8090;
  margin-top: 4px;
}

.csv-preview-wrap {
  overflow-x: auto;
  border: 1px solid #2e333d;
  border-radius: 4px;
  max-height: 160px;
  overflow-y: auto;
}

.csv-preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  white-space: nowrap;
}

.csv-preview-table th {
  background: #252b34;
  color: #a0a8b8;
  padding: 4px 8px;
  border-bottom: 1px solid #3a3f4a;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.csv-preview-table td {
  padding: 3px 8px;
  border-bottom: 1px solid #2a2f38;
  color: #c4c8d4;
}

.csv-preview-table tr:last-child td {
  border-bottom: none;
}

.csv-preview-table .col-active {
  background: rgba(91, 138, 240, 0.12);
  color: #8ab4f8;
}

.csv-preview-table th.col-active {
  background: rgba(91, 138, 240, 0.2);
  color: #8ab4f8;
}

.csv-modal-footer {
  padding: 10px 16px;
  border-top: 1px solid #3a3f4a;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.csv-validation-msg {
  flex: 1;
  font-size: 11px;
  color: #f0a050;
}

.csv-footer-btns {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.csv-btn {
  padding: 6px 14px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
}

.csv-btn-cancel {
  background: #2e333d;
  border-color: #3a3f4a;
  color: #a0a8b8;
}

.csv-btn-cancel:hover {
  background: #363c48;
  color: #d4d8e0;
}

.csv-btn-confirm {
  background: #2f5bbf;
  color: #fff;
  border-color: #3a6ad4;
}

.csv-btn-confirm:hover:not(:disabled) {
  background: #3a6ad4;
}

.csv-btn-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Light mode ─────────────────────────────────────────────────────── */
.theme-light .csv-overlay {
  background: rgba(0, 0, 0, 0.4);
}

.theme-light .csv-modal {
  background: #ffffff;
  border-color: #d0d5dd;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  color: #1a1a2e;
}

.theme-light .csv-modal-header {
  border-bottom-color: #e5e7eb;
}

.theme-light .csv-modal-header h3 {
  color: #111827;
}

.theme-light .csv-close-btn {
  color: #6b7280;
}

.theme-light .csv-close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.theme-light .csv-filename {
  color: #6b7280;
}

.theme-light .csv-field-row label {
  color: #374151;
}

.theme-light .csv-field-row select,
.theme-light .csv-crs-input {
  background: #f9fafb;
  border-color: #d1d5db;
  color: #111827;
}

.theme-light .csv-field-row select:focus,
.theme-light .csv-crs-input:focus {
  border-color: #3b82f6;
}

.theme-light .csv-preview-label {
  color: #6b7280;
}

.theme-light .csv-preview-wrap {
  border-color: #e5e7eb;
}

.theme-light .csv-preview-table th {
  background: #f3f4f6;
  color: #374151;
  border-bottom-color: #e5e7eb;
}

.theme-light .csv-preview-table td {
  border-bottom-color: #f3f4f6;
  color: #374151;
}

.theme-light .csv-preview-table .col-active {
  background: rgba(59, 130, 246, 0.08);
  color: #2563eb;
}

.theme-light .csv-preview-table th.col-active {
  background: rgba(59, 130, 246, 0.14);
  color: #1d4ed8;
}

.theme-light .csv-modal-footer {
  border-top-color: #e5e7eb;
}

.theme-light .csv-validation-msg {
  color: #d97706;
}

.theme-light .csv-btn-cancel {
  background: #f3f4f6;
  border-color: #d1d5db;
  color: #374151;
}

.theme-light .csv-btn-cancel:hover {
  background: #e5e7eb;
  color: #111827;
}

.theme-light .csv-btn-confirm {
  background: #2563eb;
  border-color: #1d4ed8;
}

.theme-light .csv-btn-confirm:hover:not(:disabled) {
  background: #1d4ed8;
}
</style>
