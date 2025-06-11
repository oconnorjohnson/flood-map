"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useStore } from "@/lib/store";
import { FloodOverlayLayer } from "./FloodOverlayLayer";
import { generateFloodAreas } from "./MockElevationData";
import { ElevationTooltip, useElevationTooltip } from "./ElevationTooltip";

// Initialize Mapbox access token from environment
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const isUserInteracting = useRef(false);
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

  useEffect(() => {
    if (!mapContainer.current || map.current) return; // Initialize map only once

    // Create the map instance
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: mapCenter,
      zoom: mapZoom,
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

    // Initialize flood overlay layer
    map.current.on("style.load", () => {
      if (map.current) {
        // Create and add flood overlay layer
        floodLayer.current = new FloodOverlayLayer("flood-overlay", waterLevel);
        map.current.addLayer(floodLayer.current);

        // Add flood areas based on realistic SF elevation data
        map.current.addSource("flood-areas", {
          type: "geojson",
          data: generateFloodAreas(waterLevel),
        });

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
            "fill-opacity": 0.6,
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

        // Attach tooltip after map is fully loaded
        attachTooltip();
      }
    });

    // Track user interactions to prevent infinite loops
    map.current.on("movestart", () => {
      isUserInteracting.current = true;
    });

    // Update store when map view changes (only from user interaction)
    map.current.on("moveend", () => {
      if (map.current && isUserInteracting.current) {
        const center = map.current.getCenter();
        const zoom = map.current.getZoom();
        setMapView([center.lng, center.lat], zoom);
        isUserInteracting.current = false;
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

  // Update map view when store changes (external updates only)
  useEffect(() => {
    if (map.current && !isUserInteracting.current) {
      map.current.flyTo({
        center: mapCenter,
        zoom: mapZoom,
        duration: 1000,
      });
    }
  }, [mapCenter, mapZoom]);

  // Update flood layer when water level changes
  useEffect(() => {
    if (floodLayer.current && map.current) {
      floodLayer.current.setWaterLevel(waterLevel);
      // Trigger a repaint
      map.current.triggerRepaint();

      // Update the flood areas data based on new water level
      if (map.current.getSource("flood-areas")) {
        const source = map.current.getSource(
          "flood-areas"
        ) as mapboxgl.GeoJSONSource;
        source.setData(generateFloodAreas(waterLevel));
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
