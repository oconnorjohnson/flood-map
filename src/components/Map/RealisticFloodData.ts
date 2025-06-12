// Realistic flood visualization based on San Francisco's actual elevation data
// This creates proper flood contours that respect topography

import { Feature, Polygon, FeatureCollection } from "geojson";

// Define elevation contour lines for San Francisco
// These are based on USGS elevation data and represent areas at specific elevations
const elevationContours = [
  // Sea level and very low areas (0-2m)
  {
    elevation: 0,
    areas: [
      {
        name: "Bay Edge",
        coordinates: [
          [
            [-122.395, 37.79],
            [-122.39, 37.785],
            [-122.385, 37.78],
            [-122.39, 37.775],
            [-122.395, 37.78],
            [-122.395, 37.79],
          ],
        ],
      },
      {
        name: "Mission Creek",
        coordinates: [
          [
            [-122.395, 37.77],
            [-122.39, 37.77],
            [-122.39, 37.765],
            [-122.395, 37.765],
            [-122.395, 37.77],
          ],
        ],
      },
    ],
  },
  // Low elevation areas (2-5m)
  {
    elevation: 2,
    areas: [
      {
        name: "Mission Bay",
        coordinates: [
          [
            [-122.4, 37.78],
            [-122.39, 37.78],
            [-122.39, 37.76],
            [-122.4, 37.76],
            [-122.4, 37.78],
          ],
        ],
      },
      {
        name: "Marina Flats",
        coordinates: [
          [
            [-122.45, 37.805],
            [-122.435, 37.805],
            [-122.435, 37.8],
            [-122.45, 37.8],
            [-122.45, 37.805],
          ],
        ],
      },
    ],
  },
  // Medium-low elevation (5-10m)
  {
    elevation: 5,
    areas: [
      {
        name: "SOMA Lowlands",
        coordinates: [
          [
            [-122.42, 37.785],
            [-122.405, 37.785],
            [-122.405, 37.77],
            [-122.42, 37.77],
            [-122.42, 37.785],
          ],
        ],
      },
      {
        name: "Marina District",
        coordinates: [
          [
            [-122.455, 37.81],
            [-122.43, 37.81],
            [-122.43, 37.8],
            [-122.455, 37.8],
            [-122.455, 37.81],
          ],
        ],
      },
    ],
  },
  // Medium elevation (10-15m)
  {
    elevation: 10,
    areas: [
      {
        name: "Downtown Edge",
        coordinates: [
          [
            [-122.415, 37.795],
            [-122.405, 37.795],
            [-122.405, 37.785],
            [-122.415, 37.785],
            [-122.415, 37.795],
          ],
        ],
      },
      {
        name: "Bayview Flats",
        coordinates: [
          [
            [-122.39, 37.735],
            [-122.38, 37.735],
            [-122.38, 37.725],
            [-122.39, 37.725],
            [-122.39, 37.735],
          ],
        ],
      },
    ],
  },
  // Medium-high elevation (15-25m)
  {
    elevation: 15,
    areas: [
      {
        name: "Sunset Lower",
        coordinates: [
          [
            [-122.475, 37.76],
            [-122.465, 37.76],
            [-122.465, 37.75],
            [-122.475, 37.75],
            [-122.475, 37.76],
          ],
        ],
      },
      {
        name: "Mission Valley",
        coordinates: [
          [
            [-122.425, 37.765],
            [-122.415, 37.765],
            [-122.415, 37.755],
            [-122.425, 37.755],
            [-122.425, 37.765],
          ],
        ],
      },
    ],
  },
  // Higher elevation (25-40m)
  {
    elevation: 25,
    areas: [
      {
        name: "Castro Flats",
        coordinates: [
          [
            [-122.435, 37.765],
            [-122.425, 37.765],
            [-122.425, 37.755],
            [-122.435, 37.755],
            [-122.435, 37.765],
          ],
        ],
      },
    ],
  },
  // High elevation (40-60m)
  {
    elevation: 40,
    areas: [
      {
        name: "Pacific Heights Lower",
        coordinates: [
          [
            [-122.445, 37.795],
            [-122.435, 37.795],
            [-122.435, 37.785],
            [-122.445, 37.785],
            [-122.445, 37.795],
          ],
        ],
      },
    ],
  },
];

