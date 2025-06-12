// Flood simulation using actual elevation data
import mapboxgl from "mapbox-gl";

// Decode elevation from Mapbox terrain-rgb tiles
export function decodeElevation(r: number, g: number, b: number): number {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

// San Francisco bounds
const SF_BOUNDS = {
  north: 37.85,
  south: 37.7,
  east: -122.35,
  west: -122.55,
};

// Generate a grid of points across San Francisco
export function generateElevationGrid(
  resolution: number = 100
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const latStep = (SF_BOUNDS.north - SF_BOUNDS.south) / resolution;
  const lngStep = (SF_BOUNDS.east - SF_BOUNDS.west) / resolution;

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      const lat = SF_BOUNDS.south + i * latStep;
      const lng = SF_BOUNDS.west + j * lngStep;
      points.push([lng, lat]);
    }
  }

  return points;
}

// Create contour lines from elevation data
export function createContourLines(
  elevationData: Map<string, number>,
  waterLevel: number,
  resolution: number = 100
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  // Create a 2D array of elevation values
  const grid: number[][] = [];
  const latStep = (SF_BOUNDS.north - SF_BOUNDS.south) / resolution;
  const lngStep = (SF_BOUNDS.east - SF_BOUNDS.west) / resolution;

  for (let i = 0; i <= resolution; i++) {
    grid[i] = [];
    for (let j = 0; j <= resolution; j++) {
      const lat = SF_BOUNDS.south + i * latStep;
      const lng = SF_BOUNDS.west + j * lngStep;
      const key = `${lng},${lat}`;
      grid[i][j] = elevationData.get(key) || 0;
    }
  }

  // Use marching squares algorithm to find contour at water level
  const contours = marchingSquares(grid, waterLevel, SF_BOUNDS, resolution);

  // Convert contours to GeoJSON polygons
  for (const contour of contours) {
    if (contour.length > 3) {
      features.push({
        type: "Feature",
        properties: {
          elevation: waterLevel,
          type: "flood-boundary",
        },
        geometry: {
          type: "Polygon",
          coordinates: [contour],
        },
      });
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// Simplified marching squares algorithm for contour generation
function marchingSquares(
  grid: number[][],
  threshold: number,
  bounds: typeof SF_BOUNDS,
  resolution: number
): number[][][] {
  const contours: number[][][] = [];
  const visited = new Set<string>();

  const latStep = (bounds.north - bounds.south) / resolution;
  const lngStep = (bounds.east - bounds.west) / resolution;

  // Find all contour lines
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const key = `${i},${j}`;
      if (visited.has(key)) continue;

      // Check if this cell crosses the threshold
      const tl = grid[i][j];
      const tr = grid[i][j + 1] || 0;
      const bl = grid[i + 1]?.[j] || 0;
      const br = grid[i + 1]?.[j + 1] || 0;

      // Calculate case for marching squares
      let caseValue = 0;
      if (tl < threshold) caseValue |= 1;
      if (tr < threshold) caseValue |= 2;
      if (br < threshold) caseValue |= 4;
      if (bl < threshold) caseValue |= 8;

      // If all corners are above or below threshold, skip
      if (caseValue === 0 || caseValue === 15) continue;

      // Start a new contour from this cell
      const contour = traceContour(
        grid,
        threshold,
        i,
        j,
        visited,
        bounds,
        resolution
      );
      if (contour.length > 0) {
        contours.push(contour);
      }
    }
  }

  return contours;
}

// Trace a single contour line
function traceContour(
  grid: number[][],
  threshold: number,
  startI: number,
  startJ: number,
  visited: Set<string>,
  bounds: typeof SF_BOUNDS,
  resolution: number
): number[][] {
  const contour: number[][] = [];
  const latStep = (bounds.north - bounds.south) / resolution;
  const lngStep = (bounds.east - bounds.west) / resolution;

  let i = startI;
  let j = startJ;
  let direction = 0; // 0=right, 1=down, 2=left, 3=up

  // Trace the contour
  for (let steps = 0; steps < resolution * resolution; steps++) {
    const key = `${i},${j}`;
    if (visited.has(key) && steps > 0) break;
    visited.add(key);

    // Get corner values
    const tl = grid[i]?.[j] || 0;
    const tr = grid[i]?.[j + 1] || 0;
    const bl = grid[i + 1]?.[j] || 0;
    const br = grid[i + 1]?.[j + 1] || 0;

    // Interpolate edge crossings
    const lat = bounds.south + i * latStep;
    const lng = bounds.west + j * lngStep;

    // Add interpolated points where contour crosses cell edges
    if (tl < threshold !== tr < threshold) {
      const t = (threshold - tl) / (tr - tl);
      contour.push([lng + t * lngStep, lat]);
    }

    if (tr < threshold !== br < threshold) {
      const t = (threshold - tr) / (br - tr);
      contour.push([lng + lngStep, lat + t * latStep]);
    }

    if (br < threshold !== bl < threshold) {
      const t = (threshold - br) / (bl - br);
      contour.push([lng + (1 - t) * lngStep, lat + latStep]);
    }

    if (bl < threshold !== tl < threshold) {
      const t = (threshold - bl) / (tl - bl);
      contour.push([lng, lat + (1 - t) * latStep]);
    }

    // Move to next cell based on direction
    if (direction === 0) j++;
    else if (direction === 1) i++;
    else if (direction === 2) j--;
    else if (direction === 3) i--;

    // Check bounds
    if (i < 0 || i >= resolution || j < 0 || j >= resolution) break;
  }

  // Close the contour
  if (contour.length > 0) {
    contour.push(contour[0]);
  }

  return contour;
}

// Generate flood polygons using flood-fill from ocean entry points
export function generateFloodPolygons(
  elevationData: Map<string, number>,
  waterLevel: number,
  resolution: number = 100
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const flooded = new Set<string>();
  const latStep = (SF_BOUNDS.north - SF_BOUNDS.south) / resolution;
  const lngStep = (SF_BOUNDS.east - SF_BOUNDS.west) / resolution;

  // Ocean entry points (Pacific Ocean on west, SF Bay on east)
  const seedPoints: Array<[number, number]> = [];

  // West coast (Pacific Ocean)
  for (let i = 0; i <= resolution; i++) {
    const lat = SF_BOUNDS.south + i * latStep;
    seedPoints.push([SF_BOUNDS.west, lat]);
  }

  // East coast (SF Bay)
  for (let i = 0; i <= resolution; i++) {
    const lat = SF_BOUNDS.south + i * latStep;
    seedPoints.push([SF_BOUNDS.east, lat]);
  }

  // North (Golden Gate)
  for (let j = 0; j <= resolution; j++) {
    const lng = SF_BOUNDS.west + j * lngStep;
    seedPoints.push([lng, SF_BOUNDS.north]);
  }

  // Flood fill from seed points
  const queue = [...seedPoints];
  const floodedCells: Array<[number, number]> = [];

  while (queue.length > 0) {
    const [lng, lat] = queue.shift()!;
    const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;

    if (flooded.has(key)) continue;

    const elevation = elevationData.get(key) || 0;
    if (elevation >= waterLevel) continue;

    flooded.add(key);
    floodedCells.push([lng, lat]);

    // Add neighbors to queue
    const neighbors = [
      [lng + lngStep, lat],
      [lng - lngStep, lat],
      [lng, lat + latStep],
      [lng, lat - latStep],
    ];

    for (const [nLng, nLat] of neighbors) {
      if (
        nLng >= SF_BOUNDS.west &&
        nLng <= SF_BOUNDS.east &&
        nLat >= SF_BOUNDS.south &&
        nLat <= SF_BOUNDS.north
      ) {
        queue.push([nLng, nLat]);
      }
    }
  }

  // Convert flooded cells to polygons
  if (floodedCells.length > 0) {
    // Create a single large polygon covering all flooded areas
    // In a real implementation, we'd use a more sophisticated algorithm
    // to create proper polygon boundaries
    const hull = createConvexHull(floodedCells);

    features.push({
      type: "Feature",
      properties: {
        waterLevel,
        type: "flood-area",
      },
      geometry: {
        type: "Polygon",
        coordinates: [hull],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// Simple convex hull algorithm for creating flood boundary
function createConvexHull(
  points: Array<[number, number]>
): Array<[number, number]> {
  if (points.length < 3) return points;

  // Sort points by x-coordinate
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Build lower hull
  const lower: Array<[number, number]> = [];
  for (const p of points) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  // Build upper hull
  const upper: Array<[number, number]> = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

// Cross product for convex hull
function cross(
  o: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}
