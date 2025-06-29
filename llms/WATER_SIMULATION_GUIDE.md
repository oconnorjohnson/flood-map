# Sea Level Rise Visualization for MapBox GL JS: Implementation Guide

## Executive Summary

This document outlines a streamlined approach for implementing sea level rise visualization in MapBox GL JS, specifically designed for scenarios like visualizing 200 feet (~61 meters) of sea level rise. This approach focuses on accurate elevation-based water rendering without the complexity of dynamic flow simulation.

## Simplified Approach for Sea Level Rise

Unlike dynamic flood simulation, sea level rise visualization can be implemented more efficiently by:

- Using static water level calculations based on terrain elevation
- Eliminating complex physics simulations
- Focusing on visual accuracy and performance
- Providing immediate feedback as users adjust water levels

## Core Implementation Strategy

### 1. **Elevation-Based Water Rendering**

The key insight is that for sea level rise, water will fill all areas below a certain elevation threshold:

```
┌─────────────────────────────────────────────┐
│           MapBox GL JS Framework            │
├─────────────────────────────────────────────┤
│  Terrain Layer │ Buildings │ Infrastructure │
├─────────────────────────────────────────────┤
│      Custom Water Rendering Layer           │
│  ┌─────────────────────────────────────┐   │
│  │   Elevation-Based Water Surface     │   │
│  │   - Height comparison               │   │
│  │   - Realistic water shading         │   │
│  │   - Building intersection           │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 2. **Implementation Components**

#### A. Custom Water Layer

```javascript
const seaLevelRiseLayer = {
  id: "sea-level-rise",
  type: "custom",
  renderingMode: "3d",

  onAdd: function (map, gl) {
    // Create shader program for water rendering
    this.program = createShaderProgram(
      gl,
      vertexShaderSource,
      fragmentShaderSource
    );

    // Get terrain elevation data
    this.loadTerrainData(map);

    // Create water mesh
    this.createWaterMesh(gl);
  },

  render: function (gl, matrix) {
    // Use current water level from state
    const waterLevel = this.waterLevel; // e.g., 61 meters

    // Render water surface at specified elevation
    this.renderWaterSurface(gl, matrix, waterLevel);
  },
};
```

#### B. Vertex Shader for Water Surface

```glsl
attribute vec2 a_position;
uniform mat4 u_matrix;
uniform float u_waterLevel;
uniform sampler2D u_terrain;

varying vec2 v_texCoord;
varying float v_depth;

void main() {
  v_texCoord = a_position;

  // Get terrain height at this position
  float terrainHeight = texture2D(u_terrain, a_position).r;

  // Calculate water depth
  v_depth = u_waterLevel - terrainHeight;

  // Position water surface at the specified level
  vec3 position = vec3(a_position, u_waterLevel);

  gl_Position = u_matrix * vec4(position, 1.0);
}
```

#### C. Fragment Shader for Realistic Water

```glsl
precision highp float;

uniform float u_waterLevel;
uniform sampler2D u_terrain;
uniform vec3 u_cameraPosition;

varying vec2 v_texCoord;
varying float v_depth;

void main() {
  // Skip rendering where terrain is above water
  float terrainHeight = texture2D(u_terrain, v_texCoord).r;
  if (terrainHeight >= u_waterLevel) {
    discard;
  }

  // Calculate water color based on depth
  vec3 shallowColor = vec3(0.4, 0.7, 0.9);
  vec3 deepColor = vec3(0.1, 0.3, 0.6);

  float depthFactor = smoothstep(0.0, 10.0, v_depth);
  vec3 waterColor = mix(shallowColor, deepColor, depthFactor);

  // Add transparency for shallow water
  float alpha = smoothstep(0.0, 1.0, v_depth) * 0.9;

  // Simple fresnel effect for realism
  vec3 viewDir = normalize(u_cameraPosition - vec3(v_texCoord, u_waterLevel));
  float fresnel = pow(1.0 - abs(dot(viewDir, vec3(0, 0, 1))), 2.0);

  waterColor += vec3(0.1) * fresnel;

  gl_FragColor = vec4(waterColor, alpha);
}
```

### 3. **Simplified Implementation Steps**

#### Step 1: Obtain Elevation Data

```javascript
async function loadElevationData(bounds) {
  // Option 1: Use MapBox Terrain-RGB tiles
  const terrainSource = {
    type: "raster-dem",
    url: "mapbox://mapbox.terrain-rgb",
    tileSize: 512,
    maxzoom: 14,
  };

  // Option 2: Load custom DEM if available
  // const dem = await loadDEMFile('path/to/dem.tiff');

  return terrainSource;
}
```

#### Step 2: Create Water Mesh

```javascript
function createWaterMesh(bounds, resolution = 256) {
  const vertices = [];
  const indices = [];

  // Create grid of vertices covering the map bounds
  for (let y = 0; y <= resolution; y++) {
    for (let x = 0; x <= resolution; x++) {
      const u = x / resolution;
      const v = y / resolution;

      // Map to geographic coordinates
      const lng = bounds.west + (bounds.east - bounds.west) * u;
      const lat = bounds.north + (bounds.south - bounds.north) * v;

      vertices.push(lng, lat);
    }
  }

  // Create triangles
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const topLeft = y * (resolution + 1) + x;
      const topRight = topLeft + 1;
      const bottomLeft = (y + 1) * (resolution + 1) + x;
      const bottomRight = bottomLeft + 1;

      indices.push(topLeft, bottomLeft, topRight);
      indices.push(topRight, bottomLeft, bottomRight);
    }
  }

  return { vertices, indices };
}
```

#### Step 3: Efficient Rendering

```javascript
class SeaLevelRiseVisualization {
  constructor(map) {
    this.map = map;
    this.waterLevel = 0;
  }

