<template>
  <div ref="viewerRef" class="viewer-canvas"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { useViewer3DStore } from '@/stores/viewer3dStore';
import { useSettingsStore } from '@/stores/settingsStore.js';
import { storeToRefs } from 'pinia';

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
const fileLoadedCount = ref(0); // Track number of models loaded from files

const settingsStore = useSettingsStore();
const { theme } = storeToRefs(settingsStore);

const viewer3DStore = useViewer3DStore();
const {
  scene,
  camera,
  renderer,
  controls,
  measurementMode,
  measurementPoints,
} = storeToRefs(viewer3DStore);
const {
  setScene,
  setCamera,
  setRenderer,
  setControls,
  addModel,
  storeInitialCamera,
  resetCamera,
  addMeasurementPoint,
  cleanup,
} = viewer3DStore;

let animationFrameId = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const measurementMarkers = [];

const initViewer = () => {
  if (!viewerRef.value) return;

  // Scene
  const newScene = new THREE.Scene();
  // Set background color based on theme
  newScene.background = new THREE.Color(theme.value === 'dark' ? 0x1a1a1a : 0x87ceeb);
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
  
  // Track mouse down position to detect drags vs clicks
  newRenderer.domElement.addEventListener('mousedown', (e) => {
    mouseDownPosition.x = e.clientX;
    mouseDownPosition.y = e.clientY;
  });

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
    
    console.log(`OBJ ${modelIndex + 1} loaded successfully`);
    return object;
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

const loadUserObjFile = async (file) => {
  const reader = new FileReader();
  const currentIndex = fileLoadedCount.value;
  const fileSize = file.size;
  
  // Track progress
  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      const progress = Math.round((e.loaded / e.total) * 100);
      const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
      const totalMB = (e.total / (1024 * 1024)).toFixed(1);
      emit('loading-progress', {
        url: file.name,
        index: currentIndex,
        loaded: e.loaded,
        total: e.total,
        progress,
        status: 'reading'
      });
    }
  };
  
  reader.onload = async (e) => {
    emit('parsing-started', { url: file.name, index: currentIndex, size: fileSize });
    
    const object = await loadObjFromText(e.target.result, currentIndex);
    
    if (object) {
      object.userData.type = 'model';
      fileLoadedCount.value++;
      emit('model-loaded', { url: file.name, index: currentIndex, object });
    }
  };
  
  reader.onerror = () => {
    emit('loading-error', { url: file.name, error: 'Failed to read file' });
  };
  
  reader.readAsText(file);
};

// Point cloud loading
const loadPointCloudFile = async (file) => {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.ply')) {
    loadPLYFile(file);
  } else if (lower.endsWith('.copc.laz')) {
    emit('loading-error', {
      url: file.name,
      error: 'COPC support coming soon. Requires Giro3D integration.'
    });
  } else if (lower.endsWith('.laz') || lower.endsWith('.las')) {
    loadLASFile(file);
  } else {
    emit('loading-error', {
      url: file.name,
      error: `Unsupported point cloud format: ${lower.split('.').pop()}`
    });
  }
};

