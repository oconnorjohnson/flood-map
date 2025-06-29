"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useStore } from "@/lib/store";
import { ElevationTooltip, useElevationTooltip } from "./ElevationTooltip";
import { BuildingTooltip, useBuildingTooltip } from "./BuildingTooltip";
import { SeaLevelRiseLayer } from "./SeaLevelRiseLayer";
import { WaterVisualization } from "./WaterVisualization";

// Initialize Mapbox access token from environment
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Generate flood areas based on water level
// This creates multiple polygons representing areas that would actually flood
const generateFloodAreas = (waterLevel: number): GeoJSON.FeatureCollection => {
  const features: GeoJSON.Feature[] = [];

  if (waterLevel <= 0) {
    return { type: "FeatureCollection", features };
  }

  // Ocean and bay entry points - these are always flooded if water level > 0
  const waterBodies = [
    // Pacific Ocean (west coast)
    {
      name: "Pacific Ocean",
      coordinates: [
        [
          [-122.52, 37.9],
          [-122.52, 37.65],
          [-122.48, 37.65],
          [-122.48, 37.9],
          [-122.52, 37.9],
        ],
      ],
    },
    // San Francisco Bay (east)
    {
      name: "San Francisco Bay",
      coordinates: [
        [
          [-122.35, 37.9],
          [-122.3, 37.9],
          [-122.3, 37.65],
          [-122.35, 37.65],
          [-122.35, 37.9],
        ],
      ],
    },
    // Golden Gate (north)
    {
      name: "Golden Gate",
      coordinates: [
        [
          [-122.5, 37.84],
          [-122.4, 37.84],
          [-122.4, 37.81],
          [-122.5, 37.81],
          [-122.5, 37.84],
        ],
      ],
    },
  ];

  // Add water bodies as base flood areas
  for (const waterBody of waterBodies) {
    features.push({
      type: "Feature",
      properties: {
        name: waterBody.name,
        elevation: 0,
        waterDepth: waterLevel,
      },
      geometry: {
        type: "Polygon",
        coordinates: waterBody.coordinates,
      },
    });
  }

  // Low-lying areas that flood at different water levels
  // These are connected to water sources and flood progressively
  const floodZones = [
    // Areas that flood at 1-5m (very low elevation, directly connected to water)
    {
      minWaterLevel: 1,
      areas: [
        {
          name: "Mission Bay",
          coordinates: [
            [
              [-122.395, 37.775],
              [-122.385, 37.775],
              [-122.385, 37.765],
              [-122.395, 37.765],
              [-122.395, 37.775],
            ],
          ],
        },
        {
          name: "Embarcadero",
          coordinates: [
            [
              [-122.4, 37.8],
              [-122.385, 37.8],
              [-122.385, 37.79],
              [-122.4, 37.79],
              [-122.4, 37.8],
            ],
          ],
        },
      ],
    },
    // Areas that flood at 5-10m
    {
      minWaterLevel: 5,
      areas: [
        {
          name: "SOMA",
          coordinates: [
            [
              [-122.41, 37.785],
              [-122.395, 37.785],
              [-122.395, 37.775],
              [-122.41, 37.775],
              [-122.41, 37.785],
            ],
          ],
        },
        {
          name: "Marina District",
          coordinates: [
            [
              [-122.445, 37.805],
              [-122.43, 37.805],
              [-122.43, 37.8],
              [-122.445, 37.8],
              [-122.445, 37.805],
            ],
          ],
        },
      ],
    },
    // Areas that flood at 10-20m
    {
      minWaterLevel: 10,
      areas: [
        {
          name: "Financial District",
          coordinates: [
            [
              [-122.405, 37.795],
              [-122.395, 37.795],
              [-122.395, 37.79],
              [-122.405, 37.79],
              [-122.405, 37.795],
            ],
          ],
        },
        {
          name: "Fisherman's Wharf",
          coordinates: [
            [
              [-122.42, 37.81],
              [-122.41, 37.81],
              [-122.41, 37.805],
              [-122.42, 37.805],
              [-122.42, 37.81],
            ],
          ],
        },
      ],
    },
    // Areas that flood at 20-50m
    {
      minWaterLevel: 20,
      areas: [
        {
          name: "Mission District Lower",
          coordinates: [
            [
              [-122.42, 37.765],
              [-122.41, 37.765],
              [-122.41, 37.755],
              [-122.42, 37.755],
              [-122.42, 37.765],
            ],
          ],
        },
        {
          name: "Sunset District Coast",
          coordinates: [
            [
              [-122.51, 37.76],
              [-122.5, 37.76],
              [-122.5, 37.75],
              [-122.51, 37.75],
              [-122.51, 37.76],
            ],
          ],
        },
      ],
    },
  ];

  // Add flood zones based on water level
  for (const zone of floodZones) {
    if (waterLevel >= zone.minWaterLevel) {
      for (const area of zone.areas) {
        features.push({
          type: "Feature",
          properties: {
            name: area.name,
            elevation: zone.minWaterLevel,
            waterDepth: waterLevel - zone.minWaterLevel,
          },
          geometry: {
            type: "Polygon",
            coordinates: area.coordinates,
          },
        });
      }
    }
  }

  return { type: "FeatureCollection", features };
};

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState<"satellite" | "standard">(
    "satellite"
  );
  const seaLevelRiseLayer = useRef<SeaLevelRiseLayer | null>(null);
  const waterVisualization = useRef<WaterVisualization | null>(null);

  const mapCenter = useStore((state) => state.mapCenter);
  const mapZoom = useStore((state) => state.mapZoom);
  const waterLevel = useStore((state) => state.waterLevel);
  const setMapView = useStore((state) => state.setMapView);

  // Initialize tooltip functionality
  const { tooltip, attachTooltip } = useElevationTooltip(map.current);

  // Initialize building tooltip
  const { buildingData } = useBuildingTooltip(map.current, waterLevel);

  // Function to toggle map style
  const toggleMapStyle = () => {
    if (map.current) {
      const newStyle = mapStyle === "satellite" ? "standard" : "satellite";
      setMapStyle(newStyle);

      if (newStyle === "standard") {
        // Use MapBox Standard style with better 3D buildings
        map.current.setStyle("mapbox://styles/mapbox/standard");
      } else {
        // Use satellite style
        map.current.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
      }
    }
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return; // Initialize map only once

    // Create the map instance with 3D capabilities
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style:
        mapStyle === "standard"
          ? "mapbox://styles/mapbox/standard"
          : "mapbox://styles/mapbox/satellite-streets-v12",
      center: mapCenter,
      zoom: mapZoom,
      pitch: 45, // Add initial 3D tilt
      bearing: 0, // Initial rotation
      antialias: true, // Better rendering quality
      interactive: true,
      dragPan: true,
      dragRotate: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: true,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Initialize 3D terrain and flood visualization
    map.current.on("style.load", () => {
      if (map.current) {
        const currentStyle = map.current.getStyle();
        const isStandardStyle = currentStyle.name === "Mapbox Standard";

        // Add Mapbox terrain source for 3D elevation (not needed for Standard style)
        if (!isStandardStyle) {
          map.current.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.terrain-rgb",
            tileSize: 512,
            maxzoom: 14,
          });

          // Enable 3D terrain
          map.current.setTerrain({
            source: "mapbox-dem",
            exaggeration: 1.5, // Exaggerate elevation for better visualization
          });
        }

        // Add sky layer for realistic 3D atmosphere (not needed for Standard style which has it built-in)
        if (!isStandardStyle) {
          map.current.addLayer({
            id: "sky",
            type: "sky",
            paint: {
              "sky-type": "atmosphere",
              "sky-atmosphere-sun": [0.0, 0.0],
              "sky-atmosphere-sun-intensity": 15,
            },
          });
        }

        // Add contour source from Mapbox Terrain tileset
        map.current.addSource("contours", {
          type: "vector",
          url: "mapbox://mapbox.mapbox-terrain-v2",
        });

        // Create and add the water visualization after other layers
        setTimeout(async () => {
          if (map.current) {
            // Always show 61m (200ft) of sea level rise
            const fixedWaterLevel = 61;
            console.log(
              "Creating water visualization with fixed water level:",
              fixedWaterLevel
            );

            // Use the simpler water visualization
            waterVisualization.current = new WaterVisualization(
              map.current,
              fixedWaterLevel
            );
            await waterVisualization.current.initialize();
            console.log("Water visualization added to map");
          }
        }, 100);

        // Keep the old flood areas for now as a fallback/comparison
        // We can remove this once the new layer is working properly
        map.current.addSource("flood-areas", {
          type: "geojson",
          data: generateFloodAreas(waterLevel),
        });

        // Add contour lines for better elevation visualization
        map.current.addLayer({
          id: "contour-lines",
          type: "line",
          source: "contours",
          "source-layer": "contour",
          filter: ["==", ["get", "index"], 5], // Show every 5th contour
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#877b59",
            "line-width": 1,
            "line-opacity": 0.5,
          },
        });

        // Add contour labels
        map.current.addLayer({
          id: "contour-labels",
          type: "symbol",
          source: "contours",
          "source-layer": "contour",
          filter: ["==", ["get", "index"], 5],
          layout: {
            "symbol-placement": "line",
            "text-field": ["concat", ["get", "ele"], "m"],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-size": 10,
          },
          paint: {
            "text-color": "#877b59",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1,
          },
        });

        // Add 3D buildings layer (only for non-Standard styles)
        if (!isStandardStyle) {
          map.current.addLayer({
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 15,
            paint: {
              "fill-extrusion-color": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                "#ff6b6b", // Red when hovered
                [
                  "interpolate",
                  ["linear"],
                  ["get", "height"],
                  0,
                  "#e1e5e9", // Light gray for short buildings
                  50,
                  "#c8d6e5", // Medium gray for medium buildings
                  100,
                  "#8395a7", // Darker gray for tall buildings
                  200,
                  "#576574", // Dark gray for skyscrapers
                ],
              ],
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                0,
                15.05,
                ["get", "height"],
              ],
              "fill-extrusion-base": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                0,
                15.05,
                ["get", "min_height"],
              ],
              "fill-extrusion-opacity": 0.9,
            },
          });
        }

        // Add building hover effects
        let hoveredBuildingId: string | number | undefined = undefined;

        map.current.on("mousemove", "3d-buildings", (e) => {
          if (e.features && e.features.length > 0) {
            if (hoveredBuildingId !== undefined) {
              map.current?.setFeatureState(
                {
                  source: "composite",
                  sourceLayer: "building",
                  id: hoveredBuildingId,
                } as mapboxgl.FeatureIdentifier,
                { hover: false }
              );
            }
            hoveredBuildingId = e.features[0].id;
            map.current?.setFeatureState(
              {
                source: "composite",
                sourceLayer: "building",
                id: hoveredBuildingId,
              } as mapboxgl.FeatureIdentifier,
              { hover: true }
            );
          }
        });

        map.current.on("mouseleave", "3d-buildings", () => {
          if (hoveredBuildingId !== undefined) {
            map.current?.setFeatureState(
              {
                source: "composite",
                sourceLayer: "building",
                id: hoveredBuildingId,
              } as mapboxgl.FeatureIdentifier,
              { hover: false }
            );
          }
          hoveredBuildingId = undefined;
        });

        // Change cursor on hover
        map.current.on("mouseenter", "3d-buildings", () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = "pointer";
          }
        });

        map.current.on("mouseleave", "3d-buildings", () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = "";
          }
        });

        // Attach tooltip after map is fully loaded
        attachTooltip();
        setMapLoaded(true);
      }
    });

    // Update store when map view changes (with throttling to prevent loops)
    let updateTimeout: NodeJS.Timeout;
    map.current.on("moveend", () => {
      if (map.current) {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
          if (map.current) {
            const center = map.current.getCenter();
            const zoom = map.current.getZoom();
            setMapView([center.lng, center.lat], zoom);
          }
        }, 100); // Throttle updates to prevent infinite loops
      }
    });

    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update flood visualization when water level changes
  useEffect(() => {
    if (map.current && mapLoaded) {
      // Update the water visualization
      if (waterVisualization.current) {
        waterVisualization.current.setWaterLevel(waterLevel);
      }

      // Update the old flood areas data (temporary)
      if (map.current.getSource("flood-areas")) {
        const source = map.current.getSource(
          "flood-areas"
        ) as mapboxgl.GeoJSONSource;
        source.setData(generateFloodAreas(waterLevel));
      }

      console.log(
        `Updated flood visualization for water level: ${waterLevel}m`
      );
    }
  }, [waterLevel, mapLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Style toggle button */}
      <button
        onClick={toggleMapStyle}
        className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-shadow z-10"
        title="Toggle between satellite and standard map styles"
      >
        {mapStyle === "satellite" ? "🏙️ Standard View" : "🛰️ Satellite View"}
      </button>

      {mapLoaded && (
        <ElevationTooltip tooltip={tooltip} waterLevel={waterLevel} />
      )}
      <BuildingTooltip buildingData={buildingData} waterLevel={waterLevel} />
    </div>
  );
}
