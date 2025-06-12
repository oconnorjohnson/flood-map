"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useStore } from "@/lib/store";
import { FloodOverlayLayer } from "./FloodOverlayLayer";
import { generateFloodAreas } from "./MockElevationData";
import { ElevationTooltip, useElevationTooltip } from "./ElevationTooltip";
import { BuildingTooltip, useBuildingTooltip } from "./BuildingTooltip";

// Initialize Mapbox access token from environment
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const floodLayer = useRef<FloodOverlayLayer | null>(null);

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

    // Initialize 3D terrain and flood overlay layer
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

        // Create flood overlay layer (disabled for now to prevent blue overlay)
        floodLayer.current = new FloodOverlayLayer("flood-overlay", waterLevel);
        // map.current.addLayer(floodLayer.current); // Commented out to prevent blue overlay

        // Add flood areas based on realistic SF elevation data
        map.current.addSource("flood-areas", {
          type: "geojson",
          data: generateFloodAreas(waterLevel),
        });

        // Add 3D extruded flood areas for better 3D visualization
        map.current.addLayer({
          id: "flood-areas-3d",
          type: "fill-extrusion",
          source: "flood-areas",
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "elevation"],
              0,
              "#0066cc", // Deep blue for very low areas
              3,
              "#0080ff", // Medium blue for low areas
              8,
              "#66a3ff", // Light blue for moderate areas
              12,
              "#99c2ff", // Very light blue for higher areas
            ],
            "fill-extrusion-height": [
              "*",
              ["get", "elevation"], // Use elevation property
              0.5, // Scale factor for visual effect
            ],
            "fill-extrusion-opacity": 0.8,
          },
        });

        // Also keep a flat version for areas at water level
        map.current.addLayer({
          id: "flood-areas-fill",
          type: "fill",
          source: "flood-areas",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "elevation"],
              0,
              "#0066cc", // Deep blue for very low areas
              3,
              "#0080ff", // Medium blue for low areas
              8,
              "#66a3ff", // Light blue for moderate areas
              12,
              "#99c2ff", // Very light blue for higher areas
            ],
            "fill-opacity": 0.3,
          },
        });

        // Add borders for flooded areas
        map.current.addLayer({
          id: "flood-areas-line",
          type: "line",
          source: "flood-areas",
          paint: {
            "line-color": "#003d99",
            "line-width": 2,
            "line-opacity": 0.8,
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

  // Note: Removed automatic map view updates to prevent interaction conflicts
  // The map view will only update from user interactions now

  // Update flood areas when water level changes
  useEffect(() => {
    if (map.current) {
      // Update the flood areas data based on new water level
      if (map.current.getSource("flood-areas")) {
        const floodData = generateFloodAreas(waterLevel);
        console.log(
          "Updating flood areas for water level:",
          waterLevel,
          "Features:",
          floodData.features.length
        );
        const source = map.current.getSource(
          "flood-areas"
        ) as mapboxgl.GeoJSONSource;
        source.setData(floodData);
      }
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
    </div>
  );
}