const loadLASFile = async (file) => {
  const currentIndex = fileLoadedCount.value;
  const fileSize = file.size;

  emit('loading-progress', {
    url: file.name, index: currentIndex,
    loaded: 0, total: fileSize, progress: 0, status: 'reading'
  });

  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (e) {
    emit('loading-error', { url: file.name, error: 'Failed to read file' });
    return;
  }

  emit('loading-progress', {
    url: file.name, index: currentIndex,
    loaded: fileSize, total: fileSize, progress: 100, status: 'parsing'
  });

  try {
    const [{ Las }, { createLazPerf }] = await Promise.all([
      import('copc'),
      import('laz-perf'),
    ]);

    // Initialize laz-perf with the WASM file served from /public/
    const lazPerf = await createLazPerf({
      locateFile: (file) => `/${file}`,
    });

    // Parse header
    const headerBytes = new Uint8Array(arrayBuffer, 0, Math.min(375, arrayBuffer.byteLength));
    const header = Las.Header.parse(headerBytes);
    const { pointCount, pointDataRecordLength, pointDataRecordFormat, pointDataOffset, scale, offset } = header;

    if (pointCount === 0) {
      emit('loading-error', { url: file.name, error: 'Point cloud is empty' });
      return;
    }

    // Decompress LAZ or slice raw LAS point data
    let pointBytes;
    const isLaz = file.name.toLowerCase().endsWith('.laz');
    if (isLaz) {
      emit('loading-progress', {
        url: file.name, index: currentIndex,
        loaded: fileSize, total: fileSize, progress: 0, status: 'parsing'
      });
      // Pass our lazPerf instance so copc uses the correctly located WASM
      pointBytes = await Las.PointData.decompressFile(new Uint8Array(arrayBuffer), lazPerf);
    } else {
      pointBytes = new Uint8Array(arrayBuffer, pointDataOffset, pointCount * pointDataRecordLength);
    }

    // Create a view to read X/Y/Z (and RGB if available)
    const view = Las.View.create(pointBytes, header);

    const getX = view.getter('X');
    const getY = view.getter('Y');
    const getZ = view.getter('Z');

    // Formats 2, 3, 5, 7, 8, 10 have RGB
    const formatsWithColor = new Set([2, 3, 5, 7, 8, 10]);
    const hasColor = formatsWithColor.has(pointDataRecordFormat);
    let getR, getG, getB;
    if (hasColor) {
      getR = view.getter('Red');
      getG = view.getter('Green');
      getB = view.getter('Blue');
    }

    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);

    for (let i = 0; i < pointCount; i++) {
      const x = getX(i) * scale[0] + offset[0];
      const y = getY(i) * scale[1] + offset[1];
      const z = getZ(i) * scale[2] + offset[2];
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      if (hasColor) {
        // LAS stores colors as 16-bit; normalize to [0,1]
        colors[i * 3]     = getR(i) / 65535;
        colors[i * 3 + 1] = getG(i) / 65535;
        colors[i * 3 + 2] = getB(i) / 65535;
      } else {
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0.7;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      sizeAttenuation: true
    });

    const pointCloud = new THREE.Points(geometry, material);
    pointCloud.rotation.x = -Math.PI / 2;
    pointCloud.userData.type = 'pointcloud';

    scene.value.add(pointCloud);

    // Fit camera
    const box = new THREE.Box3().setFromObject(pointCloud);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;

    camera.value.position.set(center.x + distance, center.y + distance, center.z + distance);
    controls.value.target.copy(center);
    camera.value.lookAt(center);

    const gridHelper = scene.value.getObjectByName('gridHelper');
    if (gridHelper) gridHelper.position.y = box.min.y;

    console.log(`LAS/LAZ point cloud loaded: ${pointCount} points`);
    fileLoadedCount.value++;
    emit('model-loaded', { url: file.name, index: currentIndex, object: pointCloud });

  } catch (error) {
    console.error('LAS/LAZ loading error:', error);
    emit('loading-error', { url: file.name, error: error.message });
  }
};

const loadPLYFile = (file) => {
  const reader = new FileReader();
  const currentIndex = fileLoadedCount.value;
  const fileSize = file.size;
  
  // Track progress
  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      const progress = Math.round((e.loaded / e.total) * 100);
      emit('loading-progress', {
        url: file.name,
        index: currentIndex,
        loaded: e.loaded,
        total: e.total,
        progress,
        status: 'reading'
      });
    }
  };
  
  reader.onload = (e) => {
    emit('loading-progress', {
      url: file.name,
      index: currentIndex,
      loaded: fileSize,
      total: fileSize,
      progress: 100,
      status: 'parsing'
    });
    
    // Use setTimeout to allow UI to update before synchronous parsing
    setTimeout(() => {
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
      
      // Set type metadata
      pointCloud.userData.type = 'pointcloud';
      
      scene.value.add(pointCloud);
      
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
      const gridHelper = scene.value.getObjectByName('gridHelper');
      if (gridHelper) {
        gridHelper.position.y = box.min.y;
      }
      
      console.log(`Point cloud loaded: ${geometry.attributes.position.count} points`);
      fileLoadedCount.value++;
      emit('model-loaded', { url: file.name, index: currentIndex, object: pointCloud });
    } catch (error) {
      console.error('PLY loading error:', error);
      emit('loading-error', { url: file.name, error: error.message });
    }
    }, 50); // Small delay for UI update
  };
  
  reader.onerror = () => {
    emit('loading-error', { url: file.name, error: 'Failed to read file' });
  };
  
  reader.readAsArrayBuffer(file);
};

