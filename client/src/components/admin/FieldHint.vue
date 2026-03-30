<template>
  <span class="fh" tabindex="0" :aria-label="text">?<span class="fh-tip" role="tooltip">{{ text }}</span></span>
</template>

<script setup>
defineProps({ text: { type: String, required: true } });
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
  vertical-align: -0.15em;
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
  position: absolute;
  bottom: calc(100% + 7px);
  left: 50%;
  transform: translateX(-50%);
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
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #1e293b;
}
</style>
