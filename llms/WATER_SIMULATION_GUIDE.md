# Accurate Water Simulation for MapBox GL JS: A Comprehensive Implementation Guide

## Executive Summary

This document outlines a detailed approach for implementing physically accurate water simulation in MapBox GL JS, addressing the challenges of simulating realistic flood behavior that accounts for terrain elevation, building interactions, and dynamic water flow. The proposed solution combines multiple techniques to achieve both visual fidelity and computational efficiency.

## Current Limitations of Basic Flood Visualization

Our current implementation uses simple polygon-based flood areas that:

- Don't account for actual terrain elevation
- Ignore building volumes and barriers
- Lack realistic water flow dynamics
- Don't consider water accumulation and drainage
- Provide static rather than dynamic visualization

## Proposed Solution Architecture

### 1. **Hybrid Rendering Approach**

Combine MapBox's native capabilities with custom WebGL layers for water simulation:

```
┌─────────────────────────────────────────────┐
│           MapBox GL JS Framework            │
├─────────────────────────────────────────────┤
│  Terrain Layer │ Buildings │ Infrastructure │
├─────────────────────────────────────────────┤
│         Custom WebGL Water Layer            │
│  ┌─────────────────────────────────────┐   │
│  │   GPU-Based Water Simulation        │   │
│  │   - Shallow Water Equations         │   │
│  │   - Height Field Fluid Simulation   │   │
│  │   - Particle-Based Effects          │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 2. **Core Components**

#### A. Elevation-Based Water Flow System

- **Data Requirements:**

  - High-resolution Digital Elevation Model (DEM)
  - Building footprints with height data
  - Terrain roughness coefficients
  - Storm drain locations and capacity

- **Implementation:**
  ```javascript
  // Custom water simulation layer
  const waterSimulationLayer = {
    id: "water-simulation",
    type: "custom",
    renderingMode: "3d",

    onAdd: function (map, gl) {
      // Initialize GPU compute shaders
      this.initializeWaterSimulation(gl);
      // Create height field texture from DEM
      this.createHeightFieldTexture(gl);
      // Initialize water state textures
      this.initializeWaterState(gl);
    },

    render: function (gl, matrix) {
      // Update water simulation
      this.updateWaterPhysics(gl);
      // Render water surface
      this.renderWaterSurface(gl, matrix);
    },
  };
  ```

#### B. GPU-Accelerated Shallow Water Equations

Implement 2D shallow water equations on the GPU using WebGL compute shaders:

```glsl
// Fragment shader for water height update
uniform sampler2D u_heightField;    // Terrain elevation
uniform sampler2D u_waterHeight;    // Current water height
uniform sampler2D u_velocity;       // Water velocity field
uniform float u_deltaTime;
uniform float u_gravity;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // Sample neighboring cells
  float h_center = texture2D(u_waterHeight, uv).r;
  float h_left   = texture2D(u_waterHeight, uv - vec2(1.0/u_resolution.x, 0)).r;
  float h_right  = texture2D(u_waterHeight, uv + vec2(1.0/u_resolution.x, 0)).r;
  float h_top    = texture2D(u_waterHeight, uv + vec2(0, 1.0/u_resolution.y)).r;
  float h_bottom = texture2D(u_waterHeight, uv - vec2(0, 1.0/u_resolution.y)).r;

  // Calculate water flow based on height differences
  vec2 velocity = texture2D(u_velocity, uv).xy;

  // Apply shallow water equations
  float dhdt = -(h_right - h_left) * velocity.x
             - (h_top - h_bottom) * velocity.y;

  // Update water height
  float newHeight = h_center + dhdt * u_deltaTime;

  // Ensure water doesn't go below terrain
  float terrainHeight = texture2D(u_heightField, uv).r;
  newHeight = max(newHeight, terrainHeight);

  gl_FragColor = vec4(newHeight, 0.0, 0.0, 1.0);
}
```

### 3. **Implementation Strategy**

#### Phase 1: Data Preparation

1. **Elevation Data Processing**

   - Obtain high-resolution DEM (1-5m resolution recommended)
   - Process building heights from OSM or city data
   - Create combined elevation texture including buildings
   - Generate terrain roughness map (Manning coefficients)

2. **Boundary Conditions**
   - Define water sources (rain, river overflow, ocean surge)
   - Map storm drain locations and capacities
   - Identify impermeable surfaces (roads, buildings)

#### Phase 2: Water Simulation Engine

1. **Height Field Fluid Simulation**

   ```javascript
   class WaterSimulation {
     constructor(resolution, bounds) {
       this.resolution = resolution;
       this.bounds = bounds;

       // Create framebuffers for ping-pong rendering
       this.waterHeightTextures = [
         this.createTexture(resolution),
         this.createTexture(resolution),
       ];

       this.velocityTextures = [
         this.createTexture(resolution),
         this.createTexture(resolution),
       ];

       this.currentIndex = 0;
     }

     update(deltaTime) {
       // Swap read/write textures
       this.currentIndex = 1 - this.currentIndex;

       // Update water physics
       this.updateWaterHeight(deltaTime);
       this.updateVelocity(deltaTime);
       this.applyBoundaryConditions();
     }
   }
   ```

2. **Building Interaction**

   - Treat buildings as solid boundaries
   - Implement water flow around obstacles
   - Account for water accumulation in low areas
   - Model water entry into buildings at ground level

3. **Dynamic Water Sources**

   ```javascript
   addRainfall(intensity, area) {
     // Add water based on rainfall intensity
     // Account for surface permeability
     // Distribute across affected cells
   }

   addPointSource(position, flowRate) {
     // Add water from point sources (broken pipes, etc.)
   }

   addRiverOverflow(riverPath, waterLevel) {
     // Model river overflow based on water level
   }
   ```

#### Phase 3: Visual Rendering

1. **Water Surface Rendering**

   - Use screen-space reflections for realistic water
   - Implement foam and turbulence effects
   - Add transparency based on water depth
   - Create wave displacement for flowing water

2. **Depth Visualization**

   ```glsl
   // Fragment shader for water rendering
   vec3 getWaterColor(float depth) {
     // Shallow to deep water color gradient
     vec3 shallowColor = vec3(0.4, 0.6, 0.8);
     vec3 deepColor = vec3(0.1, 0.2, 0.4);

     float t = smoothstep(0.0, 2.0, depth);
     return mix(shallowColor, deepColor, t);
   }
   ```

3. **Performance Optimization**
   - Use adaptive resolution based on zoom level
   - Implement LOD system for distant water
   - Cache simulation results for replay
   - Use temporal upsampling for smooth animation

### 4. **Integration with MapBox**

#### Custom Layer Implementation

```javascript
class WaterSimulationLayer {
  constructor(options) {
    this.id = "water-simulation";
    this.type = "custom";
    this.renderingMode = "3d";

    this.simulation = new WaterSimulation(options.resolution, options.bounds);
  }

