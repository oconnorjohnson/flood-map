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
  const { tooltip, attachTooltip } = useElevationTooltip(map.current);

  // Initialize building tooltip
  const { buildingData } = useBuildingTooltip(map.current, waterLevel);

  useEffect(() => {
    if (!mapContainer.current || map.current) return; // Initialize map only once

    // Create the map instance with 3D capabilities
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
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

        // Add contour source from Mapbox Terrain tileset
        map.current.addSource("contours", {
          type: "vector",
          url: "mapbox://mapbox.mapbox-terrain-v2",
        });

        // Create flood visualization using fill-extrusion based on elevation
        // This creates a 3D water surface at the specified water level
        map.current.addLayer({
          id: "flood-3d",
          type: "fill-extrusion",
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
                        [-122.55, 37.65], // Southwest (extended south)
                        [-122.3, 37.65], // Southeast (extended south and east)
                        [-122.3, 37.9], // Northeast (extended north and east)
                        [-122.55, 37.9], // Northwest (extended north)
                        [-122.55, 37.65], // Close
                      ],
                    ],
                  },
                },
              ],
            },
          },
          paint: {
            // Set the base of the water at sea level (0m)
            "fill-extrusion-base": 0,
            // Set the height to the current water level
            "fill-extrusion-height": waterLevel,
            // Water color with transparency
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              waterLevel,
              0,
              "transparent",
              1,
              "rgba(135, 206, 235, 0.8)", // Light blue at 1m
              10,
              "rgba(70, 130, 180, 0.8)", // Steel blue at 10m
              50,
              "rgba(25, 25, 112, 0.8)", // Midnight blue at 50m
              100,
              "rgba(0, 0, 139, 0.8)", // Dark blue at 100m
              200,
              "rgba(0, 0, 80, 0.8)", // Navy at 200m
            ],
            "fill-extrusion-opacity": 0.7,
          },
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
                "case",
                // Check if building would be flooded
                ["<", ["get", "min_height"], waterLevel],
                "#4169E1", // Royal blue for flooded buildings
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
    if (map.current && map.current.getLayer("flood-3d")) {
      // Update the 3D flood layer height
      map.current.setPaintProperty(
        "flood-3d",
        "fill-extrusion-height",
        waterLevel
      );

      // Update the flood color based on water level
      map.current.setPaintProperty("flood-3d", "fill-extrusion-color", [
        "interpolate",
        ["linear"],
        waterLevel,
        0,
        "transparent",
        1,
        "rgba(135, 206, 235, 0.8)",
        10,
        "rgba(70, 130, 180, 0.8)",
        50,
        "rgba(25, 25, 112, 0.8)",
        100,
        "rgba(0, 0, 139, 0.8)",
        200,
        "rgba(0, 0, 80, 0.8)",
      ]);

      // Update building colors to show flooded buildings
      if (map.current.getLayer("3d-buildings")) {
        map.current.setPaintProperty("3d-buildings", "fill-extrusion-color", [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#ff6b6b",
          [
            "case",
            ["<", ["get", "min_height"], waterLevel],
            "#4169E1", // Royal blue for flooded buildings
            [
              "interpolate",
              ["linear"],
              ["get", "height"],
              0,
              "#e1e5e9",
              50,
              "#c8d6e5",
              100,
              "#8395a7",
              200,
              "#576574",
            ],
          ],
        ]);
      }

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
