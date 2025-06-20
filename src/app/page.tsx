import { MapContainer } from "@/components/Map/MapContainer";
import { WaterLevelSlider } from "@/components/ui/WaterLevelSlider";
import { UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Map Container - Full Screen */}
      <MapContainer />

      {/* UI Controls Overlay */}
      <div className="absolute top-4 left-4 z-10 space-y-4">
        <WaterLevelSlider />
      </div>

      {/* Header with App Title */}
      <div className="absolute top-3 right-12 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
          <h1 className="text-lg font-bold text-gray-900">
            San Francisco Sea Level Rise
          </h1>
          <p className="text-sm text-gray-600">
            Interactive flood visualization tool
          </p>
        </div>
      </div>

      {/* User Controls - Bottom Left */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-16 left-4 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg">
          <h3 className="text-sm font-semibold mb-2 text-gray-900">
            Sea Level Rise Scenarios
          </h3>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>2025 baseline (0m)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>Near-term (0-2m)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span>Severe scenarios (2-10m)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Catastrophic (10-50m)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-700 rounded"></div>
              <span>Ice sheet collapse (50-100m)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-700 rounded"></div>
              <span>Extreme/theoretical (100m+)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
