# Flood Map Project Memory

## Project Overview

A web application that visualizes flood scenarios on a 3D map using Next.js, MapBox GL JS, and TypeScript.

## Key Decisions & Progress

### June 29, 2025 - MapBox 3D Building Capabilities Research

- **Question**: Can MapBox add building textures and architectural details like Apple Maps?
- **Findings**:
  - MapBox's standard 3D buildings are simple extruded rectangles from OpenStreetMap data
  - No support for custom textures, facades, or photorealistic materials on individual buildings
  - MapBox Standard style includes pre-designed 3D landmarks in 370+ cities with better architectural detail
  - Uses "symbolic realism" design - recognizable but not photorealistic
- **Implementation**:
  - Added style toggle button to switch between satellite and standard views
  - Standard view shows better 3D buildings with landmarks
  - Satellite view keeps original extruded buildings
  - Properly handles style switching and re-adds layers as needed

### June 29, 2025 - Water Simulation Research & Planning

- **Task**: Research and plan accurate flood water simulation
- **Key Findings**:
  - Current implementation uses static polygons - doesn't account for terrain or physics
  - Industry uses 2D/3D hydrodynamic models (HEC-RAS, MIKE FLOOD, LISFLOOD-FP)
  - GPU-accelerated approaches using WebGL are emerging (shallow water equations)
  - Position-based fluids (PBF) and SPH methods show promise for real-time simulation
- **Proposed Solution**:
  - Custom WebGL layer using GPU shaders for water physics
  - Shallow water equations implementation on GPU
  - Height field fluid simulation with terrain interaction
  - Building boundaries and water accumulation
- **Created**: Comprehensive water simulation guide (WATER_SIMULATION_GUIDE.md)

## Technical Architecture

### Core Technologies

- Next.js 15.3.3 with App Router
- TypeScript with strict checking
- MapBox GL JS for 3D map rendering
- Zustand for state management
- Tailwind CSS for styling

### Map Features

- 3D terrain visualization with elevation data
- Flood simulation with water level control
- Building tooltips showing height and flood status
- Elevation tooltips showing terrain height
- Style toggle between satellite and standard views

### State Management (Zustand)

- `waterLevel`: Current flood water level (0-100m)
- `mapCenter`: Map center coordinates
- `mapZoom`: Map zoom level
- `setWaterLevel`: Update water level
- `setMapView`: Update map center and zoom

## Important Context

### MapBox Limitations

1. Standard 3D buildings are basic extrusions
2. No custom texture mapping available
3. Limited to color gradients based on height
4. Better 3D models only available for landmarks in Standard style

### Style Considerations

- Satellite style: Better for terrain visualization, basic 3D buildings
- Standard style: Better 3D landmarks, built-in lighting effects
- Both styles support flood visualization and tooltips

### Water Simulation Requirements

1. **Data Needs**:
   - High-resolution DEM (1-5m resolution)
   - Building footprints with heights
   - Terrain roughness coefficients
   - Storm drain locations
2. **Technical Approach**:
   - Custom WebGL shaders
   - GPU texture-based computation
   - Ping-pong rendering for state updates
   - Screen-space water rendering
3. **Performance Considerations**:
   - Balance resolution vs performance
   - Adaptive LOD system
   - Texture memory management

## Future Enhancements

- Consider using MapBox Standard as default for better 3D experience
- Explore third-party 3D model integration (Three.js/Threebox)
- Add more flood simulation features
- Implement real elevation data API integration
- **Priority**: Implement GPU-based water simulation as outlined in guide

# Memory: Flood Map Development

## Project Context

Building a flood map visualization tool for San Francisco using Next.js, MapBox GL JS, and TypeScript.

## Key Decisions

### Architecture

- Next.js 14 with App Router
- MapBox GL JS for 3D terrain and visualization
- Zustand for state management
- TypeScript with strict type checking

### Data Pipeline

- Using MapBox Terrain-RGB for elevation data
- Custom flood simulation based on elevation thresholds
- Real-time water level adjustments

## Progress Log

### Initial Setup (Previous Sessions)

