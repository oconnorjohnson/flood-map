"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useStore } from "@/lib/store";
import { FloodOverlayLayer } from "./FloodOverlayLayer";
import { generateFloodAreas } from "./MockElevationData";

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

        // Add a simple demo layer to show flood overlay is working
        // (This will be replaced with actual terrain data later)
        map.current.addSource("demo-flood-area", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-122.48, 37.75],
                  [-122.41, 37.75],
                  [-122.41, 37.78],
                  [-122.48, 37.78],
                  [-122.48, 37.75],
                ],
              ],
            },
          },
        });

        map.current.addLayer({
          id: "demo-flood-fill",
          type: "fill",
          source: "demo-flood-area",
          paint: {
            "fill-color": "#0080ff",
            "fill-opacity": 0.4,
          },
        });
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

      // For demo purposes, also update the simple flood area opacity
      if (map.current.getLayer("demo-flood-fill")) {
        const opacity =
          waterLevel > 0 ? Math.min(0.8, 0.2 + waterLevel * 0.1) : 0;
        map.current.setPaintProperty(
          "demo-flood-fill",
          "fill-opacity",
          opacity
        );
      }
    }
  }, [waterLevel]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      id="map"
      style={{ position: "relative" }}
    />
  );
}
