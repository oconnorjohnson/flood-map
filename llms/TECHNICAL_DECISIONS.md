# Technical Decisions & Implementation Guide

## Overview

This document outlines key technical decisions, implementation patterns, and architectural choices for the Sea-Rise Map Tool. It serves as a reference for development and explains the rationale behind major decisions.

## Core Technology Choices

### Frontend Framework: Next.js 14 with App Router

**Decision**: Use Next.js 14 with the App Router pattern
**Rationale**:

- Modern React patterns with Server Components support
- Built-in optimization features (code splitting, image optimization)
- Excellent TypeScript support
- Easy deployment to Vercel
- App Router provides better layouts and loading states

**Implementation Notes**:

- Use client components for interactive features
- Keep authentication logic in middleware
- Leverage parallel routes for modals

### Map Rendering: Mapbox GL JS v3

**Decision**: Mapbox GL JS for base map and custom WebGL layers
**Rationale**:

- Industry-standard web mapping library
- Excellent performance with vector tiles
- Custom layer support for flood overlay
- Built-in geocoding and street data
- Free tier sufficient for pilot

**Alternatives Considered**:

- Leaflet: Less performant for dynamic overlays
- Deck.gl: Overkill for 2D visualization
- OpenLayers: Steeper learning curve

### Elevation Data Format: Terrain-RGB

**Decision**: Encode elevation as RGB values in PNG tiles
**Rationale**:

- Efficient storage (3 bytes per pixel)
- Native browser decoding
- Standard format supported by Mapbox
- Allows for sub-meter precision

**Encoding Formula**:

```javascript
// Encode elevation to RGB
const elevation = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;

// Decode RGB to elevation
const R = (elevation + 10000) / 0.1 / (256 * 256);
const G = (((elevation + 10000) / 0.1) % (256 * 256)) / 256;
const B = ((elevation + 10000) / 0.1) % 256;
```

### State Management: Zustand

**Decision**: Zustand for global state management
**Rationale**:

- Minimal boilerplate compared to Redux
- TypeScript-first design
- Built-in persistence middleware
- Small bundle size (8kb)
- React Suspense compatible

**State Structure**:

```typescript
interface AppState {
  // Map state
  waterLevel: number;
  mapCenter: [number, number];
  mapZoom: number;

  // UI state
  selectedPreset: string | null;
  isExporting: boolean;
  legendVisible: boolean;

  // Actions
  setWaterLevel: (level: number) => void;
  setMapView: (center: [number, number], zoom: number) => void;
}
```

### Authentication: Clerk

**Decision**: Clerk for authentication and user management
**Rationale**:

- Zero-effort social login setup
- Built-in UI components
- Excellent Next.js integration
- Free tier covers pilot needs
- GDPR compliant

**Implementation Pattern**:

```typescript
// Middleware protection
export default authMiddleware({
  publicRoutes: ["/", "/sign-in", "/sign-up"],
  ignoredRoutes: ["/api/public"],
});
```

## Data Pipeline Architecture

### Processing Stack

**Decision**: Docker-based GDAL/PDAL pipeline
**Rationale**:

- Consistent environment across machines
- Industry-standard geospatial tools
- Handles large LIDAR datasets efficiently
- Scriptable and reproducible

**Pipeline Flow**:

1. Download LAZ files from USGS
2. Convert LAZ → LAS (PDAL)
3. Convert LAS → GeoTIFF (GDAL)
4. Clip to city bounds
5. Generate Terrain-RGB tiles
6. Optimize PNGs

### Tile Generation Strategy

**Decision**: Pre-generate static tiles (Z10-15)
**Rationale**:

- Eliminates server-side processing
- Instant tile serving from CDN
- Predictable costs
- Simple deployment

**Zoom Level Rationale**:

- Z10: City overview
- Z12: Neighborhood level
- Z15: Street-level detail
- Higher zooms unnecessary for elevation data

## Performance Optimizations

### Bundle Size Management

**Strategy**: Aggressive code splitting and dynamic imports

```typescript
// Dynamic import for heavy libraries
const MapboxGL = dynamic(() => import("mapbox-gl"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

// Lazy load export functionality
const exportMap = async () => {
  const { exportToPNG } = await import("@/lib/export");
  return exportToPNG();
};
```

### Rendering Performance

**WebGL Overlay Optimization**:

- Use single draw call per tile
- Implement frustum culling
- Cache compiled shaders
- Dispose unused textures

**Debouncing Strategy**:

```typescript
// Debounce slider updates
const debouncedSetWaterLevel = useMemo(
  () => debounce(setWaterLevel, 100),
  [setWaterLevel]
);

// Debounce URL updates
const debouncedUpdateURL = useMemo(() => debounce(updateURL, 500), [updateURL]);
```

### Memory Management

**Tile Caching Strategy**:

- LRU cache for decoded elevation data
- Maximum 100 tiles in memory
- Aggressive disposal of off-screen tiles
- Web Worker for decoding (future)

## Security Considerations

### API Key Protection

**Mapbox Token Security**:

- Domain restrictions on token
- Request limit monitoring
- Fallback to cached tiles if limit reached
- Server-side proxy for production (future)

### Data Validation

**Input Sanitization**:

```typescript
// Validate water level input
const validateWaterLevel = (level: number): number => {
  return Math.max(-10, Math.min(30, Number(level) || 0));
};

// Validate map bounds
const validateBounds = (bounds: number[]): boolean => {
  return (
    bounds.length === 4 &&
    bounds.every((b) => typeof b === "number" && !isNaN(b))
  );
};
```

## Error Handling Patterns

### Graceful Degradation

**Tile Loading Failures**:

