// Terrain-aware water surface that lets Mapbox handle elevation cutoffs
// This creates a large water surface and relies on the terrain system to hide it above ground

import mapboxgl from "mapbox-gl";

export class TerrainAwareWater {
  private map: mapboxgl.Map;
  private waterLevel: number;
  private sourceId = "terrain-water-source";
  private layerId = "terrain-water-layer";

  constructor(map: mapboxgl.Map, waterLevel: number = 61) {
    this.map = map;
    this.waterLevel = waterLevel;
  }

  async initialize() {
    // Create multiple polygons at different elevations to simulate water filling low areas
    const features = this.createWaterFeatures();

    // Add source
    if (!this.map.getSource(this.sourceId)) {
      this.map.addSource(this.sourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: features,
        },
      });
    }

    // Add layer using fill-extrusion
    if (!this.map.getLayer(this.layerId)) {
      this.map.addLayer(
        {
          id: this.layerId,
          type: "fill-extrusion",
          source: this.sourceId,
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "depth"],
              0,
              "rgba(74, 144, 226, 0.4)", // Shallow water
              10,
              "rgba(46, 124, 214, 0.6)", // Medium depth
              30,
              "rgba(30, 95, 165, 0.7)", // Deep water
              50,
              "rgba(15, 76, 129, 0.8)", // Very deep
            ],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-opacity": 0.7,
          },
        },
        "3d-buildings"
      );
    }

    console.log("Terrain-aware water initialized with level:", this.waterLevel);
  }

  private createWaterFeatures(): GeoJSON.Feature[] {
    const features: GeoJSON.Feature[] = [];

    // Define elevation zones for San Francisco
    // These approximate the actual terrain
    const elevationZones = [
      {
        name: "Sea Level Areas",
        maxElevation: 5,
        areas: [
          // Marina District
          {
            bounds: { west: -122.45, east: -122.42, south: 37.8, north: 37.81 },
          },
          // Embarcadero
          {
            bounds: {
              west: -122.41,
              east: -122.38,
              south: 37.78,
              north: 37.81,
            },
          },
          // Mission Bay
          {
            bounds: { west: -122.4, east: -122.38, south: 37.76, north: 37.78 },
          },
          // SOMA low areas
          {
            bounds: {
              west: -122.42,
              east: -122.39,
              south: 37.77,
              north: 37.79,
            },
          },
        ],
      },
      {
        name: "Low Elevation",
        maxElevation: 20,
        areas: [
          // Richmond low areas
          {
            bounds: {
              west: -122.51,
              east: -122.46,
              south: 37.77,
              north: 37.79,
            },
          },
          // Sunset low areas
          {
            bounds: {
              west: -122.51,
              east: -122.45,
              south: 37.74,
              north: 37.77,
            },
          },
          // Parts of Mission
          {
            bounds: {
              west: -122.43,
              east: -122.41,
              south: 37.75,
              north: 37.77,
            },
          },
        ],
      },
      {
        name: "Medium Elevation",
        maxElevation: 40,
        areas: [
          // Lower Pacific Heights
          {
            bounds: {
              west: -122.44,
              east: -122.42,
              south: 37.785,
              north: 37.795,
            },
          },
          // Parts of Castro
          {
            bounds: {
              west: -122.44,
              east: -122.42,
              south: 37.755,
              north: 37.765,
            },
          },
        ],
      },
    ];

    // Create water features for each zone that's below water level
    for (const zone of elevationZones) {
      if (this.waterLevel > zone.maxElevation) {
        for (const area of zone.areas) {
          const depth = this.waterLevel - zone.maxElevation;

          features.push({
            type: "Feature",
            properties: {
              elevation: zone.maxElevation,
              depth: depth,
              height: this.waterLevel,
              base: zone.maxElevation,
              zone: zone.name,
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [area.bounds.west, area.bounds.south],
                  [area.bounds.east, area.bounds.south],
                  [area.bounds.east, area.bounds.north],
                  [area.bounds.west, area.bounds.north],
                  [area.bounds.west, area.bounds.south],
                ],
              ],
            },
          });
        }
      }
    }

    return features;
  }

  setWaterLevel(level: number) {
    this.waterLevel = level;

    // Recreate features with new water level
    const features = this.createWaterFeatures();

    // Update the source data
    const source = this.map.getSource(this.sourceId) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: features,
      });
    }
  }

  remove() {
    if (this.map.getLayer(this.layerId)) {
      this.map.removeLayer(this.layerId);
    }
    if (this.map.getSource(this.sourceId)) {
      this.map.removeSource(this.sourceId);
    }
  }
}
