<template>
  <div class="measurement-tools">
    <h3>📏 Measurements</h3>

    <div v-if="!measurementMode" class="measurement-modes">
      <button @click="startDistance" class="mode-btn">
        📐 Distance
      </button>
      <button @click="startArea" class="mode-btn">
        📐 Area
      </button>
      <button @click="startVolume" class="mode-btn" disabled>
        📦 Volume (Coming Soon)
      </button>
    </div>

    <div v-else class="active-measurement">
      <div class="measurement-header">
        <strong>{{ measurementModeLabel }}</strong>
        <button @click="cancelMeasurement" class="cancel-btn">✕</button>
      </div>
      
      <div class="measurement-instructions">
        <p>{{ instructions }}</p>
        <div class="points-info">
          Points: {{ measurementPoints.length }} / {{ requiredPoints }}
        </div>
      </div>

      <div v-if="currentMeasurementValue" class="current-value">
        <strong>{{ currentMeasurementValue }}</strong>
      </div>

      <button 
        v-if="canCompleteMeasurement"
        @click="completeMeasurement" 
        class="complete-btn"
      >
        ✓ Complete Measurement
      </button>
    </div>

    <div v-if="measurements.length > 0" class="measurements-list">
      <h4>Saved Measurements</h4>
      <div 
        v-for="(measurement, index) in measurements" 
        :key="index"
        class="measurement-item"
      >
        <div class="measurement-content">
          <span class="measurement-type">{{ measurement.type }}</span>
          <span class="measurement-value">{{ measurement.value }}</span>
        </div>
        <button @click="removeMeasurement(index)" class="remove-btn">
          🗑️
        </button>
      </div>
      <button @click="clearAllMeasurements" class="clear-all-btn">
        Clear All
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useViewer3D } from '@/composables/useViewer3D.js';

const emit = defineEmits(['measurement-started', 'measurement-complete', 'measurement-cancelled']);

const {
  measurementMode,
  measurements,
  measurementPoints,
  startMeasurement,
  completeMeasurement: completeInComposable,
  cancelMeasurement: cancelInComposable,
  clearMeasurements,
  removeMeasurement: removeInComposable
} = useViewer3D();

const measurementModeLabel = computed(() => {
  switch (measurementMode.value) {
    case 'distance':
      return '📐 Distance Measurement';
    case 'area':
      return '📐 Area Measurement';
    case 'volume':
      return '📦 Volume Measurement';
    default:
      return '';
  }
});

const instructions = computed(() => {
  switch (measurementMode.value) {
    case 'distance':
      return 'Click two points to measure distance';
    case 'area':
      return 'Click points to define an area (minimum 3 points)';
    case 'volume':
      return 'Click points to define a volume';
    default:
      return '';
  }
});

const requiredPoints = computed(() => {
  switch (measurementMode.value) {
    case 'distance':
      return 2;
    case 'area':
      return '3+';
    case 'volume':
      return '4+';
    default:
      return 0;
  }
});

const canCompleteMeasurement = computed(() => {
  switch (measurementMode.value) {
    case 'distance':
      return measurementPoints.value.length === 2;
    case 'area':
      return measurementPoints.value.length >= 3;
    case 'volume':
      return measurementPoints.value.length >= 4;
    default:
      return false;
  }
});

const currentMeasurementValue = computed(() => {
  if (!measurementMode.value || measurementPoints.value.length === 0) {
    return null;
  }

  // Calculate preview value based on current points
  switch (measurementMode.value) {
    case 'distance':
      if (measurementPoints.value.length === 2) {
        const distance = calculateDistance(
          measurementPoints.value[0],
          measurementPoints.value[1]
        );
        return `${distance.toFixed(2)} m`;
      }
      return null;
    
    case 'area':
      if (measurementPoints.value.length >= 3) {
        const area = calculateArea(measurementPoints.value);
        return `${area.toFixed(2)} m²`;
      }
      return null;
    
    default:
      return null;
  }
});

const startDistance = () => {
  startMeasurement('distance');
  emit('measurement-started', 'distance');
};

