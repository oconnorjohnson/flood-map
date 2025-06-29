import mapboxgl from "mapbox-gl";

export class WaterVisualization {
  private map: mapboxgl.Map;
  private waterLevel: number;
  private sourceId = "water-fill-source";
  private layerId = "water-fill-layer";

  constructor(map: mapboxgl.Map, waterLevel: number = 61) {
    this.map = map;
    this.waterLevel = waterLevel;
  }

  async initialize() {
    // Create a large polygon covering all of San Francisco
    const sfBounds = {
      west: -122.55,
      east: -122.35,
      south: 37.7,
      north: 37.85,
    };

    // Create a grid of points to form the water surface
    const waterPolygon: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature",
      properties: {
        waterLevel: this.waterLevel,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [sfBounds.west, sfBounds.south],
            [sfBounds.east, sfBounds.south],
            [sfBounds.east, sfBounds.north],
            [sfBounds.west, sfBounds.north],
            [sfBounds.west, sfBounds.south],
          ],
        ],
      },
    };

    // Add source
    if (!this.map.getSource(this.sourceId)) {
      this.map.addSource(this.sourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [waterPolygon],
        },
      });
    }

    // Add layer using fill-extrusion for 3D water surface
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
              ["get", "waterLevel"],
              0,
              "#4A90E2",
              30,
              "#2E7CD6",
              60,
              "#1E5FA5",
              100,
              "#0F4C81",
            ],
            // MapBox uses a different scale for elevation
            // We need to adjust the water level to match real-world meters
            // The terrain exaggeration factor affects this as well
            "fill-extrusion-height": this.waterLevel * 0.6, // Adjust scale factor
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.6,
          },
        },
        "3d-buildings"
      ); // Add before buildings layer
    }

    console.log("Water visualization initialized with level:", this.waterLevel);
  }

  setWaterLevel(level: number) {
    this.waterLevel = level;

    // Update the paint property
    if (this.map.getLayer(this.layerId)) {
      this.map.setPaintProperty(
        this.layerId,
        "fill-extrusion-height",
        level * 0.6
      );
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
