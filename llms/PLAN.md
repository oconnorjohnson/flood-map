Product Requirements & Architecture Document
“Sea-Rise Map Tool” v0.1 – San Francisco Pilot

1. Purpose & High-Level Goals
   Goal Success Metric Notes
   Let two writers instantly see what parts of SF drown at any chosen static sea-level < 3 s to update overlay Sub-meter accuracy, street-level context
   Screenshot (with legend) for storyboards 1-click download PNG, ≤ 4 K resolution Legend auto-labels height, lat/long, date
   Foundation for other cities later New city added by CLI ingest in < 1 hr, no code changes Data pipeline is city-agnostic

2. Scope v0.1 (Must-Have)
   Area: City & County of San Francisco LIDAR DEM @ ≤ 1 m resolution.

Controls: single slider (-10 m → +30 m) with presets “Low Tide (-0.5 m)”, “Mean Sea Level (0 m)”, “+2 m”, “+5 m”, “+10 m”.

View: 2-D web-mercator map with semi-transparent blue overlay on pixels where elevation < chosen water level.

Interaction

Scroll/drag/zoom (standard map)

Hover tooltip: street name, elevation (m), inundation status (Dry / Wet)

Legend auto-updates with chosen level, tide preset.

Export

Button “Export PNG”. Captures current viewport + legend, max 3840 × 2160.

Auth: Clerk email/password or social login; route-guard everything else.

Storage:

Settings & last water level in localStorage.

No server DB in v0.1.

Platforms: Desktop Chromium-based + Safari; ≥ 1280 px wide; no mobile CSS.

3. Out-of-Scope (v0.1)
   Animated tides, temporal simulation.

3-D terrain, WebGL fly-through.

Database for saved scenarios (MVP keeps it local).

Public sharing links / multi-user collab.

Global coverage (pipeline ready but data not shipped).

4. Users & Personas
   Persona Skill Key Need
   Showrunner (Daniel) React power user Rapid visualization, export
   Co-Writer Non-technical Same, but may adjust slider

Both behind Clerk; no admin/roles complexity.

5. Data Sources & Licensing
   Layer Source Resolution License
   DEM USGS 3DEP LIDAR (2020 “USGS_LPC_CA_SanFrancisco_2020”) 0.5 m Public Domain
   Streets & basemap Mapbox Streets v12 n/a Free ≤ 50 k tile requests/month on dev token (should fit)

Future-proof: CLI importer assumes GeoTIFF. Any other city = drop raw LAZ/GeoTIFF in /data, run npm run ingest -- --city=nyc.

6. Functional Requirements
   Authentication

Clerk “ProtectRoute” wrapper on /app/\*

Session persisted; redirect unauth to /login.

Water-Level Slider

Value updates URL hash (/app?wl=2.0) for shareable state.

Debounced 100 ms to avoid thrashing.

Rendering Pipeline (Client-side)

Mapbox GL JS loads basemap.

@loaders.gl/terrain decodes pre-tiled Terrain-RGB raster (8-bit encoded elevation).

Custom WebGL layer shades pixels with alpha = 0.6 if elevation < waterLevel.

Street labels sit above overlay (Mapbox label layer order).

Hover Tooltip

Reverse-geocode via in-memory vector tiles (Mapbox Streets local tile).

Query terrain pixel value → show number (m).

Export PNG

html2canvas screenshot of #mapContainer + overlayed legend.

Auto-downloads sea-rise-sf-{level}m-{timestamp}.png.

7. Non-Functional Requirements
   Category Target
   Performance First usable paint ≤ 2 s on M3 Max MBP; slider frame-rate ≥ 30 fps
   Cost Mapbox dev tier ≤ 50 k tiles/month (≈ $0). Vercel hobby: free. Clerk Free tier: free.
   Bundle Size < 1.5 MB gzipped. Use dynamic imports for Mapbox GL.
   Accessibility Legend & slider keyboard-operable. Contrast AA.

8. System Architecture
   java
   Copy
   browser (React/Next.js)
   ├── Mapbox GL JS (basemap + label tiles)
   ├── TerrainOverlayLayer (custom WebGL shader)
   │ ↳ fetches /tiles/{z}/{x}/{y}.png (Terrain-RGB) from Vercel static
   ├── UI (Slider, Legend, ExportBtn)
   └── Clerk SDK
   Vercel (static hosting)
   ├── Next pages (app router, all client components)
   └── Static DEM tile bucket (generated offline, uploaded during CI)
   GitHub → Vercel CI
   CLI Ingest Script (Node) <-- one-off run per city
   8.1 DEM Ingest CLI
   Download LAZ → convert to GeoTIFF (PDAL, gdal).

Clip to bounding box.

GDAL dem → 8-bit Terrain-RGB PNG tiles (z=10-15) into /public/tiles/sf.

Push to repo; CI deploy.

Runs locally; no server cost. Takes ≈ 20 min on M2 for SF.

9. Tech Stack
   Layer Package
   UI Next.js 14 (app router, all-client), React 18, shadcn/ui
   Map mapbox-gl v3, @loaders.gl/core + terrain
   Auth @clerk/nextjs (SSR disabled)
   State zustand (slider, legend)
   Screenshot html2canvas
   CLI Node 20, PDAL, GDAL via Docker multi-stage

10. Extensibility Hooks (vNext thought)
    Add point-of-interest labels (schools, hospitals) via extra vector layer.

DB option: Supabase if you later need shared “scenarios.”

3-D toggle: drop in Deck.gl TerrainLayer, same tile source.

API pricing: swap Mapbox for open-source (tile.nextzen.org) if usage grows.

11. Risks & Mitigations
    Risk Impact Mitigation
    LIDAR download huge (~8 GB) Ingest hassle Script trims to city limits; keep GeoTIFF out of repo, only tiles (~150 MB) committed
    Mapbox usage burst Cost spike Hard-code token check → fails closed after 40 k calls/month; offline tiles if needed
    WebGL driver quirks Wrong overlay Unit tests w/ puppeteer diff screenshots
    Two devs no Swift N/A React chosen

12. Milestones / Rough Effort (single dev)
    Task Hours
    DEM pipeline script + docs 6
    Next.js scaffold + Clerk 2
    Mapbox base + terrain shader 6
    Slider UI + state 2
    Tooltip & street names 3
    Legend + export PNG 3
    A11y, polish, README 2
    Total 24 h (~3 dev days)

13. Budget Check
    Vercel Hobby: $0

Mapbox dev token: $0 ≤ 50 k monthly.

Clerk free tier: $0.

Domain (optional): $12/yr.

S3 backup of tiles: $0.01/mo.

≈ $12 / yr → well under $20/mo.

14. Next Steps (Action List)
    Daniel: confirm target water-level presets list.

AI (me): supply CLI ingest script template.

Generate Mapbox token & Clerk app; drop into .env.

Kick off DEM download tonight (~8 GB).

Day-1 sprint: get base map + static overlay at fixed level.

Day-2: wire slider, tooltip.

Day-3: export, polish, deploy to sea-rise.vercel.app.