const startArea = () => {
  startMeasurement('area');
  emit('measurement-started', 'area');
};

const startVolume = () => {
  startMeasurement('volume');
  emit('measurement-started', 'volume');
};

const completeMeasurement = () => {
  let value = '';
  
  switch (measurementMode.value) {
    case 'distance':
      if (measurementPoints.value.length === 2) {
        const distance = calculateDistance(
          measurementPoints.value[0],
          measurementPoints.value[1]
        );
        value = `${distance.toFixed(2)} m`;
      }
      break;
    
    case 'area':
      if (measurementPoints.value.length >= 3) {
        const area = calculateArea(measurementPoints.value);
        value = `${area.toFixed(2)} m²`;
      }
      break;
  }

  const measurement = {
    type: measurementMode.value,
    value,
    points: [...measurementPoints.value],
    timestamp: new Date().toISOString()
  };

  completeInComposable(measurement);
  emit('measurement-complete', measurement);
};

const cancelMeasurement = () => {
  cancelInComposable();
  emit('measurement-cancelled');
};

const clearAllMeasurements = () => {
  if (confirm('Clear all measurements?')) {
    clearMeasurements();
  }
};

const removeMeasurement = (index) => {
  removeInComposable(index);
};

// Helper functions for calculations
const calculateDistance = (point1, point2) => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z - point1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const calculateArea = (points) => {
  // Simple polygon area calculation (assumes planar polygon)
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
};
</script>

<style scoped>
.measurement-tools {
  position: absolute;
  top: 80px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 13px;
  max-width: 320px;
  min-width: 280px;
  z-index: 800;
  backdrop-filter: blur(10px);
}

.theme-dark .measurement-tools {
  background: rgba(42, 42, 42, 0.95);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.measurement-tools h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.theme-dark .measurement-tools h3 {
  color: #e0e0e0;
}

.measurement-modes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-btn {
  padding: 10px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  text-align: left;
}

.mode-btn:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 123, 255, 0.3);
}

.mode-btn:disabled {
  background: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
}

.active-measurement {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 2px solid #007bff;
}

.theme-dark .active-measurement {
  background: #3a3a3a;
  border: 2px solid #4a9eff;
}

.measurement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.measurement-header strong {
  color: #007bff;
  font-size: 14px;
}

.cancel-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #c82333;
  transform: scale(1.1);
}

.measurement-instructions {
  margin-bottom: 12px;
}

.measurement-instructions p {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 12px;
  line-height: 1.5;
}

.theme-dark .measurement-instructions p {
  color: #999;
}

.points-info {
  display: inline-block;
  padding: 4px 8px;
  background: white;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #007bff;
  border: 1px solid #007bff;
}

.current-value {
  padding: 12px;
  background: white;
  border-radius: 4px;
  text-align: center;
  margin: 12px 0;
  border: 1px solid #28a745;
}

.theme-dark .current-value {
  background: #2a2a2a;
  border: 1px solid #5cb85c;
}

.current-value strong {
  color: #28a745;
  font-size: 18px;
}

.complete-btn {
  width: 100%;
  padding: 10px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.complete-btn:hover {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(40, 167, 69, 0.3);
}

.measurements-list {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
}

.theme-dark .measurements-list {
  border-top: 2px solid #444;
}

.measurements-list h4 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.theme-dark .measurements-list h4 {
  color: #e0e0e0;
}

.measurement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 8px;
}

.theme-dark .measurement-item {
  background: #3a3a3a;
}

.measurement-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.measurement-type {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  font-weight: 600;
}

.theme-dark .measurement-type {
  color: #999;
}

.measurement-value {
  font-size: 14px;
  color: #333;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.theme-dark .measurement-value {
  color: #e0e0e0;
}

.remove-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  opacity: 0.6;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  opacity: 1;
  transform: scale(1.2);
}

.clear-all-btn {
  width: 100%;
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 8px;
  transition: all 0.2s ease;
}

.clear-all-btn:hover {
  background: #5a6268;
}
</style>