// Camera frustum visualization
const loadCamerasFile = async (file) => {
  const reader = new FileReader();
  const fileSize = file.size;
  
  // Track progress
  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      const progress = Math.round((e.loaded / e.total) * 100);
      emit('loading-progress', {
        url: file.name,
        index: 0,
        loaded: e.loaded,
        total: e.total,
        progress,
        status: 'reading'
      });
    }
  };
  
  reader.onload = (e) => {
    emit('loading-progress', {
      url: file.name,
      index: 0,
      loaded: fileSize,
      total: fileSize,
      progress: 100,
      status: 'parsing'
    });
    
    // Use setTimeout to allow UI to update before synchronous parsing
    setTimeout(() => {
      try {
        const content = e.target.result;
        const cameras = parseCamerasTxt(content);
        
        console.log(`Parsed ${cameras.length} cameras from file`);
        
        // Create a group to hold all cameras
        const cameraGroup = new THREE.Group();
        cameraGroup.name = file.name;
        cameraGroup.userData.type = 'camera';
        cameraGroup.userData.cameraCount = cameras.length;
        
        cameras.forEach((cam, index) => {
          const cameraObject = addCameraFrustum(cam, index);
          if (cameraObject) {
            // Add camera group to the parent group
            cameraGroup.add(cameraObject);
          }
        });
        
        // Add group to scene
        scene.value.add(cameraGroup);
        
        console.log(`Loaded ${cameras.length} cameras into scene as group`);
        
        // Emit single layer for all cameras
        emit('model-loaded', { 
          url: file.name, 
          index: 0, 
          object: cameraGroup 
        });
      } catch (error) {
        console.error('Camera loading error:', error);
        emit('loading-error', { url: file.name, error: error.message });
      }
    }, 50); // Small delay for UI update
  };
  
  reader.onerror = () => {
    emit('loading-error', { url: file.name, error: 'Failed to read file' });
  };
  
  reader.readAsText(file);
};

const parseCamerasTxt = (content) => {
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const cameras = [];
  
  // Detect delimiter - check first data line
  const firstLine = lines[0];
  const delimiter = firstLine?.includes(';') ? ';' : /\s+/;
  const isSemicolon = firstLine?.includes(';');
  
  for (const line of lines) {
    const parts = line.trim().split(delimiter).map(p => p.trim());
    
    // Handle different formats:
    // Semicolon CSV: Label;Enable;X;Y;Z;Yaw;Pitch;Roll;...
    // Space-separated: name x y z qw qx qy qz OR name x y z yaw pitch roll
    
    if (isSemicolon && parts.length >= 8) {
      // Semicolon format: Label;Enable;X;Y;Z;Yaw;Pitch;Roll
      const camera = {
        name: parts[0], // Label
        position: {
          x: parseFloat(parts[2]), // X/Easting
          y: parseFloat(parts[3]), // Y/Northing
          z: parseFloat(parts[4])  // Z/Altitude
        },
        euler: {
          yaw: parseFloat(parts[5]),   // Yaw
          pitch: parseFloat(parts[6]), // Pitch
          roll: parseFloat(parts[7])   // Roll
        }
      };
      cameras.push(camera);
    } else if (!isSemicolon && parts.length >= 7) {
      // Space-separated format
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
          yaw: parseFloat(parts[4]),
          pitch: parseFloat(parts[5]),
          roll: parseFloat(parts[6])
        };
      }
      
      cameras.push(camera);
    }
  }
  
  return cameras;
};

