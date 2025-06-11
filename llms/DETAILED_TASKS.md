# Sea-Rise Map Tool - Detailed Task List

## Overview

This document provides a granular, step-by-step task breakdown for implementing the Sea-Rise Map Tool v0.1 for San Francisco. Each task includes specific implementation details, dependencies, and acceptance criteria.

## Phase 0: Setup & Prerequisites (4 hours)

### 0.1 Development Environment Setup

- [ ] Install Node.js 20+ and pnpm
- [ ] Install Docker Desktop for GDAL/PDAL containers
- [ ] Install QGIS for DEM visualization/verification
- [ ] Set up VS Code with required extensions:
  - [ ] ESLint
  - [ ] Prettier
  - [ ] Tailwind CSS IntelliSense
  - [ ] GitLens

### 0.2 Service Account Creation

- [ ] Create Mapbox account
  - [ ] Generate development API token
  - [ ] Note token limits (50k requests/month)
  - [ ] Set up usage alerts at 40k threshold
- [ ] Create Clerk account
  - [ ] Set up new application
  - [ ] Configure authentication providers:
    - [ ] Email/password
    - [ ] Google OAuth
    - [ ] GitHub OAuth (optional)
  - [ ] Generate API keys (publishable & secret)
- [ ] Create Vercel account
  - [ ] Link to GitHub repository
  - [ ] Configure hobby tier settings

### 0.3 Repository & Project Setup

- [ ] Initialize Git repository
- [ ] Create `.gitignore` with:
  - [ ] Node modules
  - [ ] Environment files
  - [ ] DEM source data (_.laz, _.tif)
  - [ ] Build outputs
  - [ ] OS files (.DS_Store, etc.)
- [ ] Create folder structure:
  ```
  /
  ├── app/              # Next.js app router
  ├── components/       # React components
  ├── lib/             # Utilities & helpers
  ├── public/          # Static assets
  │   └── tiles/       # DEM tiles
  │       └── sf/      # San Francisco tiles
  ├── scripts/         # CLI tools
  ├── styles/          # Global styles
  ├── data/            # Source DEM data (gitignored)
  └── llms/            # Documentation
  ```

### 0.4 Environment Configuration

- [ ] Create `.env.local` template:
  ```
  NEXT_PUBLIC_MAPBOX_TOKEN=
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
  CLERK_SECRET_KEY=
  ```
- [ ] Create `.env.example` with dummy values
- [ ] Add environment validation script

## Phase 1: Data Pipeline Implementation (8 hours)

### 1.1 DEM Data Acquisition

- [ ] Research USGS 3DEP data portal
- [ ] Locate "USGS_LPC_CA_SanFrancisco_2020" dataset
- [ ] Document exact download URLs and metadata
- [ ] Create `scripts/download-dem.js`:
  - [ ] Implement progress bar for large downloads
  - [ ] Add retry logic for network failures
  - [ ] Verify checksums after download
  - [ ] Save to `data/raw/` directory

### 1.2 Docker Environment for Processing

- [ ] Create `Dockerfile.processing`:
  ```dockerfile
  FROM osgeo/gdal:alpine-normal-latest
  RUN apk add --no-cache nodejs npm python3 py3-pip
  RUN pip3 install pdal
  ```
- [ ] Create `docker-compose.yml` for processing services
- [ ] Test GDAL/PDAL commands in container

### 1.3 LAZ to GeoTIFF Conversion

- [ ] Create `scripts/process-dem.js`:
  - [ ] Parse command line arguments (city name, bounds)
  - [ ] Implement LAZ → LAS conversion using PDAL
  - [ ] Convert LAS → GeoTIFF with GDAL
  - [ ] Apply San Francisco bounding box:
    - [ ] West: -122.5155
    - [ ] East: -122.3557
    - [ ] North: 37.8324
    - [ ] South: 37.7034
  - [ ] Reproject to Web Mercator (EPSG:3857)
  - [ ] Resample to exactly 1m resolution

### 1.4 Terrain-RGB Tile Generation

- [ ] Create `scripts/generate-tiles.js`:
  - [ ] Implement Terrain-RGB encoding formula:
    ```
    elevation = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
    ```
  - [ ] Generate tiles for zoom levels 10-15
  - [ ] Implement tile naming: `{z}/{x}/{y}.png`
  - [ ] Add PNG optimization (pngquant)
  - [ ] Generate tile metadata JSON
- [ ] Create tile validation script:
  - [ ] Check all expected tiles exist
  - [ ] Verify PNG format and dimensions
  - [ ] Sample elevation values for correctness

### 1.5 CLI Tool Integration

- [ ] Create `scripts/ingest.js` main entry point:
  - [ ] Command line interface with yargs
  - [ ] Pipeline orchestration
  - [ ] Progress reporting
  - [ ] Error handling and cleanup