```typescript
const loadTile = async (url: string, retries = 3): Promise<ImageData> => {
  try {
    return await fetchTile(url);
  } catch (error) {
    if (retries > 0) {
      await delay(1000);
      return loadTile(url, retries - 1);
    }
    // Return transparent tile on failure
    return createEmptyTile();
  }
};
```

### User Feedback

**Error Display Strategy**:

- Toast notifications for transient errors
- Inline errors for form validation
- Full-page errors for critical failures
- Always provide recovery actions

## Testing Strategy

### Unit Testing Approach

**What to Test**:

- Elevation decoding algorithms
- State management logic
- URL parsing/generation
- Export filename generation

**Testing Pattern**:

```typescript
describe("Elevation Utils", () => {
  it("should decode Terrain-RGB correctly", () => {
    const rgb = { r: 128, g: 0, b: 0 };
    const elevation = decodeTerrainRGB(rgb);
    expect(elevation).toBeCloseTo(2949.6, 1);
  });
});
```

### E2E Testing Focus

**Critical User Flows**:

1. Sign in → Load map → Adjust slider → Export
2. Direct URL access with parameters
3. Preset selection → Tooltip interaction
4. Keyboard navigation flow

## Deployment Strategy

### Environment Management

**Environment Variables**:

```bash
# Development
NEXT_PUBLIC_MAPBOX_TOKEN=pk.dev_xxx
NEXT_PUBLIC_API_URL=http://localhost:3000

# Production
NEXT_PUBLIC_MAPBOX_TOKEN=pk.prod_xxx
NEXT_PUBLIC_API_URL=https://sea-rise.vercel.app
```

### CI/CD Pipeline

**Build Optimization**:

```yaml
# Vercel build settings
build:
  env:
    - NEXT_TELEMETRY_DISABLED=1
  command: pnpm build
  output: .next

# Cache configuration
cache:
  - node_modules
  - .next/cache
```

## Future Scalability

### Multi-City Support

**Data Structure**:

```typescript
interface CityConfig {
  id: string;
  name: string;
  bounds: [number, number, number, number];
  center: [number, number];
  defaultZoom: number;
  tileUrl: string;
}

const CITIES: Record<string, CityConfig> = {
  sf: {
    id: "sf",
    name: "San Francisco",
    bounds: [-122.5155, 37.7034, -122.3557, 37.8324],
    center: [-122.4194, 37.7749],
    defaultZoom: 12,
    tileUrl: "/tiles/sf/{z}/{x}/{y}.png",
  },
};
```

### Performance Scaling

**Optimization Roadmap**:

1. Implement Web Workers for tile decoding
2. Add WebGL instancing for multiple water levels
3. Implement progressive tile loading
4. Add offline support with Service Workers

### Feature Scaling

**Modular Architecture**:

- Feature flags for experimental features
- Plugin system for custom overlays
- API for external data sources
- Webhook support for notifications

## Development Workflow

### Local Development Setup

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your keys

# Run development server
pnpm dev

# Run tests
pnpm test
pnpm test:e2e
```

### Code Style Guidelines

**TypeScript Conventions**:

- Prefer interfaces over types
- Use strict mode
- Explicit return types for functions
- No any types without justification

**Component Structure**:

```typescript
// components/Example/Example.tsx
interface ExampleProps {
  title: string;
  onAction: () => void;
}

export const Example: React.FC<ExampleProps> = ({ title, onAction }) => {
  // Component logic
};
```

## Monitoring & Analytics

### Performance Metrics

**Key Metrics to Track**:

- Time to Interactive (TTI)
- Tile loading performance
- Slider responsiveness (FPS)
- Export generation time

### Error Tracking

**Sentry Configuration**:

```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter out known issues
    if (event.exception?.values?.[0]?.type === "NetworkError") {
      return null;
    }
    return event;
  },
});
```

## Accessibility Implementation

### WCAG 2.1 AA Compliance

**Key Requirements**:

- Keyboard navigation for all controls
- ARIA labels for map regions
- High contrast mode support
- Screen reader announcements

### Implementation Patterns

```typescript
// Accessible slider
<Slider
  aria-label="Sea level rise in meters"
  aria-valuemin={-10}
  aria-valuemax={30}
  aria-valuenow={waterLevel}
  aria-valuetext={`${waterLevel} meters`}
/>

// Skip links
<a href="#map" className="sr-only focus:not-sr-only">
  Skip to map
</a>
```

## Browser Support

### Target Browsers

- Chrome 90+ (WebGL 2.0)
- Firefox 88+ (WebGL 2.0)
- Safari 14+ (WebGL 1.0 fallback)
- Edge 90+ (Chromium-based)

### Feature Detection

```typescript
const checkWebGLSupport = (): boolean => {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
};
```

## Cost Optimization

### Mapbox Usage Management

**Strategies**:

- Cache tiles in localStorage
- Implement request throttling
- Use lower zoom levels for overview
- Batch geocoding requests

### Vercel Optimization

**Strategies**:

- Enable ISR for static pages
- Optimize images at build time
- Use Edge Functions sparingly
- Monitor bandwidth usage

## Documentation Standards

### Code Documentation

```typescript
/**
 * Decodes elevation from Terrain-RGB format
 * @param rgb - Object containing r, g, b values (0-255)
 * @returns Elevation in meters
 * @example
 * const elevation = decodeTerrainRGB({ r: 128, g: 0, b: 0 });
 * // Returns: 2949.6
 */
export const decodeTerrainRGB = (rgb: RGB): number => {
  return -10000 + (rgb.r * 256 * 256 + rgb.g * 256 + rgb.b) * 0.1;
};
```

### API Documentation

- Use TypeScript types as documentation
- Generate API docs from types
- Include examples for complex APIs
- Version all breaking changes
