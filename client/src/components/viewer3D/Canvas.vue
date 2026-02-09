<template>
  <div ref="viewerRef" class="viewer-canvas"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { useViewer3D } from '@/composables/useViewer3D.js';

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

const emit = defineEmits(['scene-ready', 'model-loaded', 'loading-error', 'loading-progress', 'parsing-started', 'parsing-progress', 'building-geometry']);

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
  measurementMode,
  addMeasurementPoint,
  measurementPoints,
  cleanup
} = useViewer3D();

let animationFrameId = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const measurementMarkers = [];

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

  // Handle mouse clicks for measurements
  newRenderer.domElement.addEventListener('click', onCanvasClick);

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
    
    // Fetch with progress tracking
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    let loaded = 0;
    
    const reader = response.body.getReader();
    const chunks = [];
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      if (total) {
        const progress = (loaded / total) * 100;
        emit('loading-progress', { 
          url, 
          index: modelIndex, 
          loaded, 
          total, 
          progress: Math.round(progress),
          status: 'downloading'
        });
      }
    }
    
    // Combine chunks and decode
    const chunksAll = new Uint8Array(loaded);
    let position = 0;
    for (const chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }
    
    emit('loading-progress', { 
      url, 
      index: modelIndex, 
      loaded: total, 
      total, 
      progress: 100,
      status: 'decoding'
    });
    
    const text = new TextDecoder('utf-8').decode(chunksAll);
    
    // Emit parsing started
    emit('parsing-started', { url, index: modelIndex, size: total });
    
    // Use setTimeout to allow UI to update before heavy parsing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Parse the loaded text (now async with progress)
    const object = await loadObjFromText(text, modelIndex);
    
    emit('model-loaded', { url, index: modelIndex, object });
  } catch (error) {
    console.error('Error loading model from URL:', error);
    emit('loading-error', { url, error: error.message });
  }
};

const loadObjFromText = async (text, modelIndex = 0) => {
  if (!scene.value || !camera.value || !controls.value) return;

  try {
    // Parse OBJ with progress updates
    const object = await parseObjWithProgress(text, modelIndex);

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
    
    return object;
    
    console.log(`OBJ ${modelIndex + 1} loaded successfully`);
  } catch (error) {
    console.error('Error parsing OBJ:', error);
    emit('loading-error', { error: error.message });
  }
};

const parseObjWithProgress = async (text, modelIndex) => {
  const lines = text.split('\n');
  const totalLines = lines.length;
  const chunkSize = 10000; // Process 10k lines at a time
  
  const vertices = [];
  const normals = [];
  const uvs = [];
  const faces = [];
  
  // Process lines in chunks
  for (let i = 0; i < totalLines; i += chunkSize) {
    const end = Math.min(i + chunkSize, totalLines);
    const chunk = lines.slice(i, end);
    
    // Process this chunk
    for (const line of chunk) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const parts = trimmed.split(/\s+/);
      const type = parts[0];
      
      if (type === 'v') {
        // Vertex
        vertices.push(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        );
      } else if (type === 'vn') {
        // Normal
        normals.push(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        );
      } else if (type === 'vt') {
        // UV
        uvs.push(
          parseFloat(parts[1]),
          parseFloat(parts[2])
        );
      } else if (type === 'f') {
        // Face (simplified - only handles v or v/vt/vn format)
        faces.push(parts.slice(1));
      }
    }
    
    // Report progress
    const progress = Math.round((end / totalLines) * 100);
    emit('parsing-progress', { index: modelIndex, progress, processed: end, total: totalLines });
    
    // Yield to UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Build Three.js geometry
  emit('building-geometry', { index: modelIndex, stage: 'geometry', vertices: vertices.length / 3, faces: faces.length });
  await new Promise(resolve => setTimeout(resolve, 0));
  
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const finalNormals = [];
  const finalUvs = [];
  
  emit('building-geometry', { index: modelIndex, stage: 'triangulation', faces: faces.length });
  await new Promise(resolve => setTimeout(resolve, 0));
  
  for (const faceParts of faces) {
    // Convert face to triangles (assuming triangles or quads)
    const indices = faceParts.map(part => {
      const [v, vt, vn] = part.split('/').map(s => parseInt(s) - 1);
      return { v, vt, vn };
    });
    
    // Triangulate if needed
    const triangles = indices.length === 3 ? [indices] : 
      indices.length === 4 ? [[indices[0], indices[1], indices[2]], [indices[0], indices[2], indices[3]]] : [];
    
    for (const tri of triangles) {
      for (const { v, vt, vn } of tri) {
        positions.push(vertices[v * 3], vertices[v * 3 + 1], vertices[v * 3 + 2]);
        if (vn >= 0 && normals.length > 0) {
          finalNormals.push(normals[vn * 3], normals[vn * 3 + 1], normals[vn * 3 + 2]);
        }
        if (vt >= 0 && uvs.length > 0) {
          finalUvs.push(uvs[vt * 2], uvs[vt * 2 + 1]);
        }
      }
    }
  }
  
  emit('building-geometry', { index: modelIndex, stage: 'buffers', triangles: positions.length / 9 });
  await new Promise(resolve => setTimeout(resolve, 0));
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (finalNormals.length > 0) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(finalNormals, 3));
  } else {
    emit('building-geometry', { index: modelIndex, stage: 'normals' });
    await new Promise(resolve => setTimeout(resolve, 0));
    geometry.computeVertexNormals();
  }
  if (finalUvs.length > 0) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUvs, 2));
  }
  
  emit('building-geometry', { index: modelIndex, stage: 'finalizing' });
  await new Promise(resolve => setTimeout(resolve, 0));
  
  const mesh = new THREE.Mesh(geometry);
  
  // Apply Z-up to Y-up rotation
  mesh.rotation.x = -Math.PI / 2;
  
  const group = new THREE.Group();
  group.add(mesh);
  
  return group;
};