- [ ] Add npm scripts:
  ```json
  "scripts": {
    "ingest": "node scripts/ingest.js",
    "ingest:sf": "pnpm ingest --city=sf --bounds=-122.5155,-122.3557,37.7034,37.8324"
  }
  ```

## Phase 2: Core Infrastructure (4 hours)

### 2.1 Next.js Application Setup

- [ ] Initialize Next.js 14 with TypeScript:
  ```bash
  pnpm create next-app@latest . --typescript --tailwind --app --use-pnpm
  ```
- [ ] Configure `next.config.js`:
  - [ ] Enable static export
  - [ ] Configure image domains
  - [ ] Set up environment variables
  - [ ] Configure webpack for WebGL
- [ ] Set up TypeScript configuration:
  - [ ] Strict mode enabled
  - [ ] Path aliases (@/components, etc.)
  - [ ] WebGL types

### 2.2 Tailwind & Styling Setup

- [ ] Install and configure shadcn/ui:
  ```bash
  pnpm dlx shadcn-ui@latest init
  ```
- [ ] Configure theme colors:
  - [ ] Primary: Ocean blue (#0066CC)
  - [ ] Danger: Flood red (#DC2626)
  - [ ] Success: Dry land green (#16A34A)
- [ ] Set up CSS variables for dynamic theming
- [ ] Create global styles for map container

### 2.3 Authentication Implementation

- [ ] Install Clerk dependencies:
  ```bash
  pnpm add @clerk/nextjs
  ```
- [ ] Create `app/layout.tsx` with ClerkProvider
- [ ] Implement middleware for route protection:
  - [ ] Public routes: /, /sign-in, /sign-up
  - [ ] Protected routes: /app/\*
- [ ] Create authentication pages:
  - [ ] `/sign-in/page.tsx`
  - [ ] `/sign-up/page.tsx`
  - [ ] Custom styling to match theme

### 2.4 State Management Setup

- [ ] Install Zustand:
  ```bash
  pnpm add zustand
  ```
- [ ] Create `lib/store.ts`:
  ```typescript
  interface AppState {
    waterLevel: number;
    selectedPreset: string | null;
    mapCenter: [number, number];
    mapZoom: number;
    isExporting: boolean;
  }
  ```
- [ ] Implement persistence middleware
- [ ] Add URL state synchronization

## Phase 3: Map Implementation (8 hours)

### 3.1 Mapbox GL JS Integration

- [ ] Install dependencies:
  ```bash
  pnpm add mapbox-gl @types/mapbox-gl
  ```
- [ ] Create `components/Map/MapContainer.tsx`:
  - [ ] Initialize Mapbox with SF center coordinates
  - [ ] Configure style: 'mapbox://styles/mapbox/streets-v12'
  - [ ] Set initial zoom level: 12
  - [ ] Add navigation controls
  - [ ] Implement resize observer
- [ ] Handle Mapbox CSS imports properly
- [ ] Add loading state with skeleton

### 3.2 Terrain Data Loading

- [ ] Install loaders.gl:
  ```bash
  pnpm add @loaders.gl/core @loaders.gl/terrain
  ```
- [ ] Create `lib/terrain/TerrainLoader.ts`:
  - [ ] Implement tile URL generation
  - [ ] Add caching layer for loaded tiles
  - [ ] Handle tile loading errors
  - [ ] Implement retry logic
- [ ] Create `lib/terrain/elevationUtils.ts`:
  - [ ] Decode Terrain-RGB values
  - [ ] Interpolate between pixels
  - [ ] Handle edge cases (no data, ocean)

### 3.3 WebGL Overlay Implementation

- [ ] Create `lib/webgl/FloodOverlay.ts`:
  - [ ] Custom Mapbox GL layer class
  - [ ] Vertex shader for tile positioning
  - [ ] Fragment shader for flood visualization:
    ```glsl
    if (elevation < waterLevel) {
      gl_FragColor = vec4(0.0, 0.4, 0.8, 0.6);
    } else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
    ```
- [ ] Implement efficient tile management:
  - [ ] Load only visible tiles
  - [ ] Dispose of off-screen tiles
  - [ ] Progressive loading for performance
- [ ] Add smooth transitions for water level changes

### 3.4 Map Layer Ordering

- [ ] Configure layer stack:
  1. Base map tiles
  2. Flood overlay
  3. Road labels
  4. Place labels
- [ ] Ensure labels remain visible above water
- [ ] Add layer toggle controls (future feature)

## Phase 4: UI Components (6 hours)

### 4.1 Water Level Slider

- [ ] Create `components/Controls/WaterLevelSlider.tsx`:
  - [ ] Range: -10m to +30m
  - [ ] Step: 0.1m
  - [ ] Debounced updates (100ms)
  - [ ] Keyboard navigation (arrow keys)
  - [ ] Touch-friendly hit area
- [ ] Add preset buttons:
  - [ ] Low Tide (-0.5m)
  - [ ] Mean Sea Level (0m)
  - [ ] +2m Rise
  - [ ] +5m Rise
  - [ ] +10m Rise
- [ ] Visual indicators:
  - [ ] Current value display
  - [ ] Tick marks at key levels
  - [ ] Color gradient (blue → red)

### 4.2 Dynamic Legend Component

- [ ] Create `components/Legend/Legend.tsx`:
  - [ ] Auto-updating water level display
  - [ ] Current viewport bounds
  - [ ] Timestamp
  - [ ] Color key for flood overlay
- [ ] Implement responsive positioning:
  - [ ] Default: bottom-right
  - [ ] Avoid slider overlap
  - [ ] Draggable (future feature)
- [ ] Add minimize/expand toggle

### 4.3 Export Button

- [ ] Create `components/Controls/ExportButton.tsx`:
  - [ ] Icon: Download or Camera
  - [ ] Loading state during export
  - [ ] Success/error feedback
- [ ] Implement tooltip with shortcuts
- [ ] Add keyboard shortcut (Cmd/Ctrl + S)

### 4.4 Navigation Header

- [ ] Create `components/Layout/Header.tsx`:
  - [ ] App title and logo
  - [ ] User menu (via Clerk)
  - [ ] Settings dropdown (future)
  - [ ] Help/info modal trigger

## Phase 5: Interaction Features (6 hours)

### 5.1 Hover Tooltip System

- [ ] Create `components/Tooltip/HoverTooltip.tsx`:
  - [ ] Follow mouse cursor
  - [ ] Show on hover delay (200ms)
  - [ ] Hide on mouse leave
- [ ] Implement data queries:
  - [ ] Get elevation at cursor position
  - [ ] Reverse geocode for street name
  - [ ] Calculate flood depth if applicable
- [ ] Format tooltip content:
  - [ ] Street name (if available)
  - [ ] Elevation: X.Xm
  - [ ] Status: "Dry" or "Flooded (X.Xm deep)"
- [ ] Handle edge cases:
  - [ ] Ocean areas
  - [ ] No data regions
  - [ ] Rapid mouse movement

### 5.2 URL State Synchronization

- [ ] Implement URL parameter handling:
  - [ ] `wl` (water level): -10 to 30
  - [ ] `lat` (latitude): map center
  - [ ] `lng` (longitude): map center
  - [ ] `z` (zoom): 10 to 18
- [ ] Create `hooks/useURLState.ts`:
  - [ ] Read initial state from URL
  - [ ] Update URL on state changes
  - [ ] Handle invalid parameters
  - [ ] Debounce URL updates
- [ ] Add share button to copy URL

### 5.3 Keyboard Navigation

- [ ] Implement keyboard shortcuts:
  - [ ] Arrow keys: Adjust water level (±0.5m)
  - [ ] Shift + Arrow: Fine adjustment (±0.1m)
  - [ ] Number keys 1-5: Preset levels
  - [ ] Space: Toggle last/current level
  - [ ] Escape: Reset to sea level
- [ ] Add keyboard help modal
- [ ] Ensure focus management

### 5.4 Local Storage Persistence

- [ ] Save user preferences:
  - [ ] Last water level
  - [ ] Map position/zoom
  - [ ] Selected preset
  - [ ] UI preferences (legend visible, etc.)
- [ ] Implement migration strategy
- [ ] Handle storage quota errors

## Phase 6: Export & Polish (4 hours)

### 6.1 PNG Export Implementation

- [ ] Install html2canvas:
  ```bash
  pnpm add html2canvas
  ```
- [ ] Create `lib/export/exportMap.ts`:
  - [ ] Capture map container
  - [ ] Include legend overlay
  - [ ] Handle WebGL context
  - [ ] Optimize for quality
- [ ] Implement file naming:
  - [ ] Format: `sea-rise-sf-{level}m-{timestamp}.png`
  - [ ] Sanitize water level value
  - [ ] Use ISO timestamp
- [ ] Add export options:
  - [ ] Resolution selection (HD, 4K)
  - [ ] Include/exclude UI elements
  - [ ] JPEG option for smaller files

### 6.2 Loading States

- [ ] Create loading skeletons:
  - [ ] Map container skeleton
  - [ ] Slider skeleton
  - [ ] Legend skeleton
- [ ] Add progress indicators:
  - [ ] Tile loading progress
  - [ ] Export progress
  - [ ] Initial data fetch
- [ ] Implement error boundaries

### 6.3 Error Handling

- [ ] Create `components/ErrorBoundary.tsx`
- [ ] Handle specific errors:
  - [ ] Mapbox token invalid
  - [ ] Tiles failed to load
  - [ ] WebGL not supported
  - [ ] Export failed
- [ ] User-friendly error messages
- [ ] Retry mechanisms where appropriate

### 6.4 Performance Optimization

- [ ] Implement code splitting:
  - [ ] Dynamic import for Mapbox
  - [ ] Lazy load export functionality
  - [ ] Split authentication flow
- [ ] Optimize bundle size:
  - [ ] Tree shake unused code
  - [ ] Minimize CSS
  - [ ] Compress images
- [ ] Add performance monitoring

## Phase 7: Testing & Deployment (6 hours)

### 7.1 Unit Testing Setup

- [ ] Install testing dependencies:
  ```bash
  pnpm add -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
  ```
- [ ] Configure Jest for Next.js
- [ ] Write unit tests for:
  - [ ] Elevation utilities
  - [ ] State management
  - [ ] URL parsing
  - [ ] Export filename generation

### 7.2 Integration Testing

- [ ] Install Playwright:
  ```bash
  pnpm add -D @playwright/test
  ```
- [ ] Write E2E tests:
  - [ ] Authentication flow
  - [ ] Slider interaction
  - [ ] Tooltip display
  - [ ] Export functionality
- [ ] Visual regression tests:
  - [ ] Different water levels
  - [ ] Various zoom levels
  - [ ] Legend rendering

### 7.3 Accessibility Audit

- [ ] Run axe-core audits
- [ ] Test keyboard navigation
- [ ] Verify screen reader compatibility
- [ ] Check color contrast (WCAG AA)
- [ ] Test with reduced motion
- [ ] Add skip links

### 7.4 Documentation

- [ ] Create comprehensive README.md:
  - [ ] Project overview
  - [ ] Setup instructions
  - [ ] Development workflow
  - [ ] Deployment guide
- [ ] Document API keys needed
- [ ] Create architecture diagrams
- [ ] Add troubleshooting guide

### 7.5 CI/CD Pipeline

- [ ] Create `.github/workflows/ci.yml`:
  - [ ] Lint checks
  - [ ] Type checking
  - [ ] Unit tests
  - [ ] Build verification
- [ ] Configure Vercel deployment:
  - [ ] Environment variables
  - [ ] Build settings
  - [ ] Domain configuration
- [ ] Set up monitoring:
  - [ ] Error tracking (Sentry)
  - [ ] Analytics (optional)
  - [ ] Performance monitoring

### 7.6 Production Deployment

- [ ] Final checklist:
  - [ ] All tests passing
  - [ ] Environment variables set
  - [ ] Mapbox token secured
  - [ ] Clerk configuration complete
- [ ] Deploy to Vercel
- [ ] Verify all features working
- [ ] Test on multiple browsers
- [ ] Monitor initial usage

## Phase 8: Post-Launch (Optional Enhancements)

### 8.1 Performance Monitoring

- [ ] Set up Vercel Analytics
- [ ] Monitor Mapbox usage
- [ ] Track tile loading times
- [ ] Identify bottlenecks

### 8.2 User Feedback

- [ ] Add feedback widget
- [ ] Create issue templates
- [ ] Plan iteration cycle

### 8.3 Future Features Prep

- [ ] Research 3D visualization
- [ ] Plan multi-city support
- [ ] Design sharing system
- [ ] Investigate offline mode

## Time Estimates Summary

| Phase                       | Estimated Hours |
| --------------------------- | --------------- |
| Phase 0: Setup              | 4               |
| Phase 1: Data Pipeline      | 8               |
| Phase 2: Infrastructure     | 4               |
| Phase 3: Map Implementation | 8               |
| Phase 4: UI Components      | 6               |
| Phase 5: Interactions       | 6               |
| Phase 6: Export & Polish    | 4               |
| Phase 7: Testing & Deploy   | 6               |
| **Total**                   | **46 hours**    |

## Critical Path

The following tasks must be completed in sequence:

1. Environment setup → Service accounts → Data pipeline
2. Data pipeline → Tile generation → Map implementation
3. Map implementation → UI components → Interactions
4. All features → Testing → Deployment

## Risk Mitigation Tasks

High-priority risk mitigation:

- [ ] Test Mapbox token limits early
- [ ] Verify WebGL support detection
- [ ] Implement offline tile fallback
- [ ] Add data validation throughout
- [ ] Create rollback procedures

## Success Criteria Checklist

- [ ] Map loads in < 3 seconds
- [ ] Slider updates at 30+ FPS
- [ ] Export works on all browsers
- [ ] Accessible via keyboard
- [ ] Mobile-responsive (future)
- [ ] Zero runtime errors
- [ ] Mapbox usage < 40k/month
