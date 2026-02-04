<template>
  <div class="viewer-container">
    <div id="viewer" ref="viewerRef"></div>
    
    <div class="controls">
      <h3>🌐 3D Viewer</h3>
      <div class="info">
        <strong>Position:</strong> <span>{{ coordinates }}</span>
      </div>
      
      <div class="file-section">
        <label>Load 3D Model (.obj):</label>
        <input type="file" accept=".obj" @change="handleObjFile" />
      </div>

      <div class="file-section">
        <label>Load Point Cloud (.copc.laz):</label>
        <input type="file" accept=".laz,.las" @change="handleCopcFile" />
        <small>Requires Giro3D</small>
      </div>

      <button @click="resetCamera">Reset Camera</button>
      <button @click="$router.push('/')">← Back to Map</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const route = useRoute();
const viewerRef = ref(null);

const x = parseFloat(route.query.x) || 0;
const y = parseFloat(route.query.y) || 0;

// Parse comma-separated lists of models and pointclouds
const modelUrls = route.query.models ? route.query.models.split(',').filter(u => u) : [];
const pointcloudUrls = route.query.pointclouds ? route.query.pointclouds.split(',').filter(u => u) : [];
const modelName = route.query.name || 'Model';
const coordinates = ref(`${x.toFixed(2)}, ${y.toFixed(2)}`);

let scene, camera, renderer, controls;
let loadedModels = [];

const initViewer = () => {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    viewerRef.value.clientWidth / viewerRef.value.clientHeight,
    0.1,
    10000
  );
  camera.position.set(100, 100, 100);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(viewerRef.value.clientWidth, viewerRef.value.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  viewerRef.value.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(100, 100, 50);
  scene.add(directionalLight);

  // Grid and axes
  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x444444);
  scene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(50);
  scene.add(axesHelper);

  // Animation loop
  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  // Handle resize
  window.addEventListener('resize', handleResize);
};

const handleResize = () => {
  if (!viewerRef.value) return;
  camera.aspect = viewerRef.value.clientWidth / viewerRef.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewerRef.value.clientWidth, viewerRef.value.clientHeight);
};

const resetCamera = () => {
  camera.position.set(100, 100, 100);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
};

const loadModelFromUrl = async (url, modelIndex = 0) => {
  try {
    const response = await fetch(url);
    const text = await response.text();
    loadObjFromText(text, modelIndex);
  } catch (error) {
    console.error('Error loading model from URL:', error);
    alert('Error loading model: ' + error.message);
  }
};

const loadObjFromText = (text, modelIndex = 0) => {
  try {
    const loader = new OBJLoader();
    const object = loader.parse(text);

    // Center and scale
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 100 / maxDim;

    object.position.sub(center);
    object.scale.setScalar(scale);
    
    // Offset multiple models side by side
    if (modelIndex > 0) {
      object.position.x += modelIndex * 120;
    }

    // Add materials
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshPhongMaterial({
          color: 0x888888,
          side: THREE.DoubleSide
        });
      }
    });

    scene.add(object);
    loadedModels.push(object);
    console.log(`OBJ ${modelIndex + 1} loaded successfully`);
  } catch (error) {
    console.error('Error parsing OBJ:', error);
    alert('Error loading OBJ file');
  }
};

const handleObjFile = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    loadObjFromText(e.target.result, loadedModels.length);
  };
  reader.readAsText(file);
};

const handleCopcFile = (event) => {
  const file = event.target.files[0];
  if (file) {
    alert('COPC support requires:\nnpm install @giro3d/giro3d copc\n\nImplementation coming soon.');
  }
};

onMounted(() => {
  if (viewerRef.value) {
    initViewer();
    
    // Auto-load all models if provided in query params
    if (modelUrls.length > 0) {
      modelUrls.forEach((url, index) => {
        if (!url.startsWith('http')) {
          console.log(`Loading model ${index + 1}/${modelUrls.length}:`, url);
          loadModelFromUrl(url, index);
        }
      });
    }
    
    // TODO: Auto-load point clouds if provided
    if (pointcloudUrls.length > 0) {
      console.log('Point clouds to load:', pointcloudUrls.length);
      pointcloudUrls.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
      });
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (renderer) {
    renderer.dispose();
  }
});
</script>

<style scoped>
.viewer-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  background: #1a1a1a;
}

#viewer {
  width: 100%;
  height: 100%;
}

.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  font-size: 13px;
  max-width: 300px;
  z-index: 1000;
}

.controls h3 {
  margin-bottom: 10px;
  color: #333;
  font-size: 16px;
}

.controls .info {
  margin: 5px 0;
  color: #666;
}

.controls button {
  margin-top: 10px;
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  width: 100%;
}

.controls button:hover {
  background: #0056b3;
}

.controls input[type="file"] {
  margin-top: 10px;
  font-size: 12px;
  width: 100%;
}

.file-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ddd;
}

.file-section label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
  color: #333;
}

.file-section small {
  display: block;
  color: #999;
  font-size: 11px;
  margin-top: 3px;
}
</style>