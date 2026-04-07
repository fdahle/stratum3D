import { defineStore } from 'pinia';
import { ref } from 'vue';

export const usePinStore = defineStore('pins', () => {
  const pins = ref([]); // [{ id, label, coordinate: [x, y] }]

  const addPin = (coordinate, label) => {
    const id = crypto.randomUUID();
    pins.value.push({ id, label: label.trim() || 'Pin', coordinate: [...coordinate] });
    return id;
  };

  const removePin = (id) => {
    pins.value = pins.value.filter(p => p.id !== id);
  };

  const updatePin = (id, label) => {
    const pin = pins.value.find(p => p.id === id);
    if (pin) pin.label = label.trim() || 'Pin';
  };

  const setPins = (newPins) => {
    pins.value = newPins.map(p => ({ id: p.id, label: p.label, coordinate: [...p.coordinate] }));
  };

  const clearPins = () => {
    pins.value = [];
  };

  return { pins, addPin, removePin, updatePin, setPins, clearPins };
});