const addCameraFrustum = (camData, index) => {
  if (!scene.value) return null;
  
  // Create a group to hold all camera components
  const cameraGroup = new THREE.Group();
  
  // Set position (convert Z-up to Y-up)
  const position = new THREE.Vector3(
    camData.position.x,
    camData.position.z, // Z becomes Y
    -camData.position.y  // Y becomes -Z
  );
  cameraGroup.position.copy(position);
  
  // Set rotation
  if (camData.quaternion) {
    const quat = new THREE.Quaternion(
      camData.quaternion.x,
      camData.quaternion.z,
      -camData.quaternion.y,
      camData.quaternion.w
    );
    cameraGroup.setRotationFromQuaternion(quat);
  } else if (camData.euler) {
    // Convert Yaw/Pitch/Roll to Three.js Euler
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(-camData.euler.pitch), // Pitch (X rotation, inverted)
      THREE.MathUtils.degToRad(camData.euler.yaw),     // Yaw (Y rotation)
      THREE.MathUtils.degToRad(-camData.euler.roll),   // Roll (Z rotation, inverted)
      'YXZ' // Yaw-Pitch-Roll order
    );
    cameraGroup.setRotationFromEuler(euler);
  }
  
  // 1. Camera body - small gray box
  const bodyGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.4);
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
  const cameraBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
  cameraBody.name = `camera_body_${camData.name}`;
  cameraGroup.add(cameraBody);
  
  // 2. Camera lens - small cylinder pointing forward
  const lensGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8);
  const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const lens = new THREE.Mesh(lensGeometry, lensMaterial);
  lens.rotation.x = Math.PI / 2; // Point forward (local -Z)
  lens.position.set(0, 0, -0.275);
  cameraGroup.add(lens);
  
  // 3. XYZ axes helper at camera position
  const axesHelper = new THREE.AxesHelper(0.5);
  cameraGroup.add(axesHelper);
  
  // 4. Subtle frustum wireframe (smaller, less prominent)
  const frustumGeometry = new THREE.BufferGeometry();
  const frustumVertices = new Float32Array([
    // Near plane corners
    -0.15, -0.1, -0.2,
    0.15, -0.1, -0.2,
    0.15, 0.1, -0.2,
    -0.15, 0.1, -0.2,
    // Far plane corners
    -0.6, -0.4, -1.5,
    0.6, -0.4, -1.5,
    0.6, 0.4, -1.5,
    -0.6, 0.4, -1.5,
  ]);
  frustumGeometry.setAttribute('position', new THREE.BufferAttribute(frustumVertices, 3));
  
  const frustumIndices = [
    // Near plane
    0, 1, 1, 2, 2, 3, 3, 0,
    // Far plane
    4, 5, 5, 6, 6, 7, 7, 4,
    // Connecting lines
    0, 4, 1, 5, 2, 6, 3, 7
  ];
  frustumGeometry.setIndex(frustumIndices);
  
  const frustumMaterial = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.3 });
  const frustumLines = new THREE.LineSegments(frustumGeometry, frustumMaterial);
  cameraGroup.add(frustumLines);
  
  cameraGroup.name = `camera_${camData.name}`;
  cameraGroup.userData = { type: 'camera_frustum', cameraName: camData.name };
  
  // 5. Label sprite above camera
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = 256;
  canvas.height = 64;
  context.fillStyle = 'white';
  context.font = 'Bold 20px Arial';
  context.fillText(camData.name, 10, 30);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.set(0, 0.8, 0); // Position relative to camera group
  sprite.scale.set(2, 0.5, 1);
  sprite.name = `camera_label_${camData.name}`;
  sprite.userData = { type: 'camera_label' };
  cameraGroup.add(sprite);
  
  return cameraGroup;
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

// Get scene bounding box center and size for camera presets
const getSceneBounds = () => {
  if (!scene.value) return null;
  
  const box = new THREE.Box3();
  scene.value.traverse((object) => {
    if (object.isMesh || object.isPoints) {
      box.expandByObject(object);
    }
  });
  
  if (box.isEmpty()) return null;
  
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  return { center, size, maxDim };
};

