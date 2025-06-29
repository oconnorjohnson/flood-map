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