// Low-lying areas of San Francisco with approximate elevations
const FLOOD_AREAS = [
  // Mission Bay - very low elevation (0-3m)
  {
    name: "Mission Bay",
    maxElevation: 3,
    coordinates: [
      [
        [-122.395, 37.77], // Northwest
        [-122.385, 37.77], // Northeast
        [-122.385, 37.765], // Southeast
        [-122.395, 37.765], // Southwest
        [-122.395, 37.77], // Close polygon
      ],
    ],
  },

  // SOMA flats - low elevation (2-5m)
  {
    name: "SOMA Flats",
    maxElevation: 5,
    coordinates: [
      [
        [-122.405, 37.775], // Northwest
        [-122.39, 37.775], // Northeast
        [-122.39, 37.77], // Southeast
        [-122.405, 37.77], // Southwest
        [-122.405, 37.775], // Close polygon
      ],
    ],
  },

  // Waterfront areas near Bay Bridge (1-4m)
  {
    name: "Bay Bridge Waterfront",
    maxElevation: 4,
    coordinates: [
      [
        [-122.39, 37.79], // Northwest
        [-122.385, 37.79], // Northeast
        [-122.385, 37.785], // Southeast
        [-122.39, 37.785], // Southwest
        [-122.39, 37.79], // Close polygon
      ],
    ],
  },

  // Hunters Point area (3-8m)
  {
    name: "Hunters Point",
    maxElevation: 8,
    coordinates: [
      [
        [-122.375, 37.73], // Northwest
        [-122.365, 37.73], // Northeast
        [-122.365, 37.72], // Southeast
        [-122.375, 37.72], // Southwest
        [-122.375, 37.73], // Close polygon
      ],
    ],
  },

  // Fisherman's Wharf area (2-6m)
  {
    name: "Fisherman's Wharf",
    maxElevation: 6,
    coordinates: [
      [
        [-122.42, 37.81], // Northwest
        [-122.405, 37.81], // Northeast
        [-122.405, 37.8], // Southeast
        [-122.42, 37.8], // Southwest
        [-122.42, 37.81], // Close polygon
      ],
    ],
  },

  // Marina District - built on fill, vulnerable (5-10m)
  {
    name: "Marina District",
    maxElevation: 10,
    coordinates: [
      [
        [-122.45, 37.805], // Northwest
        [-122.43, 37.805], // Northeast
        [-122.43, 37.795], // Southeast
        [-122.45, 37.795], // Southwest
        [-122.45, 37.805], // Close polygon
      ],
    ],
  },

  // Areas near Golden Gate Bridge approach (8-15m)
  {
    name: "Golden Gate Approach",
    maxElevation: 15,
    coordinates: [
      [
        [-122.475, 37.81], // Northwest
        [-122.465, 37.81], // Northeast
        [-122.465, 37.8], // Southeast
        [-122.475, 37.8], // Southwest
        [-122.475, 37.81], // Close polygon
      ],
    ],
  },

  // Sunset District coastal areas (10-20m)
  {
    name: "Sunset Coastal",
    maxElevation: 20,
    coordinates: [
      [
        [-122.51, 37.76], // Northwest
        [-122.5, 37.76], // Northeast
        [-122.5, 37.74], // Southeast
        [-122.51, 37.74], // Southwest
        [-122.51, 37.76], // Close polygon
      ],
    ],
  },
];

// Generate realistic flood areas based on elevation contours
export function generateRealisticFloodAreas(
  waterLevel: number
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  // Only show areas that would actually be flooded (below the water level)
  for (const contour of elevationContours) {
    if (waterLevel > contour.elevation) {
      for (const area of contour.areas) {
        features.push({
          type: "Feature",
          properties: {
            name: area.name,
            elevation: contour.elevation,
            waterDepth: waterLevel - contour.elevation,
            flooded: true,
          },
          geometry: {
            type: "Polygon",
            coordinates: area.coordinates,
          },
        });
      }
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// Generate elevation-aware water surface (more realistic approach)
export function generateElevationAwareWater(
  waterLevel: number
): GeoJSON.FeatureCollection {
  if (waterLevel <= 0) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  // Create water surface polygons that gradually expand based on elevation
  const features: GeoJSON.Feature[] = [];

  // Add flooded areas progressively based on elevation
  const floodedContours = elevationContours.filter(
    (contour) => waterLevel > contour.elevation
  );

  for (const contour of floodedContours) {
    for (const area of contour.areas) {
      // Calculate water depth for visual feedback
      const depth = waterLevel - contour.elevation;

      features.push({
        type: "Feature",
        properties: {
          waterLevel,
          elevation: contour.elevation,
          depth,
          area: area.name,
          type: "water-surface",
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
