// Water surface generation for realistic flood visualization
// Creates a continuous water surface that covers all areas below the water level

// San Francisco bounding box coordinates
const SF_BOUNDS = {
  north: 37.83,
  south: 37.7,
  east: -122.35,
  west: -122.52,
};

// Generate a comprehensive water surface that covers all areas below water level
export function generateWaterSurface(
  waterLevel: number
): GeoJSON.FeatureCollection {
  if (waterLevel <= 0) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  // Create a single large polygon covering all of San Francisco
  // The shader/terrain system will handle the actual water level cutoffs
  const features: GeoJSON.Feature[] = [];

  // For different water levels, we'll create increasingly larger coverage areas
  if (waterLevel < 10) {
    // Low water levels - focus on known flood-prone areas
    features.push(createBayAreaWater(waterLevel));
    features.push(createOceanSideWater(waterLevel));
  } else if (waterLevel < 50) {
    // Medium water levels - expand to cover more of the city
    features.push(createExpandedFloodArea(waterLevel));
  } else {
    // High water levels - cover most of the city
    features.push(createCityWideFlood(waterLevel));
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// Create water surface for bay-side areas (Mission Bay, SOMA, Financial)
function createBayAreaWater(waterLevel: number): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {
      waterLevel,
      area: "bay-side",
      type: "water-surface",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          // Start from the bay and work inland
          [-122.35, 37.82], // Northeast corner
          [-122.35, 37.75], // Southeast corner
          [-122.42, 37.75], // Southwest corner
          [-122.42, 37.82], // Northwest corner
          [-122.35, 37.82], // Close the polygon
        ],
      ],
    },
  };
}

// Create water surface for ocean-side areas (Sunset, Richmond)
function createOceanSideWater(waterLevel: number): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {
      waterLevel,
      area: "ocean-side",
      type: "water-surface",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          // Start from the ocean and work inland
          [-122.52, 37.83], // Northwest corner
          [-122.48, 37.83], // Northeast corner
          [-122.48, 37.7], // Southeast corner
          [-122.52, 37.7], // Southwest corner
          [-122.52, 37.83], // Close the polygon
        ],
      ],
    },
  };
}

// Create expanded flood area for medium water levels
function createExpandedFloodArea(waterLevel: number): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {
      waterLevel,
      area: "expanded",
      type: "water-surface",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          // Cover most low-lying areas of SF
          [-122.52, 37.83],
          [-122.35, 37.83],
          [-122.35, 37.7],
          [-122.52, 37.7],
          [-122.52, 37.83],
        ],
      ],
    },
  };
}

// Create city-wide flood for extreme water levels
function createCityWideFlood(waterLevel: number): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {
      waterLevel,
      area: "city-wide",
      type: "water-surface",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          // Cover the entire SF area - terrain will handle the cutoffs
          [SF_BOUNDS.west, SF_BOUNDS.north],
          [SF_BOUNDS.east, SF_BOUNDS.north],
          [SF_BOUNDS.east, SF_BOUNDS.south],
          [SF_BOUNDS.west, SF_BOUNDS.south],
          [SF_BOUNDS.west, SF_BOUNDS.north],
        ],
      ],
    },
  };
}
