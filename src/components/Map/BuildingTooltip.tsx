"use client";

import { useState, useEffect } from "react";
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
  fetchedAddress?: string;
}

interface BuildingTooltipProps {
  buildingData: BuildingData | null;
  waterLevel: number;
}

export function BuildingTooltip({
  buildingData,
  waterLevel,
}: BuildingTooltipProps) {
  if (!buildingData) return null;

  const getFloodStatus = (
    buildingHeight: number,
    waterLevel: number
  ): string => {
    if (!buildingHeight) return "Height unknown";

    const floorsFlooded = Math.floor(waterLevel / 3); // Assume 3m per floor
    const totalFloors = Math.floor(buildingHeight / 3);

    if (floorsFlooded <= 0) return "No flooding";
    if (floorsFlooded >= totalFloors)
      return `Completely flooded (${totalFloors} floors)`;

    return `${floorsFlooded}/${totalFloors} floors flooded`;
  };

  const getStatusColor = (
    buildingHeight: number,
    waterLevel: number
  ): string => {
    if (!buildingHeight) return "text-gray-500";

    const floorsFlooded = Math.floor(waterLevel / 3);
    const totalFloors = Math.floor(buildingHeight / 3);

    if (floorsFlooded <= 0) return "text-green-600";
    if (floorsFlooded >= totalFloors) return "text-red-600";
    if (floorsFlooded > totalFloors * 0.5) return "text-orange-600";

    return "text-yellow-600";
  };

  return (
    <div
      className="absolute z-50 bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg px-3 py-2 text-sm pointer-events-none min-w-48"
      style={{
        left: buildingData.x + 10,
        top: buildingData.y - 10,
        transform: "translateY(-100%)",
      }}
    >
      <div className="space-y-1">
        <div className="font-semibold text-gray-900">
          {buildingData.name || "Building"}
        </div>

        {buildingData.address || buildingData.fetchedAddress ? (
          <div className="text-xs text-gray-600">
            📍 {buildingData.address || buildingData.fetchedAddress}
          </div>
        ) : buildingData.lat && buildingData.lng ? (
          <div className="text-xs text-gray-500">
            📍 {buildingData.lat.toFixed(4)}, {buildingData.lng.toFixed(4)}
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic">
            📍 Location data unavailable
          </div>
        )}

        {buildingData.height && (
          <div className="text-xs text-gray-600">
            🏢 Height: {buildingData.height.toFixed(0)}m (~
            {Math.floor(buildingData.height / 3)} floors)
          </div>
        )}

        {buildingData.type && (
          <div className="text-xs text-gray-600">
            🏗️ Type: {buildingData.type}
          </div>
        )}

        <div className="border-t pt-1">
          <div
            className={`text-xs font-medium ${getStatusColor(
              buildingData.height || 0,
              waterLevel
            )}`}
          >
            💧 {getFloodStatus(buildingData.height || 0, waterLevel)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom hook to manage building tooltip
export function useBuildingTooltip(
  map: mapboxgl.Map | null,
  waterLevel: number
) {
  const [buildingData, setBuildingData] = useState<BuildingData | null>(null);

  useEffect(() => {
    if (!map) return;

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["3d-buildings"],
      });

      if (features.length > 0) {
        const feature = features[0];
        const properties = feature.properties || {};

        // Debug: Log available properties to see what data we have
        console.log("Building properties:", properties);

        // Get coordinates for potential reverse geocoding
        const coords = e.lngLat;

        setBuildingData({
          height:
            properties.height ||
            properties.render_height ||
            properties.min_height,
          address: properties.address || properties.street || null,
          name: properties.name || properties.building_name || properties.class,
          type:
            properties.type ||
            properties.building_type ||
            properties.class ||
            "Building",
          x: e.point.x,
          y: e.point.y,
          lat: coords.lat,
          lng: coords.lng,
        });
      } else {
        setBuildingData(null);
      }
    };

    const handleMouseLeave = () => {
      setBuildingData(null);
    };

    // Attach event listeners
    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", "3d-buildings", handleMouseLeave);

    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", "3d-buildings", handleMouseLeave);
    };
  }, [map, waterLevel]);

  return { buildingData };
}
