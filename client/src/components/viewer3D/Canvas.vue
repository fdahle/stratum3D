<template>
  <div ref="viewerRef" class="viewer-canvas"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useViewer3D } from '@/composables/viewer3D/useViewer3D';

const props = defineProps({
  modelUrls: {
    type: Array,
    default: () => []
  },
  pointcloudUrls: {
    type: Array,
    default: () => []
  },
  coordinates: {
    type: Object,
    required: true,
    validator: (value) => typeof value.x === 'number' && typeof value.y === 'number'
  },
  modelName: {
    type: String,
    default: 'Model'
  }
});

const emit = defineEmits(['scene-ready', 'model-loaded', 'loading-error']);

const viewerRef = ref(null);
const {
  scene,
  camera,
  renderer,
  controls,
  setScene,
  setCamera,
  setRenderer,
  setControls,
  addModel,
  storeInitialCamera,
  cleanup
} = useViewer3D();

let animationFrameId = null;

const initViewer = () => {
  if (!viewerRef.value) return;

  // Scene
  const newScene = new THREE.Scene();
  newScene.background = new THREE.Color(0x87ceeb);
  setScene(newScene);

  // Camera
  const newCamera = new THREE.PerspectiveCamera(
    75,
    viewerRef.value.clientWidth / viewerRef.value.clientHeight,
    0.1,
    1000000
  );
  newCamera.position.set(100, 100, 100);
  newCamera.lookAt(0, 0, 0);
  setCamera(newCamera);

  // Renderer
  const newRenderer = new THREE.WebGLRenderer({ antialias: true });
  newRenderer.setSize(viewerRef.value.clientWidth, viewerRef.value.clientHeight);
  newRenderer.setPixelRatio(window.devicePixelRatio);
  viewerRef.value.appendChild(newRenderer.domElement);
  setRenderer(newRenderer);

  // Controls
  const newControls = new OrbitControls(newCamera, newRenderer.domElement);
  newControls.enableDamping = true;
  newControls.dampingFactor = 0.05;
  setControls(newControls);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  newScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(100, 100, 50);
  newScene.add(directionalLight);

  // Grid and axes
  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x444444);
  gridHelper.name = 'gridHelper';
  newScene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(50);
  axesHelper.name = 'axesHelper';
  newScene.add(axesHelper);

  // Animation loop
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    newControls.update();
    newRenderer.render(newScene, newCamera);
  };
  animate();

  // Handle resize
  window.addEventListener('resize', handleResize);

  emit('scene-ready');
};

const handleResize = () => {
  if (!viewerRef.value || !camera.value || !renderer.value) return;
  
  camera.value.aspect = viewerRef.value.clientWidth / viewerRef.value.clientHeight;
  camera.value.updateProjectionMatrix();
  renderer.value.setSize(viewerRef.value.clientWidth, viewerRef.value.clientHeight);
};

const loadModelFromUrl = async (url, modelIndex = 0) => {
  try {
    const fullUrl = url.startsWith('http') ? url : `http://localhost:3000/${url}`;
    console.log(`Loading model ${modelIndex + 1}/${props.modelUrls.length}:`, fullUrl);
    
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    loadObjFromText(text, modelIndex);
    
    emit('model-loaded', { url, index: modelIndex });
  } catch (error) {
    console.error('Error loading model from URL:', error);
    emit('loading-error', { url, error: error.message });
  }
};

const loadObjFromText = (text, modelIndex = 0) => {
  if (!scene.value || !camera.value || !controls.value) return;

  try {
    const loader = new OBJLoader();
    const object = loader.parse(text);

    // Get bounding box
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    console.log(`Original model size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
    console.log(`Original center: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`);

    // Center the model at its local origin
    object.position.set(-center.x, -center.y, -center.z);
    
    // Position at real-world coordinates
    if (modelIndex === 0) {
      object.position.x += props.coordinates.x;
      object.position.y += props.coordinates.y;
    } else {
      // Offset additional models side by side
      object.position.x += props.coordinates.x + (modelIndex * (size.x + 1000));
      object.position.y += props.coordinates.y;
    }

    // Add materials
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhongMaterial({
          color: 0x888888,
          side: THREE.DoubleSide
        });
      }
    });

    scene.value.add(object);
    addModel(object);
    
    // Auto-adjust camera for first model
    if (modelIndex === 0) {
      adjustCameraToModel(object, size, center);
    }
    
    console.log(`OBJ ${modelIndex + 1} loaded successfully`);
  } catch (error) {
    console.error('Error parsing OBJ:', error);
    emit('loading-error', { error: error.message });
  }
};

const adjustCameraToModel = (object, size, center) => {
  if (!scene.value || !camera.value || !controls.value) return;

  const modelBox = new THREE.Box3().setFromObject(object);
  const modelSize = modelBox.getSize(new THREE.Vector3());
  const modelCenter = modelBox.getCenter(new THREE.Vector3());
  const maxModelDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
  
  // Reposition and scale grid
  const grid = scene.value.getObjectByName('gridHelper');
  if (grid) {
    const gridSize = maxModelDim * 2;
    grid.scale.setScalar(gridSize / 200);
    grid.position.set(modelCenter.x, modelCenter.y - modelSize.y / 2, modelCenter.z);
  }
  
  // Reposition and scale axes
  const axes = scene.value.getObjectByName('axesHelper');
  if (axes) {
    axes.scale.setScalar(maxModelDim / 50);
    axes.position.copy(modelCenter);
  }
  
  // Add bounding box helper
  const existingBox = scene.value.getObjectByName('boxHelper');
  if (existingBox) {
    scene.value.remove(existingBox);
  }
  const boxHelper = new THREE.BoxHelper(object, 0x00ff00);
  boxHelper.name = 'boxHelper';
  scene.value.add(boxHelper);
  
  // Position camera
  const distance = maxModelDim * 2;
  camera.value.position.set(
    modelCenter.x + distance, 
    modelCenter.y + distance, 
    modelCenter.z + distance
  );
  camera.value.lookAt(modelCenter);
  controls.value.target.copy(modelCenter);
  controls.value.update();
  
  // Store initial camera position
  storeInitialCamera();
  
  console.log(`Camera adjusted - distance: ${distance.toFixed(2)}`);
};

const loadUserObjFile = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const modelIndex = props.modelUrls.length; // Use current count as index
    loadObjFromText(e.target.result, modelIndex);
  };
  reader.readAsText(file);
};

// Watch for model URL changes
watch(() => props.modelUrls, (newUrls) => {
  if (newUrls && newUrls.length > 0) {
    newUrls.forEach((url, index) => {
      loadModelFromUrl(url, index);
    });
  }
}, { immediate: false });

onMounted(() => {
  if (viewerRef.value) {
    initViewer();
    
    // Auto-load models after scene is ready
    if (props.modelUrls.length > 0) {
      props.modelUrls.forEach((url, index) => {
        loadModelFromUrl(url, index);
      });
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  cleanup();
});

// Expose methods for parent component
defineExpose({
  loadUserObjFile,
  loadModelFromUrl
});
</script>

<style scoped>
.viewer-canvas {
  width: 100%;
  height: 100%;
}
</style>