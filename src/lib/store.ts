import { create } from "zustand";

interface AppState {
  // Map state
  waterLevel: number;
  mapCenter: [number, number];
  mapZoom: number;

  // UI state
  selectedPreset: string | null;
  isExporting: boolean;
  legendVisible: boolean;

  // Actions
  setWaterLevel: (level: number) => void;
  setMapView: (center: [number, number], zoom: number) => void;
  setSelectedPreset: (preset: string | null) => void;
  setIsExporting: (exporting: boolean) => void;
  setLegendVisible: (visible: boolean) => void;
}

export const useStore = create<AppState>()((set) => ({
  // Initial state
  waterLevel: 0,
  mapCenter: [-122.4194, 37.7749], // San Francisco coordinates
  mapZoom: 12,
  selectedPreset: null,
  isExporting: false,
  legendVisible: true,

  // Actions
  setWaterLevel: (level) =>
    set({ waterLevel: Math.max(0, Math.min(200, level)) }),
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),
  setSelectedPreset: (preset) => set({ selectedPreset: preset }),
  setIsExporting: (exporting) => set({ isExporting: exporting }),
  setLegendVisible: (visible) => set({ legendVisible: visible }),
}));
