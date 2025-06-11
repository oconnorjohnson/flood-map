// Mock elevation data for San Francisco for demonstration
// This represents a simplified elevation model where lower values
// near the bay will flood first

interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number; // in meters
}

// Key areas of San Francisco with approximate elevations
export const mockSanFranciscoElevation: ElevationPoint[] = [
  // Downtown/Financial District (mostly low)
  { lat: 37.7749, lng: -122.4194, elevation: 10 },
  { lat: 37.7849, lng: -122.4094, elevation: 5 },

  // Mission Bay (very low, prone to flooding)
  { lat: 37.7699, lng: -122.3944, elevation: 2 },
  { lat: 37.7649, lng: -122.3894, elevation: 1 },

  // SOMA (low)
  { lat: 37.7699, lng: -122.4094, elevation: 8 },

  // Marina District (low, near bay)
  { lat: 37.8049, lng: -122.4394, elevation: 3 },
  { lat: 37.8099, lng: -122.4444, elevation: 4 },

  // Pacific Heights (high)
  { lat: 37.7949, lng: -122.4294, elevation: 45 },
  { lat: 37.7899, lng: -122.4344, elevation: 55 },

  // Nob Hill (high)
  { lat: 37.7919, lng: -122.4194, elevation: 85 },

  // Russian Hill (high)
  { lat: 37.8019, lng: -122.4194, elevation: 90 },

  // Twin Peaks (very high)
  { lat: 37.7519, lng: -122.4474, elevation: 280 },

  // Castro/Mission area (moderate)
  { lat: 37.7619, lng: -122.4294, elevation: 25 },

  // Sunset District (moderate, but closer to ocean)
  { lat: 37.7519, lng: -122.4674, elevation: 15 },
  { lat: 37.7419, lng: -122.4774, elevation: 12 },

  // Richmond District (low to moderate)
  { lat: 37.7819, lng: -122.4674, elevation: 18 },

  // Bayview (low, vulnerable)
  { lat: 37.7319, lng: -122.3874, elevation: 8 },
  { lat: 37.7219, lng: -122.3774, elevation: 5 },
];

// Function to get approximate elevation for any point in SF
export function getElevationAtPoint(lat: number, lng: number): number {
  // Simple interpolation based on distance to known points
  let totalWeight = 0;
  let weightedElevation = 0;

  for (const point of mockSanFranciscoElevation) {
    const distance = Math.sqrt(
      Math.pow(lat - point.lat, 2) + Math.pow(lng - point.lng, 2)
    );

    // Avoid division by zero and give very close points high weight
    const weight = 1 / (distance + 0.001);
    totalWeight += weight;
    weightedElevation += point.elevation * weight;
  }

  return totalWeight > 0 ? weightedElevation / totalWeight : 10; // Default to 10m
}

// Generate a grid of flood-prone areas based on elevation
export function generateFloodAreas(
  waterLevel: number
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  // Define areas that would flood at different water levels
  const floodAreas = [
    {
      name: "Mission Bay",
      maxElevation: 3,
      coordinates: [
        [
          [-122.4044, 37.7699],
          [-122.3844, 37.7699],
          [-122.3844, 37.7599],
          [-122.4044, 37.7599],
          [-122.4044, 37.7699],
        ],
      ],
    },
    {
      name: "Marina District",
      maxElevation: 5,
      coordinates: [
        [
          [-122.4494, 37.8099],
          [-122.4294, 37.8099],
          [-122.4294, 37.7999],
          [-122.4494, 37.7999],
          [-122.4494, 37.8099],
        ],
      ],
    },
    {
      name: "SOMA Low Areas",
      maxElevation: 8,
      coordinates: [
        [
          [-122.4194, 37.7799],
          [-122.3994, 37.7799],
          [-122.3994, 37.7699],
          [-122.4194, 37.7699],
          [-122.4194, 37.7799],
        ],
      ],
    },
    {
      name: "Downtown Financial",
      maxElevation: 12,
      coordinates: [
        [
          [-122.4094, 37.7949],
          [-122.3994, 37.7949],
          [-122.3994, 37.7849],
          [-122.4094, 37.7849],
          [-122.4094, 37.7949],
        ],
      ],
    },
  ];

  for (const area of floodAreas) {
    if (waterLevel >= area.maxElevation) {
      features.push({
        type: "Feature",
        properties: {
          name: area.name,
          elevation: area.maxElevation,
          flooded: true,
        },
        geometry: {
          type: "Polygon",
          coordinates: area.coordinates,
        },
      });
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