// Camera preset views
const setCameraPreset = (preset) => {
  if (!camera.value || !controls.value) return;
  
  const bounds = getSceneBounds();
  if (!bounds) return;
  
  const { center, maxDim } = bounds;
  const distance = maxDim * 1.8;
  
  switch (preset) {
    case 'top':
      camera.value.position.set(center.x, center.y + distance, center.z);
      camera.value.up.set(0, 0, -1);
      break;
    case 'front':
      camera.value.position.set(center.x, center.y, center.z + distance);
      camera.value.up.set(0, 1, 0);
      break;
    case 'right':
      camera.value.position.set(center.x + distance, center.y, center.z);
      camera.value.up.set(0, 1, 0);
      break;
  }
  
  controls.value.target.copy(center);
  camera.value.lookAt(center);
  controls.value.update();
};

const resetToInitialCamera = () => {
  resetCamera();
};

// Zoom camera to specific layer
const zoomToLayer = (layerId) => {
  if (!scene.value || !camera.value || !controls.value) return;
  
  let targetObject = null;
  scene.value.traverse((object) => {
    if (object.uuid === layerId) {
      targetObject = object;
    }
  });
  
  if (!targetObject) return;
  
  // Calculate bounding box for this object
  const box = new THREE.Box3().setFromObject(targetObject);
  
  if (box.isEmpty()) return;
  
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 2.5;
  
  // Smoothly animate camera
  camera.value.position.set(
    center.x + distance,
    center.y + distance,
    center.z + distance
  );
  controls.value.target.copy(center);
  camera.value.lookAt(center);
  controls.value.update();
  
  console.log(`Zoomed to layer: ${targetObject.name}`);
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
  
  scene.value.traverse((object) => {
    if (object.uuid === layerId) {
      objectToRemove = object;
    }
  });
  
  if (objectToRemove) {
    // Recursively dispose of all geometries and materials in the object tree
    const disposeObject = (obj) => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      }
      // Recursively dispose children
      if (obj.children) {
        obj.children.forEach(child => disposeObject(child));
      }
    };
    
    disposeObject(objectToRemove);
    scene.value.remove(objectToRemove);
    
    console.log(`Removed layer: ${objectToRemove.name || 'Unnamed'}`);
  }
};

