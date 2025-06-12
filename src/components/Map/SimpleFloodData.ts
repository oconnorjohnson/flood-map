import { Feature, Polygon, FeatureCollection } from "geojson";

// Low-lying areas of San Francisco with approximate elevations
const FLOOD_AREAS = [
  // Mission Bay - very low elevation (0-3m)
  {
    name: "Mission Bay",
    maxElevation: 3,
    coordinates: [
      [
        [-122.395, 37.77],
        [-122.385, 37.77],
        [-122.385, 37.765],
        [-122.395, 37.765],
        [-122.395, 37.77],
      ],
    ],
  },

  // SOMA flats - low elevation (2-5m)
  {
    name: "SOMA Flats",
    maxElevation: 5,
    coordinates: [
      [
        [-122.405, 37.775],
        [-122.39, 37.775],
        [-122.39, 37.77],
        [-122.405, 37.77],
        [-122.405, 37.775],
      ],
    ],
  },

  // Waterfront areas near Bay Bridge (1-4m)
  {
    name: "Bay Bridge Waterfront",
    maxElevation: 4,
    coordinates: [
      [
        [-122.39, 37.79],
        [-122.385, 37.79],
        [-122.385, 37.785],
        [-122.39, 37.785],
        [-122.39, 37.79],
      ],
    ],
  },

  // Hunters Point area (3-8m)
  {
    name: "Hunters Point",
    maxElevation: 8,
    coordinates: [
      [
        [-122.375, 37.73],
        [-122.365, 37.73],
        [-122.365, 37.72],
        [-122.375, 37.72],
        [-122.375, 37.73],
      ],
    ],
  },

  // Fisherman's Wharf area (2-6m)
  {
    name: "Fisherman's Wharf",
    maxElevation: 6,
    coordinates: [
      [
        [-122.42, 37.81],
        [-122.405, 37.81],
        [-122.405, 37.8],
        [-122.42, 37.8],
        [-122.42, 37.81],
      ],
    ],
  },

  // Marina District - built on fill, vulnerable (5-10m)
  {
    name: "Marina District",
    maxElevation: 10,
    coordinates: [
      [
        [-122.45, 37.805],
        [-122.43, 37.805],
        [-122.43, 37.795],
        [-122.45, 37.795],
        [-122.45, 37.805],
      ],
    ],
  },
];

export function generateRealisticFlood(waterLevel: number): FeatureCollection {
  const features: Feature<Polygon>[] = [];

  // Only include areas that would be flooded at this water level
  FLOOD_AREAS.forEach((area) => {
    if (waterLevel >= area.maxElevation) {
      features.push({
        type: "Feature",
        properties: {
          name: area.name,
          maxElevation: area.maxElevation,
          waterLevel: waterLevel,
          floodDepth: waterLevel - area.maxElevation,
        },
        geometry: {
          type: "Polygon",
          coordinates: area.coordinates,
        },
      });
    }
  });

  return {
    type: "FeatureCollection",
    features,
  };
}
