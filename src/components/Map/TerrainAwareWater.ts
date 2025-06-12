// Terrain-aware water surface that lets Mapbox handle elevation cutoffs
// This creates a large water surface and relies on the terrain system to hide it above ground

export function generateTerrainAwareWater(
  waterLevel: number
): GeoJSON.FeatureCollection {
  if (waterLevel <= 0) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  // Create ONE large water surface covering the entire SF bay area
  // Let the 3D terrain handle where it appears/disappears based on elevation
  const feature: GeoJSON.Feature = {
    type: "Feature",
    properties: {
      waterLevel,
      type: "ocean-surface",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          // Large area covering SF and surroundings - terrain will cut it off
          [-122.55, 37.85], // Northwest
          [-122.3, 37.85], // Northeast
          [-122.3, 37.65], // Southeast
          [-122.55, 37.65], // Southwest
          [-122.55, 37.85], // Close polygon
        ],
      ],
    },
  };

  return {
    type: "FeatureCollection",
    features: [feature],
  };
}