// Raycasting for measurements
const onCanvasClick = (event) => {
  // Use the new measurement handler if active
  if (currentMeasurementMode) {
    handleMeasurementClick(event);
    return;
  }

  // Legacy handling (fallback)
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

let measurementCallback = null;
let currentMeasurementMode = null;
let currentMeasurementPoints = [];
let savedMeasurementObjects = []; // Array of arrays - each inner array contains objects for one measurement
let isMouseDownForMeasurement = false;
let mouseDownPosition = { x: 0, y: 0 };
let currentClosingLine = null; // Track the current closing line for area measurements

const enableMeasurementMode = (mode, callback) => {
  clearCurrentMeasurementMarkers();
  currentMeasurementMode = mode;
  measurementCallback = callback;
  currentMeasurementPoints = [];
  console.log('Measurement mode enabled:', mode);
};

const disableMeasurementMode = () => {
  currentMeasurementMode = null;
  measurementCallback = null;
  currentMeasurementPoints = [];
  clearCurrentMeasurementMarkers();
  clearAllMeasurements();
};

const clearMeasurements = () => {
  currentMeasurementPoints = [];
  clearCurrentMeasurementMarkers();
  clearAllMeasurements();
};

const clearCurrentMeasurementMarkers = () => {
  if (!scene.value) return;
  // Only remove current measurement markers, not saved ones
  const markersToRemove = [];
  scene.value.children.forEach(child => {
    if (child.name === 'currentMeasurementMarker') {
      markersToRemove.push(child);
    }
  });
  markersToRemove.forEach(marker => {
    scene.value.remove(marker);
    if (marker.geometry) marker.geometry.dispose();
    if (marker.material) marker.material.dispose();
  });
  measurementMarkers.length = 0;
  currentClosingLine = null; // Reset closing line reference
};

const clearAllMeasurements = () => {
  if (!scene.value) return;
  // Remove all saved measurement objects
  savedMeasurementObjects.forEach(measurementGroup => {
    measurementGroup.forEach(obj => {
      scene.value.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  });
  // Also remove any current measurement markers
  const allMeasurements = [];
  scene.value.children.forEach(child => {
    if (child.name === 'currentMeasurementMarker' || child.name === 'savedMeasurementMarker') {
      allMeasurements.push(child);
    }
  });
  allMeasurements.forEach(marker => {
    scene.value.remove(marker);
    if (marker.geometry) marker.geometry.dispose();
    if (marker.material) marker.material.dispose();
  });
  measurementMarkers.length = 0;
  savedMeasurementObjects.length = 0;
};

const removeSavedMeasurement = (index) => {
  if (!scene.value || index < 0 || index >= savedMeasurementObjects.length) return;
  
  // Remove all objects belonging to this measurement from the scene
  const measurementGroup = savedMeasurementObjects[index];
  measurementGroup.forEach(obj => {
    scene.value.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  
  // Remove the group from the array
  savedMeasurementObjects.splice(index, 1);
};

const handleMeasurementClick = (event) => {
  if (!currentMeasurementMode || !scene.value || !camera.value) return;
  
  // Don't register click if mouse moved significantly (camera was being rotated)
  const dx = event.clientX - mouseDownPosition.x;
  const dy = event.clientY - mouseDownPosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 5) { // 5 pixel threshold
    return; // Mouse moved too much, this was a drag not a click
  }

  // Calculate mouse position in normalized device coordinates
  const rect = viewerRef.value.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera.value);

  // Find intersections with scene objects
  const intersects = raycaster.intersectObjects(scene.value.children, true);
  
  if (intersects.length > 0) {
    const point = intersects[0].point;
    currentMeasurementPoints.push(point);

    // Add visual marker
    const markerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      depthTest: false,
      depthWrite: false
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(point);
    marker.name = 'currentMeasurementMarker';
    marker.renderOrder = 999; // Render on top
    scene.value.add(marker);
    measurementMarkers.push(marker);

    // Draw lines between points
    if (currentMeasurementPoints.length > 1) {
      // Connect last two points
      const linePoints = [
        currentMeasurementPoints[currentMeasurementPoints.length - 2], 
        point
      ];

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xff0000, 
        linewidth: 2,
        depthTest: false,
        depthWrite: false
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.name = 'currentMeasurementMarker';
      line.renderOrder = 999; // Render on top
      scene.value.add(line);
      measurementMarkers.push(line);
    }
    
    // For area measurements, also draw closing line to first point
    if (currentMeasurementMode === 'area' && currentMeasurementPoints.length >= 2) {
      // Remove the previous closing line if it exists
      if (currentClosingLine) {
        scene.value.remove(currentClosingLine);
        if (currentClosingLine.geometry) currentClosingLine.geometry.dispose();
        if (currentClosingLine.material) currentClosingLine.material.dispose();
        const index = measurementMarkers.indexOf(currentClosingLine);
        if (index > -1) measurementMarkers.splice(index, 1);
      }
      
      // Create new closing line
      const closingLinePoints = [point, currentMeasurementPoints[0]];
      const closingLineGeometry = new THREE.BufferGeometry().setFromPoints(closingLinePoints);
      const closingLineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xff0000, 
        linewidth: 2,
        opacity: 0.7,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      currentClosingLine = new THREE.Line(closingLineGeometry, closingLineMaterial);
      currentClosingLine.name = 'currentMeasurementMarker';
      currentClosingLine.renderOrder = 999; // Render on top
      scene.value.add(currentClosingLine);
      measurementMarkers.push(currentClosingLine);
    }

    // Calculate and report measurement
    let value = null;
    let complete = false;

    if (currentMeasurementMode === 'distance' && currentMeasurementPoints.length >= 2) {
      // Calculate total distance for multi-segment line
      let totalDistance = 0;
      for (let i = 1; i < currentMeasurementPoints.length; i++) {
        const p1 = currentMeasurementPoints[i - 1];
        const p2 = currentMeasurementPoints[i];
        const segmentDistance = Math.sqrt(
          Math.pow(p2.x - p1.x, 2) + 
          Math.pow(p2.y - p1.y, 2) + 
          Math.pow(p2.z - p1.z, 2)
        );
        totalDistance += segmentDistance;
      }
      value = `${totalDistance.toFixed(2)} m`;
    } else if (currentMeasurementMode === 'area' && currentMeasurementPoints.length >= 3) {
      // Simple polygon area calculation (assumes planar polygon on XY plane)
      let area = 0;
      for (let i = 0; i < currentMeasurementPoints.length; i++) {
        const j = (i + 1) % currentMeasurementPoints.length;
        area += currentMeasurementPoints[i].x * currentMeasurementPoints[j].y;
        area -= currentMeasurementPoints[j].x * currentMeasurementPoints[i].y;
      }
      area = Math.abs(area / 2);
      value = `${area.toFixed(2)} m²`;
    }

    // Call callback with measurement data
    if (measurementCallback) {
      measurementCallback({
        pointsCount: currentMeasurementPoints.length,
        value,
        complete
      });
    }

    // Don't auto-reset - let user continue or manually save
  }
};

const saveCurrentMeasurement = () => {
  if (!currentMeasurementMode || currentMeasurementPoints.length === 0) return;
  
  let value = null;
  
  if (currentMeasurementMode === 'distance' && currentMeasurementPoints.length >= 2) {
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 1; i < currentMeasurementPoints.length; i++) {
      const p1 = currentMeasurementPoints[i - 1];
      const p2 = currentMeasurementPoints[i];
      const segmentDistance = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + 
        Math.pow(p2.y - p1.y, 2) + 
        Math.pow(p2.z - p1.z, 2)
      );
      totalDistance += segmentDistance;
    }
    value = `${totalDistance.toFixed(2)} m`;
  } else if (currentMeasurementMode === 'area' && currentMeasurementPoints.length >= 3) {
    // Calculate area
    let area = 0;
    for (let i = 0; i < currentMeasurementPoints.length; i++) {
      const j = (i + 1) % currentMeasurementPoints.length;
      area += currentMeasurementPoints[i].x * currentMeasurementPoints[j].y;
      area -= currentMeasurementPoints[j].x * currentMeasurementPoints[i].y;
    }
    area = Math.abs(area / 2);
    value = `${area.toFixed(2)} m²`;
  }
  
  if (value && measurementCallback) {
    // Convert current markers to saved markers and group them
    const measurementGroup = [];
    measurementMarkers.forEach(marker => {
      marker.name = 'savedMeasurementMarker';
      measurementGroup.push(marker);
    });
    // Store this group of objects for this measurement
    savedMeasurementObjects.push(measurementGroup);
    
    measurementCallback({
      pointsCount: currentMeasurementPoints.length,
      value,
      complete: true  // Mark as complete to save it
    });
  }
  
  // Clear for next measurement (but don't remove visual markers)
  currentMeasurementPoints = [];
  measurementMarkers.length = 0;
};

const undoLastPoint = () => {
  if (currentMeasurementPoints.length === 0) return;
  
  // Remove last point
  currentMeasurementPoints.pop();
  
  // Redraw all markers and lines
  clearCurrentMeasurementMarkers();
  
  // Redraw all points and lines
  for (let i = 0; i < currentMeasurementPoints.length; i++) {
    const point = currentMeasurementPoints[i];
    
    // Add marker
    const markerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      depthTest: false,
      depthWrite: false
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(point);
    marker.name = 'currentMeasurementMarker';
    marker.renderOrder = 999;
    scene.value.add(marker);
    measurementMarkers.push(marker);
    
    // Add line from previous point
    if (i > 0) {
      const linePoints = [currentMeasurementPoints[i - 1], point];
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xff0000, 
        linewidth: 2,
        depthTest: false,
        depthWrite: false
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.name = 'currentMeasurementMarker';
      line.renderOrder = 999;
      scene.value.add(line);
      measurementMarkers.push(line);
    }
  }
  
  // Add closing line for area if we have at least 2 points
  if (currentMeasurementMode === 'area' && currentMeasurementPoints.length >= 2) {
    // Remove old closing line if exists
    if (currentClosingLine) {
      scene.value.remove(currentClosingLine);
      if (currentClosingLine.geometry) currentClosingLine.geometry.dispose();
      if (currentClosingLine.material) currentClosingLine.material.dispose();
      const index = measurementMarkers.indexOf(currentClosingLine);
      if (index > -1) measurementMarkers.splice(index, 1);
    }
    
    const closingLinePoints = [
      currentMeasurementPoints[currentMeasurementPoints.length - 1],
      currentMeasurementPoints[0]
    ];
    const closingLineGeometry = new THREE.BufferGeometry().setFromPoints(closingLinePoints);
    const closingLineMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff0000, 
      linewidth: 2,
      opacity: 0.7,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    currentClosingLine = new THREE.Line(closingLineGeometry, closingLineMaterial);
    currentClosingLine.name = 'currentMeasurementMarker';
    currentClosingLine.renderOrder = 999;
    scene.value.add(currentClosingLine);
    measurementMarkers.push(currentClosingLine);
  }
  
  // Update callback with new values
  if (measurementCallback) {
    let value = null;
    
    if (currentMeasurementMode === 'distance' && currentMeasurementPoints.length >= 2) {
      let totalDistance = 0;
      for (let i = 1; i < currentMeasurementPoints.length; i++) {
        const p1 = currentMeasurementPoints[i - 1];
        const p2 = currentMeasurementPoints[i];
        const segmentDistance = Math.sqrt(
          Math.pow(p2.x - p1.x, 2) + 
          Math.pow(p2.y - p1.y, 2) + 
          Math.pow(p2.z - p1.z, 2)
        );
        totalDistance += segmentDistance;
      }
      value = `${totalDistance.toFixed(2)} m`;
    } else if (currentMeasurementMode === 'area' && currentMeasurementPoints.length >= 3) {
      let area = 0;
      for (let i = 0; i < currentMeasurementPoints.length; i++) {
        const j = (i + 1) % currentMeasurementPoints.length;
        area += currentMeasurementPoints[i].x * currentMeasurementPoints[j].y;
        area -= currentMeasurementPoints[j].x * currentMeasurementPoints[i].y;
      }
      area = Math.abs(area / 2);
      value = `${area.toFixed(2)} m²`;
    }
    
    measurementCallback({
      pointsCount: currentMeasurementPoints.length,
      value,
      complete: false
    });
  }
};

const cancelCurrentMeasurement = () => {
  currentMeasurementPoints = [];
  currentClosingLine = null;
  clearCurrentMeasurementMarkers();
  
  if (measurementCallback) {
    measurementCallback({
      pointsCount: 0,
      value: null,
      complete: false
    });
  }
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
  clearAllMeasurements();
  cleanup();
});

// Watch for measurement mode changes
watch(measurementMode, (newMode) => {
  if (!newMode) {
    clearCurrentMeasurementMarkers();
  }
});

// Watch for theme changes and update scene background
watch(theme, (newTheme) => {
  if (scene.value) {
    scene.value.background = new THREE.Color(newTheme === 'dark' ? 0x1a1a1a : 0x87ceeb);
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
  disableMeasurementMode,
  clearMeasurements,
  saveCurrentMeasurement,
  undoLastPoint,
  cancelCurrentMeasurement,
  removeSavedMeasurement,
  setCameraPreset,
  resetToInitialCamera,
  zoomToLayer
});
</script>

<style scoped>
.viewer-canvas {
  width: 100%;
  height: 100%;
}
</style>