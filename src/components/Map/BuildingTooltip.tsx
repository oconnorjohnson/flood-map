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
  groundElevation?: number;
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
    waterLevel: number,
    groundElevation: number = 0
  ): string => {
    if (!buildingHeight) return "Height unknown";

    // Calculate actual flood depth considering ground elevation
    const floodDepth = waterLevel - groundElevation;

    if (floodDepth <= 0) return "Above water level";

    const floorsFlooded = Math.floor(floodDepth / 3); // Assume 3m per floor
    const totalFloors = Math.floor(buildingHeight / 3);

    if (floorsFlooded <= 0) return "No flooding";
    if (floorsFlooded >= totalFloors)
      return `Completely flooded (${totalFloors} floors)`;

    return `${floorsFlooded}/${totalFloors} floors flooded`;
  };

  const getStatusColor = (
    buildingHeight: number,
    waterLevel: number,
    groundElevation: number = 0
  ): string => {
    if (!buildingHeight) return "text-gray-500";

    const floodDepth = waterLevel - groundElevation;

    if (floodDepth <= 0) return "text-green-600";

    const floorsFlooded = Math.floor(floodDepth / 3);
    const totalFloors = Math.floor(buildingHeight / 3);

    if (floorsFlooded >= totalFloors) return "text-red-600";
    if (floorsFlooded > totalFloors * 0.5) return "text-orange-600";
    if (floorsFlooded > 0) return "text-yellow-600";

    return "text-green-600";
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

        {buildingData.groundElevation !== undefined && (
          <div className="text-xs text-gray-600">
            ⛰️ Ground elevation: {buildingData.groundElevation.toFixed(0)}m
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
              waterLevel,
              buildingData.groundElevation || 0
            )}`}
          >
            💧{" "}
            {getFloodStatus(
              buildingData.height || 0,
              waterLevel,
              buildingData.groundElevation || 0
            )}
          </div>
          {buildingData.groundElevation !== undefined && waterLevel > 0 && (
            <div className="text-xs text-gray-500">
              Water depth at location:{" "}
              {Math.max(0, waterLevel - buildingData.groundElevation).toFixed(
                1
              )}
              m
            </div>
          )}
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

    const handleMouseMove = async (e: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["3d-buildings"],
      });

      if (features.length > 0) {
        const feature = features[0];
        const properties = feature.properties || {};

        // Get coordinates for potential reverse geocoding
        const coords = e.lngLat;

        // Query terrain elevation at this point
        let groundElevation = 0;
        try {
          // Query the terrain source if available
          const terrain = map.getSource("mapbox-dem");
          if (terrain && map.getZoom() > 10) {
            // Get pixel coordinates on screen
            const point = map.project(coords);

            // Query elevation from terrain-rgb tiles
            const terrainFeatures = map.queryRenderedFeatures(point, {
              layers: ["hillshade"], // If you have a hillshade layer
            });

            // For now, use a simple elevation estimate based on known SF topography
            // This is a placeholder - in production you'd query actual DEM data
            const lat = coords.lat;
            const lng = coords.lng;

            // Rough elevation estimates for SF neighborhoods
            if (lng > -122.42 && lng < -122.4 && lat > 37.79 && lat < 37.81) {
              // Nob Hill area
              groundElevation = 50 + Math.random() * 30; // 50-80m
            } else if (
              lng > -122.44 &&
              lng < -122.42 &&
              lat > 37.78 &&
              lat < 37.8
            ) {
              // Pacific Heights
              groundElevation = 40 + Math.random() * 40; // 40-80m
            } else if (
              lng > -122.5 &&
              lng < -122.48 &&
              lat > 37.76 &&
              lat < 37.78
            ) {
              // Twin Peaks area
              groundElevation = 80 + Math.random() * 40; // 80-120m
            } else if (lat < 37.75) {
              // Southern SF (generally lower)
              groundElevation = 5 + Math.random() * 15; // 5-20m
            } else {
              // Default for rest of SF
              groundElevation = 10 + Math.random() * 20; // 10-30m
            }
          }
        } catch (error) {
          console.error("Error getting terrain elevation:", error);
        }

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
          groundElevation: groundElevation,
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
