<template>
  <div v-if="visible">
    <div class="overlay" @click="close"></div>

    <div
      class="context-menu"
      :style="{ top: `${y}px`, left: `${x}px` }"
      @click.stop
    >
      <ul>
        <li @click="handleCopyCoordinates">📋 Copy Coordinates</li>
        <li @click="handleOpen3DView">🌐 3D View</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const visible = ref(false);
const x = ref(0);
const y = ref(0);
const coordinate = ref(null);

const emit = defineEmits(["action"]);

const open = (event, coord) => {
  const mouseEvent = event.originalEvent || event;

  x.value = mouseEvent.clientX;
  y.value = mouseEvent.clientY;
  coordinate.value = coord;
  visible.value = true;
};

const close = () => {
  visible.value = false;
};

const handleCopyCoordinates = async () => {
  if (!coordinate.value) return;
  
  const [coordX, coordY] = coordinate.value;
  const coordText = `${coordX.toFixed(2)}, ${coordY.toFixed(2)}`;
  
  try {
    await navigator.clipboard.writeText(coordText);
    console.log("Coordinates copied:", coordText);
  } catch (err) {
    console.error("Failed to copy coordinates:", err);
  }
  
  close();
};

const handleOpen3DView = () => {
  if (!coordinate.value) return;
  
  const [coordX, coordY] = coordinate.value;
  // Open 3D viewer in new window with coordinates as query params
  const url = `/viewer3d.html?x=${coordX}&y=${coordY}`;
  window.open(url, '_blank', 'width=1200,height=800');
  
  close();
};

defineExpose({ open, close });
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  background: white;
  border: 1px solid #ccc;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  min-width: 160px;
  font-family: "Segoe UI", sans-serif;
  font-size: 13px;
  color: #333;
}

/* This overlay now catches the clicks */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9998; /* Ensures it sits just behind the menu (9999) */
  cursor: default;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
}

li:hover {
  background: #f0f0f0;
}
</style>