const adjustCameraToModel = (object, size, center) => {
  if (!scene.value || !camera.value || !controls.value) return;

  const modelBox = new THREE.Box3().setFromObject(object);
  const modelSize = modelBox.getSize(new THREE.Vector3());
  const modelCenter = modelBox.getCenter(new THREE.Vector3());
  const maxModelDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
  
  // Reposition and scale grid - place at bottom of model
  const grid = scene.value.getObjectByName('gridHelper');
  if (grid) {
    const gridSize = maxModelDim * 2;
    grid.scale.setScalar(gridSize / 200);
    // Place grid at the bottom Y coordinate of the model
    grid.position.set(modelCenter.x, modelBox.min.y, modelCenter.z);
    // Ensure grid is horizontal (XZ plane, Y up) - no rotation needed as GridHelper default is correct
    grid.rotation.set(0, 0, 0);
  }
  
  // Reposition and scale axes - place at bottom center of model
  const axes = scene.value.getObjectByName('axesHelper');
  if (axes) {
    axes.scale.setScalar(maxModelDim / 50);
    // Place axes at bottom center (X, minY, Z)
    axes.position.set(modelCenter.x, modelBox.min.y, modelCenter.z);
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

// Point cloud loading
const loadPointCloudFile = async (file) => {
  const extension = file.name.split('.').pop().toLowerCase();
  
  if (extension === 'ply') {
    loadPLYFile(file);
  } else if (extension === 'laz' || extension === 'las') {
    emit('loading-error', { 
      url: file.name, 
      error: 'LAZ/LAS support requires server-side COPC conversion. Please use preprocessing pipeline.' 
    });
  } else if (file.name.includes('.copc.laz')) {
    emit('loading-error', { 
      url: file.name, 
      error: 'COPC support coming soon. Requires Giro3D integration.' 
    });
  } else {
    emit('loading-error', { 
      url: file.name, 
      error: `Unsupported point cloud format: ${extension}` 
    });
  }
};

const loadPLYFile = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const loader = new PLYLoader();
    try {
      const geometry = loader.parse(e.target.result);
      
      // Create point cloud material
      const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        sizeAttenuation: true
      });
      
      // If no colors in PLY, add default color
      if (!geometry.attributes.color) {
        const colors = new Float32Array(geometry.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) {
          colors[i] = 0.7;     // R
          colors[i + 1] = 0.7; // G
          colors[i + 2] = 0.7; // B
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }
      
      const pointCloud = new THREE.Points(geometry, material);
      
      // Apply Z-up to Y-up rotation
      pointCloud.rotation.x = -Math.PI / 2;
      
      scene.value.add(pointCloud);
      currentModel.value = pointCloud;
      
      // Fit camera to point cloud
      const box = new THREE.Box3().setFromObject(pointCloud);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 2;
      
      camera.value.position.set(
        center.x + distance,
        center.y + distance,
        center.z + distance
      );
      controls.value.target.copy(center);
      camera.value.lookAt(center);
      
      // Update grid position
      if (grid.value) {
        grid.value.position.y = box.min.y;
      }
      
      console.log(`Point cloud loaded: ${geometry.attributes.position.count} points`);
      emit('model-loaded', { url: file.name, index: 0, object: pointCloud });
    } catch (error) {
      console.error('PLY loading error:', error);
      emit('loading-error', { url: file.name, error: error.message });
    }
  };
  
  reader.readAsArrayBuffer(file);
};

