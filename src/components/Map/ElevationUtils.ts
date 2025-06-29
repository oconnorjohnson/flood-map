import mapboxgl from "mapbox-gl";

// Interface for building flood analysis
export interface BuildingFloodInfo {
  flooded: boolean;
  depth: number;
  percentFlooded: number;
  floorsAffected: number;
  buildingId?: string | number;
  buildingHeight?: number;
  groundElevation?: number;
}

// Calculate building flood impact based on water level
export function calculateBuildingFloodDepth(
  building: mapboxgl.MapboxGeoJSONFeature,
  waterLevel: number
): BuildingFloodInfo {
  // Get building properties
  const groundElevation =
    building.properties?.base_height || building.properties?.min_height || 0;
  const buildingHeight = building.properties?.height || 0;
  const buildingId = building.id;

  // Check if building is flooded
  if (waterLevel <= groundElevation) {
    return {
      flooded: false,
      depth: 0,
      percentFlooded: 0,
      floorsAffected: 0,
      buildingId,
      buildingHeight,
      groundElevation,
    };
  }

  // Calculate flood depth
  const floodDepth = waterLevel - groundElevation;
  const percentFlooded = Math.min(floodDepth / buildingHeight, 1.0);

  // Estimate floors affected (assuming 3m per floor)
  const floorsAffected = Math.floor(floodDepth / 3.0);

  return {
    flooded: true,
    depth: floodDepth,
    percentFlooded: percentFlooded,
    floorsAffected: floorsAffected,
    buildingId,
    buildingHeight,
    groundElevation,
  };
}

// Convert terrain-RGB values to elevation in meters
export function rgbToElevation(r: number, g: number, b: number): number {
  // Mapbox Terrain-RGB formula
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

// Get elevation at a specific point from terrain-RGB data
export function getElevationAtPoint(
  terrainData: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  // Clamp coordinates
  x = Math.max(0, Math.min(width - 1, Math.floor(x)));
  y = Math.max(0, Math.min(height - 1, Math.floor(y)));

  // Get pixel index (RGBA format)
  const index = (y * width + x) * 4;

  const r = terrainData[index];
  const g = terrainData[index + 1];
  const b = terrainData[index + 2];

  return rgbToElevation(r, g, b);
}

// Sample elevation data at multiple points for averaging
export function sampleElevation(
  terrainData: Uint8Array,
  bounds: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
  samples: number = 4
): number {
  let totalElevation = 0;
  let sampleCount = 0;

  // Sample at corners and center
  const samplePoints = [
    { x: bounds.x, y: bounds.y }, // Top-left
    { x: bounds.x + bounds.width, y: bounds.y }, // Top-right
    { x: bounds.x, y: bounds.y + bounds.height }, // Bottom-left
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, // Bottom-right
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, // Center
  ];

  for (const point of samplePoints) {
    const elevation = getElevationAtPoint(
      terrainData,
      point.x,
      point.y,
      imageWidth,
      imageHeight
    );
    if (!isNaN(elevation)) {
      totalElevation += elevation;
      sampleCount++;
    }
  }

  return sampleCount > 0 ? totalElevation / sampleCount : 0;
}

// Get optimal mesh resolution based on zoom level
export function getOptimalResolution(zoom: number): number {
  if (zoom > 15) return 256;
  if (zoom > 12) return 128;
  if (zoom > 10) return 64;
  return 32;
}

// Check if a bounding box is visible in the current view
export function isInViewport(
  bounds: mapboxgl.LngLatBounds,
  viewBounds: mapboxgl.LngLatBounds
): boolean {
  // Check if bounds overlap
  const ne1 = bounds.getNorthEast();
  const sw1 = bounds.getSouthWest();
  const ne2 = viewBounds.getNorthEast();
  const sw2 = viewBounds.getSouthWest();

  return !(
    ne1.lng < sw2.lng ||
    sw1.lng > ne2.lng ||
    ne1.lat < sw2.lat ||
    sw1.lat > ne2.lat
  );
}

// Create a cache key for terrain tiles
export function getTerrainTileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

// Simple LRU cache for terrain data
export class TerrainCache {
  private cache: Map<string, Uint8Array>;
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: string): Uint8Array | undefined {
    const data = this.cache.get(key);
    if (data) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, data);
    }
    return data;
  }

  set(key: string, data: Uint8Array): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, data);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