  setWaterLevel(meters) {
    this.waterLevel = meters;
    this.updateVisualization();
  }

  updateVisualization() {
    // Update uniform in shader
    if (this.program) {
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.uniform1f(this.waterLevelUniform, this.waterLevel);
    }

    // Trigger repaint
    this.map.triggerRepaint();
  }
}
```

### 4. **Building Intersection**

For more accurate visualization, handle building intersections:

```javascript
function calculateBuildingFloodDepth(building, waterLevel) {
  const groundElevation = building.properties.base_height || 0;
  const buildingHeight = building.properties.height || 0;

  if (waterLevel <= groundElevation) {
    return { flooded: false };
  }

  const floodDepth = waterLevel - groundElevation;
  const percentFlooded = Math.min(floodDepth / buildingHeight, 1.0);

  return {
    flooded: true,
    depth: floodDepth,
    percentFlooded: percentFlooded,
    floorsAffected: Math.floor(floodDepth / 3.0), // Assuming 3m per floor
  };
}
```

### 5. **Performance Optimizations**

#### A. Level of Detail (LOD)

```javascript
function getOptimalResolution(zoom) {
  // Higher resolution for closer views
  if (zoom > 15) return 512;
  if (zoom > 12) return 256;
  if (zoom > 10) return 128;
  return 64;
}
```

#### B. Frustum Culling

```javascript
function cullWaterTiles(tiles, camera) {
  return tiles.filter((tile) => {
    // Only render tiles visible in current view
    return camera.frustum.intersectsBox(tile.bounds);
  });
}
```

#### C. Caching Elevation Data

```javascript
class ElevationCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  getTileElevation(tileKey) {
    if (this.cache.has(tileKey)) {
      return this.cache.get(tileKey);
    }

    // Load and cache elevation data
    const elevation = this.loadElevationTile(tileKey);
    this.cache.set(tileKey, elevation);

    // Evict old tiles if cache is full
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return elevation;
  }
}
```

### 6. **Integration Example**

```javascript
// Complete integration with MapBox
mapboxgl.accessToken = "YOUR_TOKEN";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/satellite-v9",
  center: [-122.4194, 37.7749], // San Francisco
  zoom: 12,
  pitch: 45,
  bearing: 0,
});

map.on("load", () => {
  // Add terrain for elevation
  map.addSource("mapbox-dem", {
    type: "raster-dem",
    url: "mapbox://mapbox.mapbox-terrain-dem-v1",
    tileSize: 512,
    maxzoom: 14,
  });

  // Enable 3D terrain
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1.0 });

  // Add sea level rise visualization
  const seaLevelRise = new SeaLevelRiseVisualization(map);
  map.addLayer(seaLevelRise.createLayer());

  // Set water level to 61 meters (200 feet)
  seaLevelRise.setWaterLevel(61);
});

// Add UI control
const slider = document.getElementById("water-level-slider");
slider.addEventListener("input", (e) => {
  const meters = parseFloat(e.target.value);
  seaLevelRise.setWaterLevel(meters);

  // Update display
  document.getElementById("water-level-display").textContent = `${meters}m / ${(
    meters * 3.28084
  ).toFixed(0)}ft`;
});
```

### 7. **Visual Enhancements**

#### A. Wave Animation (Optional)

```glsl
// Add subtle wave movement for realism
float waveHeight = sin(u_time * 2.0 + v_texCoord.x * 10.0) * 0.1;
position.z += waveHeight * smoothstep(0.0, 5.0, v_depth);
```

#### B. Shoreline Foam

```glsl
// Add foam effect at water edges
float foamWidth = 2.0; // meters
float foamIntensity = smoothstep(foamWidth, 0.0, v_depth);
waterColor = mix(waterColor, vec3(0.9), foamIntensity * 0.5);
```

### 8. **Data Requirements (Simplified)**

For sea level rise visualization, you only need:

1. **Elevation Data**

   - MapBox Terrain-RGB (built-in, free)
   - Or custom DEM for higher accuracy

2. **Building Heights** (optional but recommended)
   - Available from MapBox building layer
   - Or custom building data

That's it! No need for:

- Drainage networks
- Flow coefficients
- Rainfall data
- Soil permeability

### 9. **Quick Implementation Timeline**

#### Week 1: Basic Water Rendering

- Set up custom layer
- Implement elevation-based water surface
- Basic depth-based coloring

#### Week 2: Visual Polish & Optimization

- Add transparency and fresnel effects
- Implement LOD system
- Add building intersection visualization

### 10. **Advantages of This Approach**

1. **Simplicity**: No complex physics simulation required
2. **Performance**: Runs smoothly even on modest hardware
3. **Accuracy**: For sea level rise, this is physically accurate
4. **Immediate Feedback**: Changes render instantly
5. **Predictable**: No simulation instabilities or convergence issues

## Conclusion

For visualizing sea level rise scenarios (like 200 feet of rise), this elevation-based approach provides:

- Accurate representation of flooded areas
- High performance
- Simple implementation
- Easy maintenance

This method is ideal when you need to show "what areas would be underwater at X meters of sea level rise" without simulating how the water gets there.