// Camera frustum visualization
const loadCamerasFile = async (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      const cameras = parseCamerasTxt(content);
      
      cameras.forEach((cam, index) => {
        const cameraObjects = addCameraFrustum(cam, index);
        // Emit each camera as a loaded object
        if (cameraObjects) {
          emit('model-loaded', { 
            url: `${file.name}:${cam.name}`, 
            index: index, 
            object: cameraObjects.helper 
          });
        }
      });
      
      console.log(`Loaded ${cameras.length} cameras`);
    } catch (error) {
      console.error('Camera loading error:', error);
      emit('loading-error', { url: file.name, error: error.message });
    }
  };
  reader.readAsText(file);
};

const parseCamerasTxt = (content) => {
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const cameras = [];
  
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    
    // Common camera.txt formats:
    // Format 1: name x y z qw qx qy qz
    // Format 2: name x y z roll pitch yaw
    
    if (parts.length >= 7) {
      const camera = {
        name: parts[0],
        position: {
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          z: parseFloat(parts[3])
        }
      };
      
      // Check if quaternion (values typically between -1 and 1) or euler angles
      const val4 = parseFloat(parts[4]);
      if (parts.length >= 8 && Math.abs(val4) <= 1) {
        // Quaternion format
        camera.quaternion = {
          w: val4,
          x: parseFloat(parts[5]),
          y: parseFloat(parts[6]),
          z: parseFloat(parts[7])
        };
      } else {
        // Euler angles (degrees)
        camera.euler = {
          roll: parseFloat(parts[4]),
          pitch: parseFloat(parts[5]),
          yaw: parseFloat(parts[6])
        };
      }
      
      cameras.push(camera);
    }
  }
  
  return cameras;
};

const addCameraFrustum = (camData, index) => {
  if (!scene.value) return null;
  
  // Create camera helper
  const frustumCamera = new THREE.PerspectiveCamera(60, 1.33, 0.1, 10);
  
  // Set position (convert Z-up to Y-up)
  frustumCamera.position.set(
    camData.position.x,
    camData.position.z, // Z becomes Y
    -camData.position.y  // Y becomes -Z
  );
  
  // Set rotation
  if (camData.quaternion) {
    const quat = new THREE.Quaternion(
      camData.quaternion.x,
      camData.quaternion.z,
      -camData.quaternion.y,
      camData.quaternion.w
    );
    frustumCamera.setRotationFromQuaternion(quat);
  } else if (camData.euler) {
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(camData.euler.pitch),
      THREE.MathUtils.degToRad(camData.euler.yaw),
      THREE.MathUtils.degToRad(camData.euler.roll)
    );
    frustumCamera.setRotationFromEuler(euler);
  }
  
  // Create frustum helper
  const helper = new THREE.CameraHelper(frustumCamera);
  helper.name = `camera_${camData.name}`;
  helper.userData = { type: 'camera', cameraName: camData.name };
  scene.value.add(helper);
  
  // Add label
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  context.fillStyle = 'white';
  context.font = 'Bold 20px Arial';
  context.fillText(camData.name, 10, 30);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.copy(frustumCamera.position);
  sprite.position.y += 2; // Offset above camera
  sprite.scale.set(4, 1, 1);
  sprite.name = `camera_label_${camData.name}`;
  sprite.userData = { type: 'camera_label', parentId: helper.uuid };
  scene.value.add(sprite);
  
  return { helper, sprite };
};

