"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useStore } from "@/lib/store";
import { ElevationTooltip, useElevationTooltip } from "./ElevationTooltip";
import { BuildingTooltip, useBuildingTooltip } from "./BuildingTooltip";
import { ConnectedWaterLayer } from "./ConnectedWaterLayer";
import { TerrainRgbModel } from "./FloodModel";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function getFirstSymbolLayerId(map: mapboxgl.Map): string | undefined {
  return map
    .getStyle()
    .layers?.find((layer) => layer.type === "symbol")?.id;
}

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const terrainModel = useRef<TerrainRgbModel | null>(null);
  const waterLayer = useRef<ConnectedWaterLayer | null>(null);
  const tooltipCleanupRef = useRef<(() => void) | null>(null);
  const initialView = useRef({
    center: useStore.getState().mapCenter,
    zoom: useStore.getState().mapZoom,
  });
  const initialWaterLevel = useRef(useStore.getState().waterLevel);

  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [terrainReady, setTerrainReady] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading San Francisco terrain…");
  const [terrainError, setTerrainError] = useState<string | null>(null);

  const waterLevel = useStore((state) => state.waterLevel);

  const getElevation = useCallback((lng: number, lat: number): number | null => {
    return terrainModel.current?.getElevation(lng, lat) ?? null;
  }, []);

  const { tooltip, attachTooltip } = useElevationTooltip(
    mapInstance,
    getElevation,
    isNavigating
  );
  const { buildingData } = useBuildingTooltip(mapInstance, getElevation, isNavigating);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (!mapboxgl.accessToken) {
      setTerrainError("Missing NEXT_PUBLIC_MAPBOX_TOKEN.");
      setStatusMessage("Mapbox token missing");
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: initialView.current.center,
      zoom: initialView.current.zoom,
      pitch: 72,
      bearing: -20,
      antialias: true,
      dragRotate: true,
      pitchWithRotate: true,
      maxPitch: 85,
    });

    mapRef.current = map;
    setMapInstance(map);
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const initializeMap = async () => {
      try {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.terrain-rgb",
          tileSize: 512,
          maxzoom: 14,
        });

        map.setTerrain({
          source: "mapbox-dem",
          exaggeration: 1,
        });

        map.setFog({
          range: [0.8, 8],
          color: "rgba(190, 210, 235, 0.8)",
          "high-color": "rgba(13, 30, 56, 0.65)",
          "space-color": "rgba(7, 12, 18, 1)",
          "horizon-blend": 0.12,
          "star-intensity": 0,
        });

        if (!map.getLayer("3d-buildings")) {
          map.addLayer(
            {
              id: "3d-buildings",
              source: "composite",
              "source-layer": "building",
              filter: ["==", "extrude", "true"],
              type: "fill-extrusion",
              minzoom: 13,
              paint: {
                "fill-extrusion-color": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "height"], 0],
                  0,
                  "#d7dde5",
                  50,
                  "#bcc8d3",
                  150,
                  "#7f8b99",
                  300,
                  "#4a5563",
                ],
                "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
                "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
                "fill-extrusion-opacity": 0.96,
                "fill-extrusion-ambient-occlusion-intensity": 0.35,
                "fill-extrusion-vertical-gradient": true,
              },
            },
            getFirstSymbolLayerId(map)
          );
        }

        const model = new TerrainRgbModel(mapboxgl.accessToken || "");
        terrainModel.current = model;

        const layer = new ConnectedWaterLayer(
          model.metadata.bounds,
          initialWaterLevel.current
        );
        waterLayer.current = layer;
        map.addLayer(layer, "3d-buildings");

        setMapLoaded(true);
        setStatusMessage("Downloading Terrain-RGB tiles…");

        await model.load();

        setStatusMessage("Solving ocean-connected flood extent…");
        const mask = model.buildFloodMask(initialWaterLevel.current);
        layer.updateMask(mask, model.metadata.width, model.metadata.height);

        setTerrainReady(true);
        setStatusMessage("Ready");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to initialize flood scene";
        setTerrainError(message);
        setStatusMessage("Initialization failed");
      }
    };

    map.once("load", () => {
      void initializeMap();
    });

    return () => {
      tooltipCleanupRef.current?.();
      tooltipCleanupRef.current = null;
      map.remove();
      mapRef.current = null;
      terrainModel.current = null;
      waterLayer.current = null;
      setMapInstance(null);
    };
  }, []);

  useEffect(() => {
    if (!mapInstance) return;

    let navigationTimeout: number | null = null;

    const handleMoveStart = () => {
      if (navigationTimeout !== null) {
        window.clearTimeout(navigationTimeout);
        navigationTimeout = null;
      }
      setIsNavigating(true);
    };

    const handleMoveEnd = () => {
      if (navigationTimeout !== null) {
        window.clearTimeout(navigationTimeout);
      }

      navigationTimeout = window.setTimeout(() => {
        setIsNavigating(false);
        navigationTimeout = null;
      }, 120);
    };

    mapInstance.on("movestart", handleMoveStart);
    mapInstance.on("moveend", handleMoveEnd);

    return () => {
      mapInstance.off("movestart", handleMoveStart);
      mapInstance.off("moveend", handleMoveEnd);
      if (navigationTimeout !== null) {
        window.clearTimeout(navigationTimeout);
      }
    };
  }, [mapInstance]);

  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;

    tooltipCleanupRef.current?.();
    tooltipCleanupRef.current = attachTooltip() ?? null;

    return () => {
      tooltipCleanupRef.current?.();
      tooltipCleanupRef.current = null;
    };
  }, [attachTooltip, mapInstance, mapLoaded]);

  useEffect(() => {
    if (!terrainReady || !terrainModel.current || !waterLayer.current) return;

    let cancelled = false;
    setStatusMessage("Recomputing connected flood extent…");

    const timeoutId = window.setTimeout(() => {
      if (!terrainModel.current || !waterLayer.current || cancelled) return;

      waterLayer.current.setWaterLevel(waterLevel);
      const mask = terrainModel.current.buildFloodMask(waterLevel);

      if (cancelled) return;

      waterLayer.current.updateMask(
        mask,
        terrainModel.current.metadata.width,
        terrainModel.current.metadata.height
      );
      setStatusMessage("Ready");
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [terrainReady, waterLevel]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-[22rem] z-10">
        <div className="rounded-lg bg-black/55 px-3 py-2 text-sm text-white backdrop-blur-sm shadow-lg">
          <div className="font-medium">3D ocean-connected flood view</div>
          <div className="text-white/80">{statusMessage}</div>
          {terrainError && <div className="text-red-300">{terrainError}</div>}
        </div>
      </div>

      {mapLoaded && <ElevationTooltip tooltip={tooltip} waterLevel={waterLevel} />}
      <BuildingTooltip buildingData={buildingData} waterLevel={waterLevel} />
    </div>
  );
}
