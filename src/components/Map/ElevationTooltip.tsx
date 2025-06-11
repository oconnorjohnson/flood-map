"use client";

import { useState, useCallback } from "react";
import { getElevationAtPoint } from "./MockElevationData";

interface TooltipData {
  lat: number;
  lng: number;
  elevation: number;
  x: number;
  y: number;
}

interface ElevationTooltipProps {
  tooltip: TooltipData | null;
  waterLevel: number;
}

export function ElevationTooltip({ tooltip }: ElevationTooltipProps) {
  if (!tooltip) return null;

  const getFloodStatus = (elevation: number, waterLevel: number): string => {
    if (elevation <= waterLevel) {
      return `FLOODED (${(waterLevel - elevation).toFixed(1)}m underwater)`;
    }
    const safety = elevation - waterLevel;
    if (safety < 2) return `AT RISK (${safety.toFixed(1)}m above water)`;
    if (safety < 5) return `LOW RISK (${safety.toFixed(1)}m above water)`;
    return `SAFE (${safety.toFixed(1)}m above water)`;
  };

  const getStatusColor = (elevation: number, waterLevel: number): string => {
    if (elevation <= waterLevel) return "text-red-600 font-bold";
    const safety = elevation - waterLevel;
    if (safety < 2) return "text-orange-600 font-semibold";
    if (safety < 5) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div
      className="absolute z-50 bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg px-3 py-2 text-sm pointer-events-none"
      style={{
        left: tooltip.x + 10,
        top: tooltip.y - 10,
        transform: "translateY(-100%)",
      }}
    >
      <div className="space-y-1">
        <div className="font-semibold text-gray-900">
          Elevation: {tooltip.elevation.toFixed(1)}m
        </div>
        <div className="text-xs text-gray-600">
          {tooltip.lat.toFixed(4)}°, {tooltip.lng.toFixed(4)}°
        </div>
        <div className={`text-xs ${getStatusColor(tooltip.elevation, 0)}`}>
          {getFloodStatus(tooltip.elevation, 0)}
        </div>
      </div>
    </div>
  );
}

// Hook for managing tooltip state
export function useElevationTooltip(
  map: mapboxgl.Map | null,
  waterLevel: number
) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const handleMouseMove = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      if (!map) return;

      const { lngLat, point } = e;
      const elevation = getElevationAtPoint(lngLat.lat, lngLat.lng);

      setTooltip({
        lat: lngLat.lat,
        lng: lngLat.lng,
        elevation,
        x: point.x,
        y: point.y,
      });
    },
    [map]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Add event listeners when map is available
  const attachTooltip = useCallback(() => {
    if (!map) return;

    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);

    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", handleMouseLeave);
    };
  }, [map, handleMouseMove, handleMouseLeave]);

  return { tooltip, attachTooltip };
}
