"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useStore } from "@/lib/store";
import { ElevationTooltip, useElevationTooltip } from "./ElevationTooltip";
import { BuildingTooltip, useBuildingTooltip } from "./BuildingTooltip";

// Initialize Mapbox access token from environment
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Realistic San Francisco flood zones based on actual elevation data
// These represent areas that would flood at different water levels
const generateFloodZones = (waterLevel: number): GeoJSON.FeatureCollection => {
  const features: GeoJSON.Feature[] = [];

  // Define elevation contours for San Francisco (in meters above sea level)
  const elevationZones = [
    // Sea level and very low areas (0-2m) - Mission Bay, waterfront
    {
      maxElevation: 2,
      areas: [
        {
          name: "Mission Bay",
          coordinates: [
            [-122.395, 37.77],
            [-122.385, 37.77],
            [-122.385, 37.765],
            [-122.395, 37.765],
            [-122.395, 37.77],
          ],
        },
        {
          name: "Bay Waterfront",
          coordinates: [
            [-122.39, 37.79],
            [-122.385, 37.79],
            [-122.385, 37.785],
            [-122.39, 37.785],
            [-122.39, 37.79],
          ],
        },
      ],
    },
    // Low elevation (2-5m) - SOMA, parts of Mission Bay
    {
      maxElevation: 5,
      areas: [
        {
          name: "SOMA Flats",
          coordinates: [
            [-122.405, 37.775],
            [-122.39, 37.775],
            [-122.39, 37.77],
            [-122.405, 37.77],
            [-122.405, 37.775],
          ],
        },
        {
          name: "Mission Creek",
          coordinates: [
            [-122.395, 37.768],
            [-122.388, 37.768],
            [-122.388, 37.762],
            [-122.395, 37.762],
            [-122.395, 37.768],
          ],
        },
      ],
    },
    // Medium-low elevation (5-10m) - Marina District, parts of SOMA
    {
      maxElevation: 10,
      areas: [
        {
          name: "Marina District",
          coordinates: [
            [-122.45, 37.805],
            [-122.43, 37.805],
            [-122.43, 37.795],
            [-122.45, 37.795],
            [-122.45, 37.805],
          ],
        },
        {
          name: "Fisherman's Wharf",
          coordinates: [
            [-122.42, 37.81],
            [-122.405, 37.81],
            [-122.405, 37.8],
            [-122.42, 37.8],
            [-122.42, 37.81],
          ],
        },
      ],
    },
    // Medium elevation (10-20m) - Lower Mission, parts of Castro
    {
      maxElevation: 20,
      areas: [
        {
          name: "Lower Mission",
          coordinates: [
            [-122.425, 37.765],
            [-122.415, 37.765],
            [-122.415, 37.755],
            [-122.425, 37.755],
            [-122.425, 37.765],
          ],
        },
        {
          name: "Potrero Hill Base",
          coordinates: [
            [-122.4, 37.76],
            [-122.39, 37.76],
            [-122.39, 37.75],
            [-122.4, 37.75],
            [-122.4, 37.76],
          ],
        },
      ],
    },
    // Higher elevation (20-40m) - Castro, Lower Pacific Heights
    {
      maxElevation: 40,
      areas: [
        {
          name: "Castro Lower",
          coordinates: [
            [-122.435, 37.765],
            [-122.425, 37.765],
            [-122.425, 37.755],
            [-122.435, 37.755],
            [-122.435, 37.765],
          ],
        },
        {
          name: "Lower Haight",
          coordinates: [
            [-122.445, 37.775],
            [-122.435, 37.775],
            [-122.435, 37.765],
            [-122.445, 37.765],
            [-122.445, 37.775],
          ],
        },
      ],
    },
    // High elevation (40-80m) - Pacific Heights, parts of Nob Hill
    {
      maxElevation: 80,
      areas: [
        {
          name: "Pacific Heights Lower",
          coordinates: [
            [-122.445, 37.795],
            [-122.435, 37.795],
            [-122.435, 37.785],
            [-122.445, 37.785],
            [-122.445, 37.795],
          ],
        },
        {
          name: "Western Addition",
          coordinates: [
            [-122.44, 37.785],
            [-122.43, 37.785],
            [-122.43, 37.775],
            [-122.44, 37.775],
            [-122.44, 37.785],
          ],
        },
      ],
    },
    // Very high elevation (80-150m) - Nob Hill, Russian Hill lower areas
    {
      maxElevation: 150,
      areas: [
        {
          name: "Nob Hill Lower",
          coordinates: [
            [-122.42, 37.795],
            [-122.41, 37.795],
            [-122.41, 37.785],
            [-122.42, 37.785],
            [-122.42, 37.795],
          ],
        },
        {
          name: "Russian Hill Lower",
          coordinates: [
            [-122.425, 37.805],
            [-122.415, 37.805],
            [-122.415, 37.795],
            [-122.425, 37.795],
            [-122.425, 37.805],
          ],
        },
      ],
    },
  ];

  // Add flooded areas based on current water level
  for (const zone of elevationZones) {
    if (waterLevel > zone.maxElevation) {
      for (const area of zone.areas) {
        const depth = waterLevel - zone.maxElevation;
        features.push({
          type: "Feature",
          properties: {
            name: area.name,
            elevation: zone.maxElevation,
            waterDepth: depth,
            waterLevel: waterLevel,
          },
          geometry: {
            type: "Polygon",
            coordinates: [area.coordinates],
          },
        });
      }
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const mapCenter = useStore((state) => state.mapCenter);
  const mapZoom = useStore((state) => state.mapZoom);
  const waterLevel = useStore((state) => state.waterLevel);
  const setMapView = useStore((state) => state.setMapView);

  // Initialize tooltip functionality
  const { tooltip, attachTooltip } = useElevationTooltip(map.current);

  // Initialize building tooltip
  const { buildingData } = useBuildingTooltip(map.current, waterLevel);

  useEffect(() => {
    if (!mapContainer.current || map.current) return; // Initialize map only once

    // Create the map instance with 3D capabilities
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12", // Better for 3D terrain
      center: mapCenter,
      zoom: mapZoom,
      pitch: 45, // Add initial 3D tilt
      bearing: 0, // Initial rotation
      antialias: true, // Better rendering quality
      // Ensure interactions are enabled
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
        // Add Mapbox terrain source for 3D elevation
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

        // Add sky layer for realistic 3D atmosphere
        map.current.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 0.0],
            "sky-atmosphere-sun-intensity": 15,
          },
        });

        // Add flood water source and layer
        map.current.addSource("flood-data", {
          type: "geojson",
          data: generateFloodZones(waterLevel),
        });

        map.current.addLayer({
          id: "flood-water",
          type: "fill",
          source: "flood-data",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "waterDepth"],
              0,
              "#87CEEB", // Light blue for shallow water
              5,
              "#4682B4", // Medium blue for medium depth
              10,
              "#1E90FF", // Deeper blue
              20,
              "#0000CD", // Dark blue for very deep water
            ],
            "fill-opacity": 0.7,
          },
        });

        // Add flood water outline for better visibility
        map.current.addLayer({
          id: "flood-water-outline",
          type: "line",
          source: "flood-data",
          paint: {
            "line-color": "#0066CC",
            "line-width": 2,
            "line-opacity": 0.8,
          },
        });

        // Add 3D buildings layer
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

        // Add building hover effects for red highlighting
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

  // Update flood water layer when water level changes
  useEffect(() => {
    if (map.current && map.current.getSource("flood-data")) {
      // Update the flood data with new water level
      const source = map.current.getSource(
        "flood-data"
      ) as mapboxgl.GeoJSONSource;
      source.setData(generateFloodZones(waterLevel));

      console.log(
        `Updated flood visualization for water level: ${waterLevel}m`
      );
    }
  }, [waterLevel]);

  return (
    <div className="w-full h-full relative">
      <div
        ref={mapContainer}
        className="w-full h-full"
        id="map"
        style={{ position: "relative" }}
      />
      <ElevationTooltip tooltip={tooltip} waterLevel={waterLevel} />
      <BuildingTooltip buildingData={buildingData} waterLevel={waterLevel} />
    </div>
  );
}
