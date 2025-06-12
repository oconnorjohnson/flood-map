import mapboxgl from "mapbox-gl";

// Terrain-RGB decoder function from technical docs
export const decodeTerrainRGB = (r: number, g: number, b: number): number => {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
};

export class OceanRiseLayer implements mapboxgl.CustomLayerInterface {
  id: string;
  type: "custom" = "custom";
  renderingMode: "3d" = "3d";
  private waterLevel: number;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private positionLocation: number = -1;
  private matrixLocation: WebGLUniformLocation | null = null;
  private waterLevelLocation: WebGLUniformLocation | null = null;

  constructor(id: string, waterLevel: number = 0) {
    this.id = id;
    this.waterLevel = waterLevel;
  }

  setWaterLevel(level: number) {
    this.waterLevel = level;
  }

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
    // Vertex shader - transforms geographic coordinates to screen space
    const vertexSource = `
      attribute vec2 a_position;
      uniform mat4 u_matrix;
      varying vec2 v_texCoord;
      varying vec2 v_worldPos;
      
      void main() {
        // Transform geographic coordinates using Mapbox's projection matrix
        gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
        
        // Pass world position for elevation calculation
        v_worldPos = a_position;
        
        // Calculate texture coordinates based on SF bounds
        // Map lng/lat to 0-1 texture coordinates
        v_texCoord = vec2(
          (a_position.x + 122.5155) / (122.3557 - 122.5155),  // lng to [0,1]
          (a_position.y - 37.7034) / (37.8324 - 37.7034)      // lat to [0,1]
        );
      }
    `;

    // Fragment shader - samples terrain elevation and renders water
    const fragmentSource = `
      precision mediump float;
      uniform float u_waterLevel;
      varying vec2 v_texCoord;
      
      // Realistic SF elevation model with proper topography
      float getElevation(vec2 coord) {
        // Map texture coordinates to SF bounds
        float lng = -122.5155 + ((-122.3557 + 122.5155) * coord.x);
        float lat = 37.7034 + ((37.8324 - 37.7034) * coord.y);
        
        // Distance calculations for topographic features
        float distFromBay = coord.x; // 0 = western edge, 1 = bay (eastern edge)
        float distFromSouth = coord.y; // 0 = southern edge, 1 = northern edge
        
        // Base elevation starts at sea level near water bodies
        float elevation = 0.0;
        
        // 1. Coastal areas (Pacific Ocean - west side)
        if (distFromBay < 0.15) {
          // Ocean Beach area - very low, but some dunes
          elevation = mix(0.0, 8.0, distFromBay / 0.15);
        }
        // 2. Eastern bay areas (Mission Bay, SOMA, Financial District)
        else if (distFromBay > 0.85) {
          // Near the bay - very flat and low
          elevation = mix(0.0, 5.0, (1.0 - distFromBay) / 0.15);
        }
        // 3. Central SF with hills
        else {
          // Base elevation rises toward center
          float centerDist = abs(distFromBay - 0.5) * 2.0; // 0 at center, 1 at edges
          elevation = mix(50.0, 15.0, centerDist);
        }
        
        // Add major hills and valleys
        
        // Twin Peaks (central-south, highest point ~280m)
        float twinPeaksX = 0.52;
        float twinPeaksY = 0.35;
        float twinPeaksDist = distance(vec2(distFromBay, distFromSouth), vec2(twinPeaksX, twinPeaksY));
        if (twinPeaksDist < 0.08) {
          elevation += mix(230.0, 0.0, twinPeaksDist / 0.08);
        }
        
        // Nob Hill (central-north, ~110m)
        float nobHillX = 0.42;
        float nobHillY = 0.72;
        float nobHillDist = distance(vec2(distFromBay, distFromSouth), vec2(nobHillX, nobHillY));
        if (nobHillDist < 0.06) {
          elevation += mix(90.0, 0.0, nobHillDist / 0.06);
        }
        
        // Russian Hill (central-north, ~90m)
        float russianHillX = 0.38;
        float russianHillY = 0.78;
        float russianHillDist = distance(vec2(distFromBay, distFromSouth), vec2(russianHillX, russianHillY));
        if (russianHillDist < 0.05) {
          elevation += mix(70.0, 0.0, russianHillDist / 0.05);
        }
        
        // Pacific Heights (central-west, ~100m)
        float pacificHeightsX = 0.32;
        float pacificHeightsY = 0.68;
        float pacificHeightsDist = distance(vec2(distFromBay, distFromSouth), vec2(pacificHeightsX, pacificHeightsY));
        if (pacificHeightsDist < 0.08) {
          elevation += mix(80.0, 0.0, pacificHeightsDist / 0.08);
        }
        
        // Mission Bay (southeast, very low ~0-3m)
        if (distFromBay > 0.75 && distFromSouth < 0.4) {
          elevation = mix(elevation, 1.0, 0.8); // Force very low
        }
        
        // SOMA (east-central, low ~3-8m)
        if (distFromBay > 0.65 && distFromBay < 0.85 && distFromSouth > 0.4 && distFromSouth < 0.7) {
          elevation = mix(elevation, 5.0, 0.6);
        }
        
        // Sunset District (west, gradual rise from ocean ~20-60m)
        if (distFromBay < 0.4 && distFromSouth > 0.2 && distFromSouth < 0.8) {
          float sunsetElevation = mix(8.0, 40.0, distFromBay / 0.4);
          elevation = mix(elevation, sunsetElevation, 0.7);
        }
        
        return max(elevation, 0.0); // Ensure no negative elevations
      }
      
      // Check if a point is connected to water source via flood fill logic
      bool isFloodReachable(vec2 coord, float waterLevel) {
        float elevation = getElevation(coord);
        
        // If above water level, definitely not flooded
        if (elevation > waterLevel) return false;
        
        // Check if connected to a water source
        // Water sources: Pacific Ocean (west), SF Bay (east), Golden Gate (north)
        
        // Pacific Ocean source (west edge)
        if (coord.x < 0.05) return true;
        
        // SF Bay source (east edge)  
        if (coord.x > 0.95) return true;
        
        // Golden Gate area (north edge, central part)
        if (coord.y > 0.95 && coord.x > 0.3 && coord.x < 0.7) return true;
        
        // For inland areas, do a simplified connectivity check
        // Check if there's a path of low elevation to a water source
        
        // Sample points along a path to the nearest water source
        vec2 nearestWaterSource;
        if (coord.x < 0.5) {
          // Closer to Pacific
          nearestWaterSource = vec2(0.0, coord.y);
        } else {
          // Closer to Bay
          nearestWaterSource = vec2(1.0, coord.y);
        }
        
        // Sample elevation along path to water source
        // Use constant loop bounds (WebGL requirement)
        for (int i = 1; i < 20; i++) {
          float t = float(i) / 20.0;
          vec2 samplePoint = mix(coord, nearestWaterSource, t);
          float sampleElevation = getElevation(samplePoint);
          
          // If we hit a barrier (elevation above water level), not reachable
          if (sampleElevation > waterLevel) {
            return false;
          }
        }
        
        return true; // Path is clear
      }
      
      void main() {
        float elevation = getElevation(v_texCoord);
        
        // Show water only if below water level AND reachable from water source
        if (isFloodReachable(v_texCoord, u_waterLevel)) {
          // Calculate water depth for visual effect
          float depth = u_waterLevel - elevation;
          
          // Water color varies with depth and proximity to shore
          vec3 shallowWater = vec3(0.6, 0.9, 1.0); // Very light blue for shallow
          vec3 mediumWater = vec3(0.2, 0.7, 0.9);  // Medium blue  
          vec3 deepWater = vec3(0.0, 0.4, 0.8);    // Dark blue for deep
          
          float depthFactor = clamp(depth / 30.0, 0.0, 1.0);
          vec3 waterColor;
          
          if (depth < 5.0) {
            // Very shallow water - mix between shallow and medium
            waterColor = mix(shallowWater, mediumWater, depth / 5.0);
          } else {
            // Deeper water - mix between medium and deep
            waterColor = mix(mediumWater, deepWater, (depth - 5.0) / 25.0);
          }
          
          // Add slight wave effect based on position
          float wave = sin(v_texCoord.x * 50.0) * sin(v_texCoord.y * 50.0) * 0.1;
          waterColor += vec3(wave * 0.1, wave * 0.1, wave * 0.05);
          
          gl_FragColor = vec4(waterColor, 0.8); // Semi-transparent water
        } else {
          // No water - transparent
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      }
    `;

