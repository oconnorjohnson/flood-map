"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useStore } from "@/lib/store";

// Initialize Mapbox access token from environment
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const { mapCenter, mapZoom, setMapView } = useStore();

  useEffect(() => {
    if (!mapContainer.current || map.current) return; // Initialize map only once

    // Create the map instance
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: mapCenter,
      zoom: mapZoom,
      antialias: true, // Better rendering quality
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Update store when map view changes
    map.current.on("moveend", () => {
      if (map.current) {
        const center = map.current.getCenter();
        const zoom = map.current.getZoom();
        setMapView([center.lng, center.lat], zoom);
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

  // Update map view when store changes (external updates)
  useEffect(() => {
    if (map.current) {
      map.current.flyTo({
        center: mapCenter,
        zoom: mapZoom,
        duration: 1000,
      });
    }
  }, [mapCenter, mapZoom]);

  return <div ref={mapContainer} className="w-full h-full" id="map" />;
}
