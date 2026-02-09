import { ref, shallowRef } from 'vue';

// Shared Three.js objects (use shallowRef to avoid deep reactivity on Three.js objects)
const scene = shallowRef(null);
const camera = shallowRef(null);
const renderer = shallowRef(null);
const controls = shallowRef(null);

// Models and scene state
const loadedModels = ref([]);
const initialCameraPosition = ref(null);
const initialCameraTarget = ref(null);

// View settings
const showWireframe = ref(false);
const showBoundingBox = ref(true);
const showGrid = ref(true);

// Measurement state
const measurementMode = ref(null); // null, 'distance', 'area'
const measurements = ref([]);
const measurementPoints = ref([]);

export const useViewer3D = () => {
  // Scene management
  const setScene = (newScene) => {
    scene.value = newScene;
  };

  const setCamera = (newCamera) => {
    camera.value = newCamera;
  };

  const setRenderer = (newRenderer) => {
    renderer.value = newRenderer;
  };

  const setControls = (newControls) => {
    controls.value = newControls;
  };

  // Model management
  const addModel = (model) => {
    loadedModels.value.push(model);
  };

  const clearModels = () => {
    // Remove models from scene
    loadedModels.value.forEach(model => {
      if (scene.value) {
        scene.value.remove(model);
      }
    });
    loadedModels.value = [];
  };

  // Camera management
  const storeInitialCamera = () => {
    if (camera.value && controls.value) {
      initialCameraPosition.value = camera.value.position.clone();
      initialCameraTarget.value = controls.value.target.clone();
    }
  };

  const resetCamera = () => {
    if (camera.value && controls.value && initialCameraPosition.value && initialCameraTarget.value) {
      camera.value.position.copy(initialCameraPosition.value);
      controls.value.target.copy(initialCameraTarget.value);
      controls.value.update();
    }
  };

  // View settings
  const toggleWireframe = () => {
    showWireframe.value = !showWireframe.value;
    loadedModels.value.forEach(model => {
      model.traverse((child) => {
        if (child.isMesh) {
          child.material.wireframe = showWireframe.value;
        }
      });
    });
  };

  const toggleBoundingBox = () => {
    showBoundingBox.value = !showBoundingBox.value;
    if (scene.value) {
      const boxHelper = scene.value.getObjectByName('boxHelper');
      if (boxHelper) {
        boxHelper.visible = showBoundingBox.value;
      }
    }
  };

  const toggleGrid = () => {
    showGrid.value = !showGrid.value;
    if (scene.value) {
      const grid = scene.value.getObjectByName('gridHelper');
      const axes = scene.value.getObjectByName('axesHelper');
      if (grid) grid.visible = showGrid.value;
      if (axes) axes.visible = showGrid.value;
    }
  };

  // Measurement management
  const startMeasurement = (mode) => {
    measurementMode.value = mode;
    measurementPoints.value = [];
  };

  const addMeasurementPoint = (point) => {
    measurementPoints.value.push(point);
  };

  const completeMeasurement = (measurement) => {
    measurements.value.push(measurement);
    measurementMode.value = null;
    measurementPoints.value = [];
  };

  const cancelMeasurement = () => {
    measurementMode.value = null;
    measurementPoints.value = [];
  };

  const clearMeasurements = () => {
    measurements.value = [];
    measurementPoints.value = [];
  };

  const removeMeasurement = (index) => {
    measurements.value.splice(index, 1);
  };

  // Cleanup
  const cleanup = () => {
    // Dispose models properly
    loadedModels.value.forEach(model => {
      model.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      if (scene.value) {
        scene.value.remove(model);
      }
    });
    loadedModels.value = [];
    
    clearMeasurements();
    
    // Dispose renderer
    if (renderer.value) {
      renderer.value.dispose();
      renderer.value = null;
    }
    
    // Clear references
    scene.value = null;
    camera.value = null;
    controls.value = null;
  };

  return {
    // Three.js objects
    scene,
    camera,
    renderer,
    controls,
    setScene,
    setCamera,
    setRenderer,
    setControls,

    // Models
    loadedModels,
    addModel,
    clearModels,

    // Camera
    initialCameraPosition,
    initialCameraTarget,
    storeInitialCamera,
    resetCamera,

    // View settings
    showWireframe,
    showBoundingBox,
    showGrid,
    toggleWireframe,
    toggleBoundingBox,
    toggleGrid,

    // Measurements
    measurementMode,
    measurements,
    measurementPoints,
    startMeasurement,
    addMeasurementPoint,
    completeMeasurement,
    cancelMeasurement,
    clearMeasurements,
    removeMeasurement,

    // Cleanup
    cleanup
  };
};