"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

interface BuildingData {
  height?: number;
  address?: string;
  name?: string;
  type?: string;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  groundElevation?: number;
}

interface BuildingTooltipProps {
  buildingData: BuildingData | null;
  waterLevel: number;
}

function getFloodStatus(
  buildingHeight: number,
  waterLevel: number,
  groundElevation: number = 0
): string {
  const depth = waterLevel - groundElevation;
  if (depth <= 0) return "Above water";

  if (!buildingHeight) {
    return `${depth.toFixed(1)}m water depth at grade`;
  }

  const totalFloors = Math.max(1, Math.floor(buildingHeight / 3));
  const floodedFloors = Math.min(totalFloors, Math.floor(depth / 3));

  if (floodedFloors >= totalFloors) {
    return `Fully submerged (${totalFloors} floors)`;
  }

  if (floodedFloors <= 0) {
    return `${depth.toFixed(1)}m at street level`;
  }

  return `${floodedFloors}/${totalFloors} floors underwater`;
}

function getStatusColor(
  buildingHeight: number,
  waterLevel: number,
  groundElevation: number = 0
): string {
  const depth = waterLevel - groundElevation;
  if (depth <= 0) return "text-emerald-400";
  if (!buildingHeight) return "text-sky-300";

  const totalFloors = Math.max(1, Math.floor(buildingHeight / 3));
  const floodedFloors = Math.floor(depth / 3);

  if (floodedFloors >= totalFloors) return "text-red-400";
  if (floodedFloors > totalFloors * 0.5) return "text-orange-300";
  return "text-amber-300";
}

export function BuildingTooltip({ buildingData, waterLevel }: BuildingTooltipProps) {
  if (!buildingData) return null;

  return (
    <div
      className="pointer-events-none absolute z-50 min-w-56 rounded-lg border border-white/15 bg-slate-950/92 px-3 py-2 text-sm text-white shadow-xl backdrop-blur-sm"
      style={{
        left: buildingData.x + 12,
        top: buildingData.y - 12,
        transform: "translateY(-100%)",
      }}
    >
      <div className="space-y-1">
        <div className="font-semibold">{buildingData.name || "Building"}</div>
        {buildingData.address && (
          <div className="text-xs text-slate-300">📍 {buildingData.address}</div>
        )}
        {!buildingData.address && buildingData.lat && buildingData.lng && (
          <div className="text-xs text-slate-400">
            📍 {buildingData.lat.toFixed(4)}, {buildingData.lng.toFixed(4)}
          </div>
        )}
        {buildingData.height !== undefined && (
          <div className="text-xs text-slate-300">
            🏢 Height {buildingData.height.toFixed(0)}m (~
            {Math.max(1, Math.floor(buildingData.height / 3))} floors)
          </div>
        )}
        {buildingData.groundElevation !== undefined && (
          <div className="text-xs text-slate-300">
            ⛰️ Ground {buildingData.groundElevation.toFixed(1)}m
          </div>
        )}
        {buildingData.type && (
          <div className="text-xs text-slate-300">🏗️ {buildingData.type}</div>
        )}
        <div className="border-t border-white/10 pt-1">
          <div
            className={`text-xs font-medium ${getStatusColor(
              buildingData.height || 0,
              waterLevel,
              buildingData.groundElevation || 0
            )}`}
          >
            💧 {getFloodStatus(
              buildingData.height || 0,
              waterLevel,
              buildingData.groundElevation || 0
            )}
          </div>
          {buildingData.groundElevation !== undefined && (
            <div className="text-xs text-slate-400">
              Water at grade: {Math.max(0, waterLevel - buildingData.groundElevation).toFixed(1)}m
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function useBuildingTooltip(
  map: mapboxgl.Map | null,
  getGroundElevation: (lng: number, lat: number) => number | null,
  disabled: boolean = false
) {
  const [buildingData, setBuildingData] = useState<BuildingData | null>(null);
  const disabledRef = useRef(disabled);
  const frameRef = useRef<number | null>(null);
  const latestEventRef = useRef<mapboxgl.MapMouseEvent | null>(null);

  useEffect(() => {
    if (!map) return;

    const flushBuildingUpdate = () => {
      frameRef.current = null;

      if (
        !map ||
        !latestEventRef.current ||
        disabledRef.current ||
        map.isMoving() ||
        !map.getLayer("3d-buildings")
      ) {
        return;
      }

      const event = latestEventRef.current;
      const features = map.queryRenderedFeatures(event.point, {
        layers: ["3d-buildings"],
      });

      if (!features.length) {
        setBuildingData(null);
        return;
      }

      const feature = features[0];
      const properties = feature.properties ?? {};
      const groundElevation = getGroundElevation(event.lngLat.lng, event.lngLat.lat) ?? 0;

      setBuildingData({
        height: Number(
          properties.height ?? properties.render_height ?? properties.min_height ?? 0
        ),
        address:
          (properties.address as string | undefined) ??
          (properties.street as string | undefined) ??
          undefined,
        name:
          (properties.name as string | undefined) ??
          (properties.building_name as string | undefined) ??
          (properties.class as string | undefined) ??
          "Building",
        type:
          (properties.type as string | undefined) ??
          (properties.building_type as string | undefined) ??
          (properties.class as string | undefined) ??
          "Building",
        x: event.point.x,
        y: event.point.y,
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
        groundElevation,
      });
    };

    const handleMouseMove = (event: mapboxgl.MapMouseEvent) => {
      if (disabledRef.current || map.isMoving()) {
        setBuildingData(null);
        return;
      }

      latestEventRef.current = event;

      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(flushBuildingUpdate);
      }
    };

    const handleMouseLeave = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      latestEventRef.current = null;
      setBuildingData(null);
    };

    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", "3d-buildings", handleMouseLeave);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", "3d-buildings", handleMouseLeave);
    };
  }, [getGroundElevation, map]);

  useEffect(() => {
    disabledRef.current = disabled;

    if (!disabled) return;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    latestEventRef.current = null;
    setBuildingData(null);
  }, [disabled]);

  return { buildingData };
}
