"use client";

import { useCallback, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WaterLevelSlider() {
  const waterLevel = useStore((state) => state.waterLevel);
  const setWaterLevel = useStore((state) => state.setWaterLevel);

  const handleValueChange = useCallback(
    (values: number[]) => {
      setWaterLevel(values[0]);
    },
    [setWaterLevel]
  );

  const getWaterLevelLabel = useCallback((level: number): string => {
    if (level === 0) return "Current 2025 sea level";
    if (level <= 2) return `+${level}m - Near-term warming`;
    if (level <= 10) return `+${level}m - Severe climate change`;
    if (level <= 50) return `+${level}m - Catastrophic scenarios`;
    if (level <= 100) return `+${level}m - Ice sheet collapse`;
    return `+${level}m - Extreme/theoretical`;
  }, []);

  const getWaterLevelColor = useCallback((level: number): string => {
    if (level === 0) return "text-blue-500";
    if (level <= 2) return "text-yellow-500"; // Near-term projections
    if (level <= 10) return "text-orange-500"; // Severe scenarios
    if (level <= 50) return "text-red-500"; // Catastrophic
    if (level <= 100) return "text-red-700"; // Ice sheet collapse
    return "text-purple-700"; // Extreme/theoretical
  }, []);

  const sliderValue = useMemo(() => [waterLevel], [waterLevel]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Water Level</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div
            className={`text-2xl font-bold ${getWaterLevelColor(waterLevel)}`}
          >
            {waterLevel > 0 ? "+" : ""}
            {waterLevel}m
          </div>
          <div className="text-sm text-muted-foreground">
            {getWaterLevelLabel(waterLevel)}
          </div>
        </div>

        <div className="px-2">
          <Slider
            value={sliderValue}
            onValueChange={handleValueChange}
            max={200}
            min={0}
            step={0.5}
            className="w-full"
            defaultValue={[0]}
          />
          {/* Debug info */}
          <div className="text-xs text-gray-500 mt-1">
            Debug: Current={waterLevel}, Max=200, Min=0, SliderValue=
            {JSON.stringify(sliderValue)}
          </div>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0m (2025)</span>
          <span>50m</span>
          <span>100m</span>
          <span>200m</span>
        </div>

        {/* Preset levels */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => setWaterLevel(0)}
            className="px-2 py-1 rounded border hover:bg-muted"
          >
            2025
          </button>
          <button
            onClick={() => setWaterLevel(2)}
            className="px-2 py-1 rounded border hover:bg-muted"
          >
            2100
          </button>
          <button
            onClick={() => setWaterLevel(10)}
            className="px-2 py-1 rounded border hover:bg-muted"
          >
            Severe
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs mt-1">
          <button
            onClick={() => setWaterLevel(50)}
            className="px-2 py-1 rounded border hover:bg-muted"
          >
            Ice Melt
          </button>
          <button
            onClick={() => setWaterLevel(100)}
            className="px-2 py-1 rounded border hover:bg-muted"
          >
            Extreme
          </button>
        </div>

        {/* Test button for high values */}
        <div className="grid grid-cols-1 gap-2 text-xs mt-1">
          <button
            onClick={() => setWaterLevel(150)}
            className="px-2 py-1 rounded border hover:bg-muted bg-purple-100"
          >
            Test 150m
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