  onAdd(map, gl) {
    this.map = map;
    this.gl = gl;

    // Load elevation data
    this.loadElevationData();

    // Initialize shaders
    this.initializeShaders();

    // Set up render targets
    this.setupRenderTargets();
  }

  render(gl, matrix) {
    // Update simulation
    this.simulation.update(1 / 60);

    // Render water surface
    this.renderWater(matrix);

    // Trigger repaint for animation
    this.map.triggerRepaint();
  }
}

// Add to map
map.on("load", () => {
  const waterLayer = new WaterSimulationLayer({
    resolution: 512,
    bounds: map.getBounds(),
  });

  map.addLayer(waterLayer);
});
```

### 5. **Advanced Features**

#### A. Multi-Resolution Simulation

- Use quadtree structure for adaptive resolution
- Higher detail near viewer and areas of interest
- Coarser simulation for distant regions

#### B. Temporal Dynamics

```javascript
class TemporalFloodSimulation {
  constructor() {
    this.timeStep = 0;
    this.rainfallSchedule = [];
    this.drainageRates = new Map();
  }

  setRainfallPattern(pattern) {
    // Define time-varying rainfall
    this.rainfallSchedule = pattern;
  }

  updateDrainageCapacity(drainId, capacity) {
    // Model storm drain overflow
    this.drainageRates.set(drainId, capacity);
  }