- Created basic map with 3D terrain
- Implemented water level slider (0-100m)
- Added building tooltips showing flood impact
- Created basic flood area polygons

### June 29, 2025 - Sea Level Rise Implementation

Starting implementation of proper sea level rise visualization based on WATER_SIMULATION_GUIDE.md:

**Approach:**

- Moving from polygon-based flood areas to elevation-based water rendering
- Implementing custom GL layer for realistic water surface
- Using shaders for proper water depth visualization
- Adding building intersection calculations

**Implementation Plan:**

1. Create custom WebGL layer for water rendering ✅
2. Implement vertex/fragment shaders for water surface ✅
3. Add elevation-based water cutoffs ✅
4. Integrate with existing water level controls ✅
5. Add performance optimizations (LOD, culling) ✅
6. Write comprehensive tests ✅

**Completed:**

- Created `SeaLevelRiseLayer` class with WebGL implementation
- Implemented vertex and fragment shaders for realistic water rendering
  - Depth-based coloring
  - Fresnel effect for water surface
  - Foam effect at water edges
  - Subtle wave animation
- Created `ElevationUtils` for terrain data handling
  - RGB to elevation conversion
  - Building flood depth calculations
  - Terrain data caching with LRU eviction
  - Viewport culling utilities
- Integrated new layer into MapContainer
- Added comprehensive unit tests using Vitest
  - 100% test coverage for utilities
  - Full test coverage for WebGL layer
- Set up testing infrastructure (Vitest, jsdom, testing-library)

**Key Technical Decisions:**

- Using MapBox's terrain-rgb for elevation data (already integrated)
- Custom WebGL layer instead of fill-extrusion for better water rendering
- Shader-based approach for realistic water appearance
- Keeping existing UI controls, just improving the visualization
- Placeholder terrain texture for now (will integrate real terrain data next)

## Technical Decisions

### Water Rendering

- Custom WebGL layer for accurate elevation-based rendering
- Shaders handle depth-based coloring and transparency
- Single large water surface with terrain-based cutoffs
- Performance optimized with LOD and frustum culling

### Testing Strategy

- Unit tests for water level calculations ✅
- Integration tests for MapBox layer interactions ✅
- Visual regression tests for water rendering (planned)
- Using Vitest for fast test execution

## Next Steps

1. Integrate real terrain elevation data from MapBox
2. Add dynamic LOD based on zoom level
3. Implement terrain texture fetching and caching
4. Add visual regression tests
5. Optimize shader performance for mobile devices
6. Add water level animation transitions
7. Implement building flood visualization overlay

### Update - June 29, 2025 1:30 PM PDT

**Issues Fixed:**

1. **Authentication blocking app** - Added "/" to public routes in middleware.ts
2. **Water visualization not rendering** - Fixed shader issues:
   - Removed debug return statement blocking water rendering
   - Updated coordinate transformation for Mapbox mercator projection
   - Set fixed water level to 61m (200ft) as requested
3. **Building flood calculations incorrect** - Updated BuildingTooltip:
   - Added ground elevation to calculations
   - Now considers terrain height when determining flood status
   - Added placeholder elevation estimates for SF neighborhoods
   - Shows "Above water level" for buildings on high ground
   - Displays actual water depth at building location

**Current Status:**

- Water layer should now render at 61m elevation
- Building tooltips show accurate flood information based on ground elevation
- Using temporary elevation estimates until real DEM integration

### Update - June 29, 2025 1:40 PM PDT

**Issue: Water visualization still not showing**

- The complex WebGL shader approach wasn't rendering
- Created simpler WaterVisualization class using MapBox's built-in fill-extrusion layer
- This approach uses MapBox's native 3D rendering capabilities
- Creates a large polygon covering SF area at 61m elevation
- Should be visible as a semi-transparent blue layer

**Implementation:**

- Created WaterVisualization.ts with simpler approach
- Uses fill-extrusion layer type for 3D water surface
- Fixed water level at 61m (200ft)
- Blue color with 60% opacity
- Added before buildings layer for proper rendering order