const fitCameraToScene = () => {
  if (!scene.value || !camera.value || !controls.value) return;
  
  const box = new THREE.Box3();
  scene.value.traverse((object) => {
    if (object.isMesh || object.isPoints) {
      box.expandByObject(object);
    }
  });
  
  if (box.isEmpty()) return;
  
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 2;
  
  camera.value.position.set(
    center.x + distance,
    center.y + distance,
    center.z + distance
  );
  controls.value.target.copy(center);
  camera.value.lookAt(center);
  controls.value.update();
};

// Layer management
const toggleLayerVisibility = (layerId, visible) => {
  if (!scene.value) return;
  
  scene.value.traverse((object) => {
    if (object.uuid === layerId) {
      object.visible = visible;
    }
  });
};

const removeLayer = (layerId) => {
  if (!scene.value) return;
  
  let objectToRemove = null;
  let relatedObjects = [];
  
  scene.value.traverse((object) => {
    if (object.uuid === layerId) {
      objectToRemove = object;
    }
    // Also find related camera labels
    if (object.userData && object.userData.parentId === layerId) {
      relatedObjects.push(object);
    }
  });
  
  if (objectToRemove) {
    scene.value.remove(objectToRemove);
    
    // Remove related objects (e.g., camera labels)
    relatedObjects.forEach(obj => {
      scene.value.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    
    // Dispose of geometry and materials
    if (objectToRemove.geometry) {
      objectToRemove.geometry.dispose();
    }
    if (objectToRemove.material) {
      if (Array.isArray(objectToRemove.material)) {
        objectToRemove.material.forEach(m => m.dispose());
      } else {
        objectToRemove.material.dispose();
      }
    }
    
    // Remove from models array if it exists
    const index = models.value.findIndex(m => m.uuid === layerId);
    if (index !== -1) {
      models.value.splice(index, 1);
    }
  }
};

// Raycasting for measurements
const onCanvasClick = (event) => {
  if (!measurementMode.value || !scene.value || !camera.value) return;

  // Calculate mouse position in normalized device coordinates
  const rect = renderer.value.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera.value);

  // Get all meshes in the scene
  const meshes = [];
  scene.value.traverse((object) => {
    if (object.isMesh && object.name !== 'measurementMarker') {
      meshes.push(object);
    }
  });

  // Check for intersections
  const intersects = raycaster.intersectObjects(meshes, false);
  
  if (intersects.length > 0) {
    const point = intersects[0].point;
    addMeasurementPoint(point);
    addMeasurementMarker(point);
  }
};

const addMeasurementMarker = (point) => {
  if (!scene.value) return;

  // Create a sphere marker at the clicked point
  const markerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  marker.position.copy(point);
  marker.name = 'measurementMarker';
  scene.value.add(marker);
  measurementMarkers.push(marker);

  // Draw line between points if we have more than one
  if (measurementPoints.value.length > 1) {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      measurementPoints.value[measurementPoints.value.length - 2],
      measurementPoints.value[measurementPoints.value.length - 1]
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.name = 'measurementMarker';
    scene.value.add(line);
    measurementMarkers.push(line);
  }
};

const clearMeasurementMarkers = () => {
  if (!scene.value) return;
  measurementMarkers.forEach(marker => {
    scene.value.remove(marker);
    if (marker.geometry) marker.geometry.dispose();
    if (marker.material) marker.material.dispose();
  });
  measurementMarkers.length = 0;
};

const enableMeasurementMode = (mode) => {
  clearMeasurementMarkers();
  console.log('Measurement mode enabled:', mode);
};

const disableMeasurementMode = () => {
  clearMeasurementMarkers();
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
  if (renderer.value) {
    renderer.value.domElement.removeEventListener('click', onCanvasClick);
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  clearMeasurementMarkers();
  cleanup();
});

// Watch for measurement mode changes
watch(measurementMode, (newMode) => {
  if (!newMode) {
    clearMeasurementMarkers();
  }
});

// Expose methods for parent component
defineExpose({
  loadUserObjFile,
  loadModelFromUrl,
  loadPointCloudFile,
  loadCamerasFile,
  fitCameraToScene,
  toggleLayerVisibility,
  removeLayer,
  enableMeasurementMode,
  disableMeasurementMode
});
</script>

<style scoped>
.viewer-canvas {
  width: 100%;
  height: 100%;
}
</style>