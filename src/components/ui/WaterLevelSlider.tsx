"use client";

import { useStore } from "@/lib/store";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WaterLevelSlider() {
  const { waterLevel, setWaterLevel } = useStore();

  const handleValueChange = (values: number[]) => {
    setWaterLevel(values[0]);
  };

  const getWaterLevelLabel = (level: number): string => {
    if (level === 0) return "Current sea level";
    if (level > 0) return `+${level}m above current`;
    return `${level}m below current`;
  };

  const getWaterLevelColor = (level: number): string => {
    if (level <= -5) return "text-blue-600";
    if (level <= 0) return "text-blue-500";
    if (level <= 5) return "text-orange-500";
    if (level <= 15) return "text-red-500";
    return "text-red-700";
  };

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
            value={[waterLevel]}
            onValueChange={handleValueChange}
            max={30}
            min={-10}
            step={0.5}
            className="w-full"
          />
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>-10m</span>
          <span>0m</span>
          <span>+30m</span>
        </div>

        {/* Preset levels */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => setWaterLevel(0)}
            className="px-2 py-1 rounded border hover:bg-muted"
          >
            Current
          </button>
          <button
            onClick={() => setWaterLevel(1)}
            className="px-2 py-1 rounded border hover:bg-muted"
          >
            +1m
          </button>
          <button
            onClick={() => setWaterLevel(5)}
            className="px-2 py-1 rounded border hover:bg-muted"
          >
            +5m
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
