<template>
  <span ref="triggerRef" class="fh" tabindex="0" :aria-label="text" @mouseenter="showTip" @focus="showTip" @mouseleave="hideTip" @blur="hideTip">?<span ref="tipRef" class="fh-tip" role="tooltip">{{ text }}</span></span>
</template>

<script setup>
import { ref } from 'vue';
defineProps({ text: { type: String, required: true } });

const triggerRef = ref(null);
const tipRef = ref(null);

function showTip() {
  const trigger = triggerRef.value;
  const tip = tipRef.value;
  if (!trigger || !tip) return;

  const tr = trigger.getBoundingClientRect();
  const vpw = window.innerWidth;
  const margin = 10;
  const tipMaxWidth = 240;

  // Position above trigger center
  let left = tr.left + tr.width / 2;
  const top = tr.top - 8; // will use transform translateY(-100%)

  // Clamp so tooltip stays within viewport
  const halfWidth = Math.min(tipMaxWidth, vpw - 2 * margin) / 2;
  left = Math.max(margin + halfWidth, Math.min(left, vpw - margin - halfWidth));

  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
  tip.style.transform = 'translateY(-100%)';
}

function hideTip() {
  // No action needed — CSS transition handles visibility
}
</script>

<style scoped>
.fh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--admin-border, #ddd);
  color: var(--admin-muted, #666);
  font-size: 9px;
  font-weight: 700;
  cursor: default;
  position: relative;
  margin-left: 4px;
  vertical-align: middle;
  line-height: 1;
  user-select: none;
  flex-shrink: 0;
}

.fh:hover .fh-tip,
.fh:focus .fh-tip {
  opacity: 1;
  visibility: visible;
}

.fh-tip {
  opacity: 0;
  visibility: hidden;
  position: fixed;
  background: #1e293b;
  color: #f1f5f9;
  font-size: 0.72rem;
  font-weight: 400;
  line-height: 1.45;
  padding: 0.4rem 0.65rem;
  border-radius: 5px;
  white-space: normal;
  width: max-content;
  max-width: 240px;
  z-index: 9999;
  pointer-events: none;
  transition: opacity 0.12s;
  font-family: "Segoe UI", sans-serif;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.3);
  text-align: left;
}

.fh-tip::after {
  display: none;
}
</style>
