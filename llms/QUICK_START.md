# Quick Start Guide - Sea-Rise Map Tool

## Prerequisites Checklist

- [ ] Node.js 20+ installed
- [ ] pnpm installed (`npm install -g pnpm`)
- [ ] Docker Desktop running
- [ ] Git configured
- [ ] 10GB free disk space (for DEM data)

## Day 1: Initial Setup (2-3 hours)

### 1. Clone and Initialize

```bash
# Clone repository
git clone [repo-url]
cd flood-map

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env.local
```

### 2. Get API Keys

1. **Mapbox**

   - Go to https://mapbox.com
   - Create account → Create token
   - Add to `.env.local`: `NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx`

2. **Clerk**
   - Go to https://clerk.com
   - Create application → Get keys
   - Add to `.env.local`:
     ```
     NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx
     CLERK_SECRET_KEY=sk_xxx
     ```

### 3. Initialize Next.js App

```bash
# Create Next.js app with our config
pnpm create next-app@latest . --typescript --tailwind --app --use-pnpm

# Install core dependencies
pnpm add mapbox-gl @clerk/nextjs zustand
pnpm add -D @types/mapbox-gl
```

### 4. Test Basic Setup

```bash
# Start dev server
pnpm dev

# Visit http://localhost:3000
```

## Day 2: Data Pipeline (4-5 hours)

### 1. Download DEM Data

```bash
# Create data directory
mkdir -p data/raw

# Download script will be provided
node scripts/download-dem.js --city=sf
```

### 2. Process DEM to Tiles

```bash
# Build Docker image
docker build -f Dockerfile.processing -t dem-processor .

# Run processing pipeline
docker run -v $(pwd)/data:/data dem-processor \
  node scripts/process-dem.js --city=sf

# Generate tiles
node scripts/generate-tiles.js \
  --input=data/processed/sf.tif \
  --output=public/tiles/sf
```

### 3. Verify Tiles

```bash
# Check tile count
find public/tiles/sf -name "*.png" | wc -l

# Should see ~1000-2000 tiles
```

## Day 3: Core Features (6-8 hours)

### 1. Map Component

Create `components/Map/MapContainer.tsx`:

```typescript
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export function MapContainer() {
  // Basic map setup
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-122.4194, 37.7749], // SF
      zoom: 12,
    });
  }, []);

  return <div id="map" className="w-full h-full" />;
}
```

### 2. Water Level Slider

```bash
# Install shadcn/ui
pnpm dlx shadcn-ui@latest init
pnpm dlx shadcn-ui@latest add slider
```

### 3. State Management

Create `lib/store.ts`:

```typescript
import { create } from "zustand";

interface AppState {
  waterLevel: number;
  setWaterLevel: (level: number) => void;
}

export const useStore = create<AppState>((set) => ({
  waterLevel: 0,
  setWaterLevel: (level) => set({ waterLevel: level }),
}));
```

## Critical Path Checklist

### Week 1 Goals

- [ ] Environment fully configured
- [ ] DEM data processed into tiles
- [ ] Basic map displaying
- [ ] Slider controlling water level
- [ ] Authentication working

### Week 2 Goals

- [ ] Flood overlay rendering
- [ ] Hover tooltips functional
- [ ] Export feature complete
- [ ] All tests passing
- [ ] Deployed to Vercel

## Common Issues & Solutions

### Issue: Mapbox tiles not loading

```bash
# Check token is set
echo $NEXT_PUBLIC_MAPBOX_TOKEN

# Verify in browser console
console.log(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
```

### Issue: DEM processing fails

```bash
# Ensure Docker has enough memory
# Docker Desktop → Settings → Resources → Memory: 8GB

# Try smaller area first
node scripts/process-dem.js --city=sf --test-mode
```

### Issue: WebGL errors

```javascript
// Add WebGL check
if (!window.WebGLRenderingContext) {
  alert("WebGL not supported");
}
```

## Development Commands

```bash
# Start development
pnpm dev

# Run linting
pnpm lint

# Type check
pnpm type-check

# Run tests
pnpm test

# Build for production
pnpm build

# Preview production build
pnpm start
```

## Next Steps

1. **Complete Phase 0-2** from DETAILED_TASKS.md
2. **Review** TECHNICAL_DECISIONS.md for architecture
3. **Join** project Slack/Discord for questions
4. **Schedule** code review after Phase 3

## Resources

- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Clerk Next.js Guide](https://clerk.com/docs/nextjs/get-started)
- [Terrain-RGB Spec](https://docs.mapbox.com/data/tilesets/guides/access-elevation-data/)

## Emergency Contacts

- Technical Lead: [email]
- DevOps: [email]
- Mapbox Support: support@mapbox.com
