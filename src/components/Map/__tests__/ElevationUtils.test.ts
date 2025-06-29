import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateBuildingFloodDepth,
  rgbToElevation,
  getElevationAtPoint,
  sampleElevation,
  getOptimalResolution,
  isInViewport,
  getTerrainTileKey,
  TerrainCache,
  BuildingFloodInfo,
} from "../ElevationUtils";
import mapboxgl from "mapbox-gl";

describe("ElevationUtils", () => {
  describe("calculateBuildingFloodDepth", () => {
    it("should return not flooded when water level is below ground", () => {
      const building = {
        id: 1,
        properties: {
          base_height: 10,
          height: 30,
        },
      } as unknown as mapboxgl.MapboxGeoJSONFeature;

      const result = calculateBuildingFloodDepth(building, 5);

      expect(result.flooded).toBe(false);
      expect(result.depth).toBe(0);
      expect(result.percentFlooded).toBe(0);
      expect(result.floorsAffected).toBe(0);
    });

    it("should calculate flood depth correctly", () => {
      const building = {
        id: 1,
        properties: {
          base_height: 5,
          height: 30,
        },
      } as unknown as mapboxgl.MapboxGeoJSONFeature;

      const result = calculateBuildingFloodDepth(building, 15);

      expect(result.flooded).toBe(true);
      expect(result.depth).toBe(10);
      expect(result.percentFlooded).toBeCloseTo(0.333, 3);
      expect(result.floorsAffected).toBe(3);
    });

    it("should cap percent flooded at 100%", () => {
      const building = {
        id: 1,
        properties: {
          base_height: 0,
          height: 10,
        },
      } as unknown as mapboxgl.MapboxGeoJSONFeature;

      const result = calculateBuildingFloodDepth(building, 50);

      expect(result.flooded).toBe(true);
      expect(result.depth).toBe(50);
      expect(result.percentFlooded).toBe(1.0);
      expect(result.floorsAffected).toBe(16); // 50m / 3m per floor
    });

    it("should handle missing properties", () => {
      const building = {
        id: 1,
        properties: {},
      } as mapboxgl.MapboxGeoJSONFeature;

      const result = calculateBuildingFloodDepth(building, 10);

      expect(result.flooded).toBe(true);
      expect(result.depth).toBe(10);
      expect(result.groundElevation).toBe(0);
      expect(result.buildingHeight).toBe(0);
    });
  });

  describe("rgbToElevation", () => {
    it("should convert RGB to elevation correctly", () => {
      // Test known values
      expect(rgbToElevation(0, 0, 0)).toBe(-10000);
      // Max elevation: -10000 + ((255 * 256 * 256 + 255 * 256 + 255) * 0.1) = 1667721.5
      expect(rgbToElevation(255, 255, 255)).toBeCloseTo(1667721.5, 1);

      // Test mid-range value
      const elevation = rgbToElevation(128, 128, 128);
      expect(elevation).toBeGreaterThan(-10000);
      expect(elevation).toBeLessThan(1667721.5);
    });
  });

  describe("getElevationAtPoint", () => {
    it("should get elevation from terrain data", () => {
      // Create test terrain data (4x4 pixels, RGBA)
      const terrainData = new Uint8Array(4 * 4 * 4);

      // Set pixel at (1, 1) to RGB(100, 50, 25)
      const index = (1 * 4 + 1) * 4;
      terrainData[index] = 100;
      terrainData[index + 1] = 50;
      terrainData[index + 2] = 25;
      terrainData[index + 3] = 255;

      const elevation = getElevationAtPoint(terrainData, 1, 1, 4, 4);
      const expected = rgbToElevation(100, 50, 25);

      expect(elevation).toBeCloseTo(expected, 1);
    });

    it("should clamp coordinates to bounds", () => {
      const terrainData = new Uint8Array(4 * 4 * 4);

      // Set corner pixel
      terrainData[0] = 50;
      terrainData[1] = 50;
      terrainData[2] = 50;

      // Test out of bounds coordinates
      const elevation1 = getElevationAtPoint(terrainData, -1, -1, 4, 4);
      const elevation2 = getElevationAtPoint(terrainData, 0, 0, 4, 4);

      expect(elevation1).toBe(elevation2);

      // Test upper bounds
      const elevation3 = getElevationAtPoint(terrainData, 10, 10, 4, 4);
      const elevation4 = getElevationAtPoint(terrainData, 3, 3, 4, 4);

      expect(elevation3).toBe(elevation4);
    });
  });

  describe("sampleElevation", () => {
    it("should average multiple elevation samples", () => {
      // Create test terrain data with known values
      const terrainData = new Uint8Array(10 * 10 * 4);

      // Set different elevations at sample points
      const setPixel = (
        x: number,
        y: number,
        r: number,
        g: number,
        b: number
      ) => {
        const index = (y * 10 + x) * 4;
        terrainData[index] = r;
        terrainData[index + 1] = g;
        terrainData[index + 2] = b;
        terrainData[index + 3] = 255;
      };

      // Set corners and center with different values
      setPixel(2, 2, 100, 0, 0); // Top-left
      setPixel(7, 2, 150, 0, 0); // Top-right
      setPixel(2, 7, 120, 0, 0); // Bottom-left
      setPixel(7, 7, 130, 0, 0); // Bottom-right
      setPixel(4, 4, 125, 0, 0); // Center (adjusted for actual center)

      const bounds = { x: 2, y: 2, width: 5, height: 5 };
      const avgElevation = sampleElevation(terrainData, bounds, 10, 10);

      // Calculate expected average
      // Note: sampleElevation samples at 5 points:
      // (2,2), (7,2), (2,7), (7,7), and center at (4.5,4.5) which rounds to (4,4)
      const elevations = [100, 150, 120, 130, 125].map((r) =>
        rgbToElevation(r, 0, 0)
      );
      const expected = elevations.reduce((a, b) => a + b) / elevations.length;

      expect(avgElevation).toBeCloseTo(expected, 1);
    });
  });

  describe("getOptimalResolution", () => {
    it("should return appropriate resolution for zoom levels", () => {
      expect(getOptimalResolution(16)).toBe(256);
      expect(getOptimalResolution(15)).toBe(128);
      expect(getOptimalResolution(13)).toBe(128);
      expect(getOptimalResolution(12)).toBe(64);
      expect(getOptimalResolution(11)).toBe(64);
      expect(getOptimalResolution(10)).toBe(32);
      expect(getOptimalResolution(5)).toBe(32);
    });
  });

  describe("isInViewport", () => {
    it("should detect overlapping bounds", () => {
      // Create mock bounds objects
      const bounds1 = {
        getNorthEast: () => ({ lng: -122.4, lat: 37.8 } as mapboxgl.LngLat),
        getSouthWest: () => ({ lng: -122.5, lat: 37.7 } as mapboxgl.LngLat),
      } as mapboxgl.LngLatBounds;

      const bounds2 = {
        getNorthEast: () => ({ lng: -122.35, lat: 37.85 } as mapboxgl.LngLat),
        getSouthWest: () => ({ lng: -122.45, lat: 37.75 } as mapboxgl.LngLat),
      } as mapboxgl.LngLatBounds;

      expect(isInViewport(bounds1, bounds2)).toBe(true);
    });

    it("should detect non-overlapping bounds", () => {
      // Create mock bounds objects
      const bounds1 = {
        getNorthEast: () => ({ lng: -122.4, lat: 37.8 } as mapboxgl.LngLat),
        getSouthWest: () => ({ lng: -122.5, lat: 37.7 } as mapboxgl.LngLat),
      } as mapboxgl.LngLatBounds;

      const bounds2 = {
        getNorthEast: () => ({ lng: -122.2, lat: 37.95 } as mapboxgl.LngLat),
        getSouthWest: () => ({ lng: -122.3, lat: 37.85 } as mapboxgl.LngLat),
      } as mapboxgl.LngLatBounds;

      expect(isInViewport(bounds1, bounds2)).toBe(false);
    });
  });

  describe("getTerrainTileKey", () => {
    it("should generate correct tile keys", () => {
      expect(getTerrainTileKey(10, 163, 395)).toBe("10/163/395");
      expect(getTerrainTileKey(0, 0, 0)).toBe("0/0/0");
      expect(getTerrainTileKey(15, 5242, 12663)).toBe("15/5242/12663");
    });
  });

  describe("TerrainCache", () => {
    let cache: TerrainCache;

    beforeEach(() => {
      cache = new TerrainCache(3);
    });

    it("should store and retrieve data", () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      cache.set("test-key", data);

      const retrieved = cache.get("test-key");
      expect(retrieved).toEqual(data);
    });

    it("should return undefined for missing keys", () => {
      expect(cache.get("missing-key")).toBeUndefined();
    });

    it("should update LRU order on get", () => {
      const data1 = new Uint8Array([1]);
      const data2 = new Uint8Array([2]);
      const data3 = new Uint8Array([3]);
      const data4 = new Uint8Array([4]);

      cache.set("key1", data1);
      cache.set("key2", data2);
      cache.set("key3", data3);

      // Access key1 to make it most recently used
      cache.get("key1");

      // Add key4, should evict key2 (oldest that wasn't accessed)
      cache.set("key4", data4);

      expect(cache.get("key1")).toEqual(data1);
      expect(cache.get("key2")).toBeUndefined();
      expect(cache.get("key3")).toEqual(data3);
      expect(cache.get("key4")).toEqual(data4);
    });

    it("should respect max size", () => {
      const cache = new TerrainCache(2);

      cache.set("key1", new Uint8Array([1]));
      cache.set("key2", new Uint8Array([2]));
      cache.set("key3", new Uint8Array([3]));

      expect(cache.size()).toBe(2);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeDefined();
      expect(cache.get("key3")).toBeDefined();
    });

    it("should clear all entries", () => {
      cache.set("key1", new Uint8Array([1]));
      cache.set("key2", new Uint8Array([2]));

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
    });
  });
});
