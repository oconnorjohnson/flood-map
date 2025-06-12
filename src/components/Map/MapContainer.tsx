"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useStore } from "@/lib/store";
import { ElevationTooltip, useElevationTooltip } from "./ElevationTooltip";
import { BuildingTooltip, useBuildingTooltip } from "./BuildingTooltip";

// Initialize Mapbox access token from environment
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const mapCenter = useStore((state) => state.mapCenter);
  const mapZoom = useStore((state) => state.mapZoom);
  const waterLevel = useStore((state) => state.waterLevel);
  const setMapView = useStore((state) => state.setMapView);

  // Initialize tooltip functionality
  const { tooltip, attachTooltip } = useElevationTooltip(
    map.current,
    waterLevel
  );

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

        // Add flood water layer using terrain data and expressions
        // This creates a realistic flood visualization based on actual elevation
        map.current.addLayer({
          id: "flood-water",
          type: "fill",
          source: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Polygon",
                    coordinates: [
                      [
                        // Cover the entire San Francisco area
                        [-122.52, 37.7], // Southwest
                        [-122.35, 37.7], // Southeast
                        [-122.35, 37.84], // Northeast
                        [-122.52, 37.84], // Northwest
                        [-122.52, 37.7], // Close polygon
                      ],
                    ],
                  },
                },
              ],
            },
          },
          paint: {
            // Use terrain elevation to determine flood areas
            // This expression samples the terrain-rgb tiles to get elevation
            "fill-opacity": [
              "case",
              // Only show water where terrain elevation is below water level
              [
                "<",
                // Sample elevation from terrain-rgb tiles
                ["get", "elevation", ["get", "terrain"]],
                waterLevel,
              ],
              0.7, // Show water with 70% opacity
              0.0, // Hide water above flood level
            ],
            "fill-color": [
              "interpolate",
              ["linear"],
              // Calculate water depth for color variation
              ["-", waterLevel, ["get", "elevation", ["get", "terrain"]]],
              0,
              "#87CEEB", // Light blue for shallow water
              5,
              "#4682B4", // Medium blue for medium depth
              10,
              "#191970", // Dark blue for deep water
            ],
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
                } as any,
                { hover: false }
              );
            }
            hoveredBuildingId = e.features[0].id;
            map.current?.setFeatureState(
              {
                source: "composite",
                sourceLayer: "building",
                id: hoveredBuildingId,
              } as any,
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
              } as any,
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
  }, []);

  // Update flood water layer when water level changes
  useEffect(() => {
    if (map.current && map.current.getLayer("flood-water")) {
      // Update the paint properties to reflect new water level
      map.current.setPaintProperty("flood-water", "fill-opacity", [
        "case",
        // Show water where elevation is below current water level
        ["<", ["get", "elevation"], waterLevel],
        0.7,
        0.0,
      ]);

      map.current.setPaintProperty("flood-water", "fill-color", [
        "interpolate",
        ["linear"],
        ["-", waterLevel, ["get", "elevation"]],
        0,
        "#87CEEB", // Light blue for shallow
        5,
        "#4682B4", // Medium blue
        10,
        "#191970", // Dark blue for deep
      ]);

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