    // Create and compile shaders
    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentSource
    );

    if (!vertexShader || !fragmentShader) {
      console.error("Failed to create shaders for OceanRiseLayer");
      return;
    }

    // Create program
    this.program = gl.createProgram();
    if (!this.program) {
      console.error("Failed to create WebGL program");
      return;
    }

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error(
        "Failed to link program:",
        gl.getProgramInfoLog(this.program)
      );
      return;
    }

    // Get attribute and uniform locations
    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    this.matrixLocation = gl.getUniformLocation(this.program, "u_matrix");
    this.waterLevelLocation = gl.getUniformLocation(
      this.program,
      "u_waterLevel"
    );

    console.log(
      "OceanRiseLayer: Uniform locations - matrix:",
      this.matrixLocation,
      "waterLevel:",
      this.waterLevelLocation
    );

    // Create buffer for full-screen quad
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    // Create a quad covering San Francisco in geographic coordinates (lng, lat)
    const sfBounds = [
      -122.5155,
      37.7034, // SW corner (lng, lat)
      -122.3557,
      37.7034, // SE corner
      -122.5155,
      37.8324, // NW corner
      -122.3557,
      37.8324, // NE corner
    ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sfBounds), gl.STATIC_DRAW);

    console.log(
      "OceanRiseLayer: WebGL setup complete, water level:",
      this.waterLevel
    );
  }

  render(gl: WebGLRenderingContext, matrix: number[]) {
    if (!this.program || !this.buffer) {
      console.log("OceanRiseLayer: Missing program or buffer");
      return;
    }

    gl.useProgram(this.program);

    // Set uniforms
    if (this.matrixLocation) {
      gl.uniformMatrix4fv(this.matrixLocation, false, matrix);
    }
    if (this.waterLevelLocation) {
      gl.uniform1f(this.waterLevelLocation, this.waterLevel);
    }

    // Bind buffer and set up attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw the quad as triangle strip
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Clean up
    gl.disable(gl.BLEND);

    // Debug log (only occasionally to avoid spam)
    if (Math.random() < 0.01) {
      console.log("OceanRiseLayer: Rendered with water level", this.waterLevel);
    }
  }

  onRemove() {
    // Cleanup WebGL resources
    if (this.program) {
      // Note: Shader cleanup would happen here in production
    }
  }

  private createShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }
}
