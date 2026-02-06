<template>
  <div class="viewer-container">
    <div id="viewer" ref="viewerRef"></div>
    
    <div class="controls">
      <h3>🌐 3D Viewer</h3>
      <div class="info">
        <strong>{{ modelName }}</strong>
      </div>
      <div class="info">
        <strong>Position:</strong> <span>{{ coordinates }}</span>
      </div>
      
      <div class="view-controls">
        <button @click="toggleWireframe" class="toggle-btn">
          {{ showWireframe ? '🔲 Solid' : '🔳 Wireframe' }}
        </button>
        <button @click="toggleBoundingBox" class="toggle-btn">
          {{ showBoundingBox ? '📦 Hide Box' : '📦 Show Box' }}
        </button>
        <button @click="toggleGrid" class="toggle-btn">
          {{ showGrid ? '⊞ Hide Grid' : '⊞ Show Grid' }}
        </button>
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

      <button @click="resetCamera">🔄 Reset Camera</button>
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

// UI state
const showWireframe = ref(false);
const showBoundingBox = ref(true);
const showGrid = ref(true);

let scene, camera, renderer, controls;
let loadedModels = [];
let initialCameraPosition = null;
let initialCameraTarget = null;

const initViewer = () => {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    viewerRef.value.clientWidth / viewerRef.value.clientHeight,
    0.1,
    1000000  // Increased far plane for large coordinates
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

  // Grid and axes (will be repositioned when model loads)
  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x444444);
  gridHelper.name = 'gridHelper';
  scene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(50);
  axesHelper.name = 'axesHelper';
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
  if (initialCameraPosition && initialCameraTarget) {
    camera.position.copy(initialCameraPosition);
    controls.target.copy(initialCameraTarget);
    controls.update();
  } else {
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  }
};

const toggleWireframe = () => {
  showWireframe.value = !showWireframe.value;
  loadedModels.forEach(model => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material.wireframe = showWireframe.value;
      }
    });
  });
};

const toggleBoundingBox = () => {
  showBoundingBox.value = !showBoundingBox.value;
  const boxHelper = scene.getObjectByName('boxHelper');
  if (boxHelper) {
    boxHelper.visible = showBoundingBox.value;
  }
};

const toggleGrid = () => {
  showGrid.value = !showGrid.value;
  const grid = scene.getObjectByName('gridHelper');
  const axes = scene.getObjectByName('axesHelper');
  if (grid) grid.visible = showGrid.value;
  if (axes) axes.visible = showGrid.value;
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

    // Get the bounding box to understand the model's original size
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    console.log(`Original model size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
    console.log(`Original center: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`);

    // Center the model at its local origin first
    object.position.set(-center.x, -center.y, -center.z);
    
    // Then position it at the real-world coordinates (x, y from the feature)
    // Using the feature's coordinates from the map
    if (modelIndex === 0) {
      object.position.x += x;
      object.position.y += y;
    } else {
      // Offset additional models side by side
      object.position.x += x + (modelIndex * (size.x + 1000));
      object.position.y += y;
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
    
    // Auto-adjust camera to fit the model
    if (modelIndex === 0) {
      const modelBox = new THREE.Box3().setFromObject(object);
      const modelSize = modelBox.getSize(new THREE.Vector3());
      const modelCenter = modelBox.getCenter(new THREE.Vector3());
      const maxModelDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
      
      // Reposition and scale grid to match model
      const grid = scene.getObjectByName('gridHelper');
      if (grid) {
        // Scale grid to be larger than the model
        const gridSize = maxModelDim * 2;
        grid.scale.setScalar(gridSize / 200); // 200 is default grid size
        grid.position.set(modelCenter.x, modelCenter.y - modelSize.y / 2, modelCenter.z);
      }
      
      // Reposition and scale axes to match model
      const axes = scene.getObjectByName('axesHelper');
      if (axes) {
        axes.scale.setScalar(maxModelDim / 50); // 50 is default axes size
        axes.position.copy(modelCenter);
      }
      
      // Add a bounding box helper for the model
      const boxHelper = new THREE.BoxHelper(object, 0x00ff00);
      boxHelper.name = 'boxHelper';
      scene.add(boxHelper);
      
      // Position camera to see the whole model at real-world scale
      const distance = maxModelDim * 2;
      camera.position.set(
        modelCenter.x + distance, 
        modelCenter.y + distance, 
        modelCenter.z + distance
      );
      camera.lookAt(modelCenter);
      controls.target.copy(modelCenter);
      controls.update();
      
      // Store initial camera position for reset button
      initialCameraPosition = camera.position.clone();
      initialCameraTarget = controls.target.clone();
      
      console.log(`OBJ ${modelIndex + 1} loaded successfully`);
      console.log(`Model positioned at: ${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)}`);
      console.log(`Model size: ${modelSize.x.toFixed(2)} x ${modelSize.y.toFixed(2)} x ${modelSize.z.toFixed(2)}`);
      console.log(`Camera position: ${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}`);
      console.log(`Camera distance from model: ${distance.toFixed(2)}`);
    } else {
      console.log(`OBJ ${modelIndex + 1} loaded successfully`);
    }
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
        // Construct full URL if it's a relative path
        const fullUrl = url.startsWith('http') ? url : `http://localhost:3000/${url}`;
        console.log(`Loading model ${index + 1}/${modelUrls.length}:`, fullUrl);
        loadModelFromUrl(fullUrl, index);
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

.view-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ddd;
}

.view-controls .toggle-btn {
  margin-top: 0;
  padding: 6px 10px;
  font-size: 12px;
  background: #6c757d;
}

.view-controls .toggle-btn:hover {
  background: #5a6268;
}
</style>