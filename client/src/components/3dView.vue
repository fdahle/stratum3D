<template>
  <div class="map-3d-container">
    <div id="giro3d-view" ref="viewerDiv"></div>

    <button class="close-btn" @click="$emit('close')">Exit 3D</button>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { Instance } from "@giro3d/giro3d/core/Instance.js";
import { ColorLayer } from "@giro3d/giro3d/core/layer/ColorLayer.js";
import { ElevationLayer } from "@giro3d/giro3d/core/layer/ElevationLayer.js";
import { Map as GiroMap } from "@giro3d/giro3d/entities/Map.js";
import { Inspector } from "@giro3d/giro3d/gui/Inspector.js";
import { TiledImageSource } from "@giro3d/giro3d/sources/TiledImageSource.js";
import { Extent } from "@giro3d/giro3d/core/geographic/Extent.js";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";

// Emits to let parent know we want to close
defineEmits(['close']);

const viewerDiv = ref(null);
let instance = null;

onMounted(() => {
  if (!viewerDiv.value) return;

  // 1. Initialize Instance
  // Define the CRS you want to use (e.g., EPSG:3857 for Web Mercator)
  const crs = "EPSG:3857"; 
  instance = new Instance(viewerDiv.value, { crs, renderer: { alpha: true } });

  // 2. Add Controls (Standard 3D map controls)
  const controls = new MapControls(instance.view.camera, instance.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.2;
  instance.view.setControls(controls);

  // 4. Move Camera to a default position
  instance.view.camera.position.set(0, 0, 10000000); // High up
  controls.target.set(0, 0, 0);
  controls.update();

  // DEBUG: Add Inspector to help you debug layers
  // Inspector.attach(document.body, instance);
});

onUnmounted(() => {
  // Cleanup WebGL context
  if (instance) {
    instance.dispose();
    instance = null;
  }
});

const loadModel = (url) => {
  const loader = new GLTFLoader();
  loader.load(url, (gltf) => {
    const model = gltf.scene;
    
    // Scale or Position if necessary
    model.scale.set(10, 10, 10); 
    
    // Add directly to the Three.js scene exposed by Giro3D
    instance.scene.add(model);
    instance.notifyChange(); // Tell Giro3D to re-render
  });
};
</script>

<style scoped>
.map-3d-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background: #000;
  z-index: 1000; /* Sit on top of 2D map */
}
#giro3d-view {
  width: 100%;
  height: 100%;
}
.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1100;
  padding: 10px 20px;
  background: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
</style>