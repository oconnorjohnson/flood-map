"use client";

import { useCallback, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useDebounce } from "@/hooks/use-debounce";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PRESETS = [25, 50, 75];

function getWaterTone(level: number): string {
  if (level < 40) return "text-cyan-400";
  if (level < 60) return "text-sky-400";
  return "text-blue-400";
}

function getNarrativeLabel(level: number): string {
  if (level <= 30) return "Coastal districts become canals";
  if (level <= 45) return "Downtown shoreline pushes inland";
  if (level <= 60) return "Mid-city blocks begin to drown";
  return "High-water sci-fi skyline framing";
}

export function WaterLevelSlider() {
  const waterLevel = useStore((state) => state.waterLevel);
  const setWaterLevel = useStore((state) => state.setWaterLevel);
  const debouncedWaterLevel = useDebounce(waterLevel, 50);

  const handleValueChange = useCallback(
    (values: number[]) => {
      setWaterLevel(values[0]);
    },
    [setWaterLevel]
  );

  const sliderValue = useMemo(() => [waterLevel], [waterLevel]);

  return (
    <Card className="w-80 min-w-80 border-white/10 bg-black/65 text-white shadow-2xl backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Water Plane</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className={`text-3xl font-bold ${getWaterTone(debouncedWaterLevel)}`}>
            +{debouncedWaterLevel.toFixed(0)}m
          </div>
          <div className="text-sm text-slate-300">{getNarrativeLabel(debouncedWaterLevel)}</div>
        </div>

        <div className="px-2">
          <Slider
            value={sliderValue}
            onValueChange={handleValueChange}
            max={75}
            min={25}
            step={1}
            className="w-full"
          />
        </div>

        <div className="flex justify-between text-xs text-slate-400">
          <span>25m</span>
          <span>50m</span>
          <span>75m</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setWaterLevel(preset)}
              className={`rounded border px-2 py-1 transition-colors ${
                waterLevel === preset
                  ? "border-sky-400 bg-sky-500/20 text-white"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {preset}m
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
