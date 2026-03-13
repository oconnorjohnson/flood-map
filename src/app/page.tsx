import { MapContainer } from "@/components/Map/MapContainer";
import { WaterLevelSlider } from "@/components/ui/WaterLevelSlider";
import { UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <MapContainer />

      <div className="absolute top-4 left-4 z-10 space-y-4">
        <WaterLevelSlider />
      </div>

      <div className="absolute top-3 right-12 z-10">
        <div className="rounded-lg bg-black/70 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
          <h1 className="text-xl font-bold">San Francisco Flood Storyboard</h1>
          <p className="text-sm text-slate-300">
            Ocean-connected 3D water plane for cinematic scouting
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10">
        <div className="rounded-lg bg-black/70 p-2 shadow-lg backdrop-blur-sm">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
        </div>
      </div>

      <div className="absolute bottom-16 left-4 z-10">
        <div className="rounded-lg bg-black/70 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
          <h3 className="mb-2 text-sm font-semibold">Reading the frame</h3>
          <div className="space-y-1 text-xs text-slate-200">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-sky-400"></div>
              <span>Water plane = connected ocean reach only</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-slate-300"></div>
              <span>Buildings stay solid for skyline silhouette checks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-emerald-400"></div>
              <span>Hover terrain/buildings to inspect clearance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-amber-300"></div>
              <span>Best used with a low pitch and rotated street approach</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
