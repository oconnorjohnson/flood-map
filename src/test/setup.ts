// Test setup for vitest
import { vi } from "vitest";
import "@testing-library/jest-dom";

// Mock mapbox-gl
vi.mock("mapbox-gl", () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      addControl: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn(),
      getLayer: vi.fn(),
      getStyle: vi.fn(() => ({ name: "Test Style" })),
      setTerrain: vi.fn(),
      setPaintProperty: vi.fn(),
      setFeatureState: vi.fn(),
      getCanvas: vi.fn(() => ({ style: { cursor: "" } })),
      triggerRepaint: vi.fn(),
      remove: vi.fn(),
    })),
    NavigationControl: vi.fn(),
    accessToken: "",
  },
  LngLatBounds: vi.fn(() => ({
    getNorthEast: vi.fn(),
    getSouthWest: vi.fn(),
  })),
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
