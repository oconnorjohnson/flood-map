// Topographic flood model that simulates water ingress from ocean and bay
// Water flows from the coastlines inward, respecting elevation

// San Francisco water entry points
const WATER_SOURCES = {
  // Pacific Ocean (west side)
  pacificOcean: {
    name: "Pacific Ocean",
    startLine: [
      [-122.514, 37.81], // Ocean Beach North
      [-122.514, 37.75], // Ocean Beach South
    ],
  },
  // San Francisco Bay (east side)
  sfBay: {
    name: "San Francisco Bay",
    startLine: [
      [-122.37, 37.83], // Bay Bridge North
      [-122.37, 37.7], // Hunters Point South
    ],
  },
  // Golden Gate (north)
  goldenGate: {
    name: "Golden Gate",
    startLine: [
      [-122.48, 37.83], // Golden Gate South
      [-122.45, 37.81], // Marina/Presidio
    ],
  },
};

// Generate water polygon that flows from coastlines based on elevation
export function generateTopographicFlood(
  waterLevel: number
): GeoJSON.FeatureCollection {
  if (waterLevel <= 0) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  // Create a single water body that represents ocean water at the given level
  // The 3D terrain will naturally cut off areas above the water level
  const features: GeoJSON.Feature[] = [];

  // For water levels under 50m, create realistic coastal flooding
  if (waterLevel < 50) {
    // Pacific Ocean side - water enters from Ocean Beach
    features.push({
      type: "Feature",
      properties: {
        source: "Pacific Ocean",
        waterLevel,
        type: "coastal-flood",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            // Start at ocean and flow inland based on water level
            [-122.514, 37.79], // Ocean Beach North
            [-122.514, 37.72], // Ocean Beach South
            // Inland penetration based on water level
            [-122.514 + waterLevel * 0.002, 37.72], // Further inland with higher water
            [-122.514 + waterLevel * 0.002, 37.79],
            [-122.514, 37.79], // Close polygon
          ],
        ],
      },
    });

    // San Francisco Bay side - water enters from the east
    features.push({
      type: "Feature",
      properties: {
        source: "San Francisco Bay",
        waterLevel,
        type: "coastal-flood",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            // Start at bay and flow inland
            [-122.37, 37.82], // North Bay
            [-122.37, 37.71], // South Bay
            // Inland penetration
            [-122.37 - waterLevel * 0.003, 37.71], // Further west with higher water
            [-122.37 - waterLevel * 0.003, 37.82],
            [-122.37, 37.82], // Close polygon
          ],
        ],
      },
    });

    // Golden Gate / Marina area
    features.push({
      type: "Feature",
      properties: {
        source: "Golden Gate",
        waterLevel,
        type: "coastal-flood",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            // Marina/Crissy Field area
            [-122.48, 37.81], // West
            [-122.43, 37.81], // East
            [-122.43, 37.81 - waterLevel * 0.001], // South based on water level
            [-122.48, 37.81 - waterLevel * 0.001],
            [-122.48, 37.81], // Close polygon
          ],
        ],
      },
    });
  } else {
    // For extreme water levels, create a comprehensive flood
    features.push({
      type: "Feature",
      properties: {
        source: "All Sources",
        waterLevel,
        type: "extreme-flood",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            // Cover entire SF area - terrain will handle cutoffs
            [-122.52, 37.84],
            [-122.35, 37.84],
            [-122.35, 37.69],
            [-122.52, 37.69],
            [-122.52, 37.84],
          ],
        ],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// Create smooth water surface that connects all water bodies
export function generateConnectedWaterSurface(
  waterLevel: number
): GeoJSON.FeatureCollection {
  if (waterLevel <= 0) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  // Create connected water bodies based on water level
  const features: GeoJSON.Feature[] = [];

  // Calculate how far inland water reaches based on level
  const inlandReach = Math.min(waterLevel * 0.001, 0.05); // Max 0.05 degrees inland

  // Main water body that surrounds SF
  const waterPolygon: GeoJSON.Feature = {
    type: "Feature",
    properties: {
      waterLevel,
      type: "ocean-surface",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          // Outer boundary (ocean/bay)
          [-122.52, 37.85], // NW Ocean
          [-122.35, 37.85], // NE Bay
          [-122.35, 37.68], // SE Bay
          [-122.52, 37.68], // SW Ocean
          [-122.52, 37.85], // Close outer
        ],
        [
          // Inner boundary (land) - creates a hole
          // This will be filled where elevation < water level
          [-122.514 + inlandReach, 37.83], // NW
          [-122.37 - inlandReach, 37.83], // NE
          [-122.37 - inlandReach, 37.7], // SE
          [-122.514 + inlandReach, 37.7], // SW
          [-122.514 + inlandReach, 37.83], // Close inner
        ],
      ],
    },
  };

  features.push(waterPolygon);

  return {
    type: "FeatureCollection",
    features,
  };
}