  simulateTimeStep() {
    // Apply current rainfall
    const rainfall = this.getRainfallAtTime(this.timeStep);

    // Update water levels
    this.applyRainfall(rainfall);

    // Process drainage
    this.processDrainage();

    // Advance time
    this.timeStep++;
  }
}
```

#### C. Building Damage Visualization

```javascript
assessBuildingImpact(buildingId, waterLevel) {
  const building = this.buildings.get(buildingId);

  if (waterLevel > building.groundLevel) {
    const floodDepth = waterLevel - building.groundLevel;
    const affectedFloors = Math.floor(floodDepth / 3.0); // ~3m per floor

    return {
      flooded: true,
      depth: floodDepth,
      affectedFloors: affectedFloors,
      estimatedDamage: this.calculateDamage(building, floodDepth)
    };
  }

  return { flooded: false };
}
```

### 6. **Performance Considerations**

#### GPU Memory Management

- Resolution vs. Accuracy tradeoff
- Texture format optimization (16-bit vs 32-bit float)
- Framebuffer pooling

#### Simulation Stability

```javascript
// Adaptive timestep for numerical stability
calculateTimestep(maxVelocity, cellSize) {
  const CFL = 0.5; // Courant-Friedrichs-Lewy condition
  return CFL * cellSize / maxVelocity;
}
```

### 7. **Data Requirements**

#### Essential Data

1. **Digital Elevation Model (DEM)**

   - Resolution: 1-5 meters
   - Coverage: Entire simulation area
   - Format: GeoTIFF or similar

2. **Building Data**

   - Footprints with heights
   - Ground floor elevations
   - Building materials (for permeability)

3. **Infrastructure Data**

   - Storm drain network
   - Pump stations
   - Levees and flood barriers

4. **Hydrological Parameters**
   - Surface roughness coefficients
   - Soil permeability rates
   - Historical flood data for validation

### 8. **Implementation Timeline**

#### Week 1-2: Data Acquisition and Processing

- Obtain DEM and building data
- Process into GPU-compatible formats
- Create elevation and roughness textures

#### Week 3-4: Basic Water Simulation

- Implement shallow water equations
- Test with simple scenarios
- Validate against known flood patterns

#### Week 5-6: MapBox Integration

- Create custom WebGL layer
- Implement water rendering
- Add user controls

#### Week 7-8: Advanced Features

- Building interactions
- Temporal dynamics
- Performance optimization

#### Week 9-10: Testing and Refinement

- Validate against historical floods
- Performance profiling
- User interface polish

### 9. **Alternative Approaches**

#### A. Particle-Based (SPH) Simulation

- More accurate for complex flows
- Higher computational cost
- Better for small-scale detail

#### B. Lattice Boltzmann Method

- Good for complex boundary conditions
- Naturally parallel
- More complex implementation

#### C. Hybrid Grid-Particle Methods

- Combines efficiency of grids with particle detail
- Best of both worlds
- Most complex to implement

### 10. **Validation and Testing**

#### Test Scenarios

1. **Dam Break Test**

   - Classic benchmark for flood simulation
   - Known analytical solutions

2. **Urban Flooding**

   - Historical flood events
   - Compare with observed data

3. **Rainfall Runoff**
   - Various intensity patterns
   - Drainage system capacity

#### Metrics

- Water depth accuracy (RMSE)
- Flood extent comparison (F-score)
- Arrival time accuracy
- Computational performance (FPS)

### 11. **Future Enhancements**

1. **Machine Learning Integration**

   - Predict flood patterns
   - Optimize simulation parameters
   - Real-time calibration

2. **Multi-hazard Simulation**

   - Combine with landslide models
   - Debris flow simulation
   - Contamination spread

3. **Cloud Computing**
   - Offload heavy computation
   - Larger simulation domains
   - Ensemble simulations

## Conclusion

Implementing accurate water simulation in MapBox GL JS requires a multi-faceted approach combining:

- GPU-accelerated physics simulation
- High-resolution elevation data
- Custom WebGL rendering
- Careful performance optimization

While complex, this approach provides:

- Realistic flood visualization
- Interactive exploration
- Real-time performance
- Cross-platform compatibility

The key to success is balancing physical accuracy with computational efficiency, using appropriate simplifications while maintaining the essential dynamics of flood behavior.
