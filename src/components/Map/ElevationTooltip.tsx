"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

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

function getFloodStatus(elevation: number, waterLevel: number): string {
  if (elevation <= waterLevel) {
    return `FLOODED (${(waterLevel - elevation).toFixed(1)}m underwater)`;
  }

  return `${(elevation - waterLevel).toFixed(1)}m above water`;
}

function getStatusColor(elevation: number, waterLevel: number): string {
  if (elevation <= waterLevel) return "text-red-500 font-semibold";
  if (elevation - waterLevel < 5) return "text-amber-400 font-medium";
  return "text-emerald-400 font-medium";
}

export function ElevationTooltip({
  tooltip,
  waterLevel,
}: ElevationTooltipProps) {
  if (!tooltip) return null;

  return (
    <div
      className="pointer-events-none absolute z-50 rounded-lg border border-white/15 bg-slate-950/90 px-3 py-2 text-sm text-white shadow-xl backdrop-blur-sm"
      style={{
        left: tooltip.x + 12,
        top: tooltip.y - 12,
        transform: "translateY(-100%)",
      }}
    >
      <div className="space-y-1">
        <div className="font-semibold">Terrain {tooltip.elevation.toFixed(1)}m</div>
        <div className="text-xs text-slate-300">
          {tooltip.lat.toFixed(4)}°, {tooltip.lng.toFixed(4)}°
        </div>
        <div className={`text-xs ${getStatusColor(tooltip.elevation, waterLevel)}`}>
          {getFloodStatus(tooltip.elevation, waterLevel)}
        </div>
      </div>
    </div>
  );
}

export function useElevationTooltip(
  map: mapboxgl.Map | null,
  getElevation: (lng: number, lat: number) => number | null,
  disabled: boolean = false
) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const disabledRef = useRef(disabled);
  const frameRef = useRef<number | null>(null);
  const latestEventRef = useRef<mapboxgl.MapMouseEvent | null>(null);

  const flushTooltipUpdate = useCallback(() => {
    frameRef.current = null;

    if (!map || disabledRef.current || map.isMoving() || !latestEventRef.current) {
      return;
    }

    const event = latestEventRef.current;
    const elevation = getElevation(event.lngLat.lng, event.lngLat.lat);

    if (elevation === null) {
      setTooltip(null);
      return;
    }

    setTooltip((current) => {
      if (
        current &&
        current.x === event.point.x &&
        current.y === event.point.y &&
        Math.abs(current.elevation - elevation) < 0.1
      ) {
        return current;
      }

      return {
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
        elevation,
        x: event.point.x,
        y: event.point.y,
      };
    });
  }, [getElevation, map]);

  const handleMouseMove = useCallback(
    (event: mapboxgl.MapMouseEvent) => {
      if (!map) return;

      if (disabledRef.current || map.isMoving()) {
        setTooltip(null);
        return;
      }

      latestEventRef.current = event;

      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(flushTooltipUpdate);
      }
    },
    [flushTooltipUpdate, map]
  );

  const handleMouseLeave = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    latestEventRef.current = null;
    setTooltip(null);
  }, []);

  useEffect(() => {
    disabledRef.current = disabled;

    if (!disabled) return;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    latestEventRef.current = null;
    setTooltip(null);
  }, [disabled]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const attachTooltip = useCallback(() => {
    if (!map) return undefined;

    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);

    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", handleMouseLeave);
    };
  }, [handleMouseLeave, handleMouseMove, map]);

  return { tooltip, attachTooltip };
}
