import { describe, it, expect, vi, beforeEach } from "vitest";
import { WaterVisualization } from "../WaterVisualization";

// Mock mapboxgl
vi.mock("mapbox-gl", () => ({
  default: {
    Map: vi.fn(),
  },
}));

describe("WaterVisualization", () => {
  let mockMap: any;

  beforeEach(() => {
    mockMap = {
      getSource: vi.fn(),
      addSource: vi.fn(),
      getLayer: vi.fn(),
      addLayer: vi.fn(),
      setPaintProperty: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
    };
  });

  it("should initialize with default water level of 61m", () => {
    const waterViz = new WaterVisualization(mockMap);
    expect(waterViz).toBeDefined();
  });

  it("should add source and layer on initialize", async () => {
    const waterViz = new WaterVisualization(mockMap, 61);

    mockMap.getSource.mockReturnValue(null);
    mockMap.getLayer.mockReturnValue(null);

    await waterViz.initialize();

    // Should check if source exists
    expect(mockMap.getSource).toHaveBeenCalledWith("water-fill-source");

    // Should add source
    expect(mockMap.addSource).toHaveBeenCalledWith("water-fill-source", {
      type: "geojson",
      data: expect.objectContaining({
        type: "FeatureCollection",
        features: expect.arrayContaining([
          expect.objectContaining({
            type: "Feature",
            properties: { waterLevel: 61 },
            geometry: {
              type: "Polygon",
              coordinates: expect.any(Array),
            },
          }),
        ]),
      }),
    });

    // Should add layer
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "water-fill-layer",
        type: "fill-extrusion",
        source: "water-fill-source",
        paint: expect.objectContaining({
          "fill-extrusion-height": 61,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.6,
        }),
      }),
      "3d-buildings"
    );
  });

  it("should update water level", () => {
    const waterViz = new WaterVisualization(mockMap, 50);

    mockMap.getLayer.mockReturnValue(true);

    waterViz.setWaterLevel(75);

    expect(mockMap.setPaintProperty).toHaveBeenCalledWith(
      "water-fill-layer",
      "fill-extrusion-height",
      75
    );
  });

  it("should remove layer and source on remove", () => {
    const waterViz = new WaterVisualization(mockMap);

    mockMap.getLayer.mockReturnValue(true);
    mockMap.getSource.mockReturnValue(true);

    waterViz.remove();

    expect(mockMap.removeLayer).toHaveBeenCalledWith("water-fill-layer");
    expect(mockMap.removeSource).toHaveBeenCalledWith("water-fill-source");
  });

  it("should not add source if it already exists", async () => {
    const waterViz = new WaterVisualization(mockMap);

    // Source already exists
    mockMap.getSource.mockReturnValue(true);
    mockMap.getLayer.mockReturnValue(null);

    await waterViz.initialize();

    // Should not add source again
    expect(mockMap.addSource).not.toHaveBeenCalled();

    // Should still add layer
    expect(mockMap.addLayer).toHaveBeenCalled();
  });
});
