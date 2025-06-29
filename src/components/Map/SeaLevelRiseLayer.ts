import mapboxgl from "mapbox-gl";

// Vertex shader source for water surface rendering
const vertexShaderSource = `
  attribute vec2 a_position;
  uniform mat4 u_matrix;
  uniform float u_waterLevel;
  
  varying vec2 v_texCoord;
  varying vec3 v_worldPos;
  
  void main() {
    v_texCoord = a_position * 0.5 + 0.5; // Convert from [-1,1] to [0,1]
    
    // Convert normalized position to world coordinates
    vec3 worldPos = vec3(a_position.x, a_position.y, u_waterLevel);
    v_worldPos = worldPos;
    
    // Transform to clip space
    gl_Position = u_matrix * vec4(worldPos, 1.0);
  }
`;

// Fragment shader source for realistic water rendering
const fragmentShaderSource = `
  precision highp float;
  
  uniform float u_waterLevel;
  uniform float u_time;
  uniform vec3 u_cameraPosition;
  uniform sampler2D u_terrain;
  uniform vec2 u_terrainSize;
  
  varying vec2 v_texCoord;
  varying vec3 v_worldPos;
  
  // Simple noise function for water animation
  float noise(vec2 p) {
    return sin(p.x * 10.0 + u_time) * sin(p.y * 10.0 + u_time * 0.8) * 0.5 + 0.5;
  }
  
  void main() {
    // Sample terrain height at this position
    float terrainHeight = texture2D(u_terrain, v_texCoord).r * 255.0;
    
    // Discard fragments where terrain is above water
    if (terrainHeight >= u_waterLevel) {
      discard;
    }
    
    // Calculate water depth
    float depth = u_waterLevel - terrainHeight;
    
    // Water color based on depth
    vec3 shallowColor = vec3(0.4, 0.7, 0.9);
    vec3 deepColor = vec3(0.1, 0.3, 0.6);
    float depthFactor = smoothstep(0.0, 10.0, depth);
    vec3 waterColor = mix(shallowColor, deepColor, depthFactor);
    
    // Add subtle wave animation
    float wave = noise(v_texCoord * 20.0) * 0.05;
    waterColor += vec3(wave);
    
    // Calculate view direction for fresnel effect
    vec3 viewDir = normalize(u_cameraPosition - v_worldPos);
    vec3 normal = vec3(0.0, 0.0, 1.0); // Water surface normal (pointing up)
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
    
    // Add fresnel highlight
    waterColor += vec3(0.1, 0.15, 0.2) * fresnel;
    
    // Alpha based on depth (more transparent in shallow areas)
    float alpha = smoothstep(0.0, 2.0, depth) * 0.85 + 0.15;
    
    // Add foam effect at water edges
    float foamWidth = 1.0;
    float foamIntensity = smoothstep(foamWidth, 0.0, depth);
    waterColor = mix(waterColor, vec3(0.9, 0.95, 1.0), foamIntensity * 0.4);
    
    gl_FragColor = vec4(waterColor, alpha);
  }
`;

export class SeaLevelRiseLayer implements mapboxgl.CustomLayerInterface {
  id: string = "sea-level-rise";
  type: "custom" = "custom";
  renderingMode: "3d" = "3d";

  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private terrainTexture: WebGLTexture | null = null;

  private waterLevel: number = 0;
  private vertices: Float32Array;
  private indices: Uint16Array;
  private vertexCount: number = 0;

  // Uniforms
  private uMatrix: WebGLUniformLocation | null = null;
  private uWaterLevel: WebGLUniformLocation | null = null;
  private uTime: WebGLUniformLocation | null = null;
  private uCameraPosition: WebGLUniformLocation | null = null;
  private uTerrain: WebGLUniformLocation | null = null;
  private uTerrainSize: WebGLUniformLocation | null = null;

  // Position attribute
  private aPosition: number = -1;

  constructor(waterLevel: number = 0) {
    this.waterLevel = waterLevel;

    // Create mesh covering San Francisco area
    const bounds = {
      west: -122.55,
      east: -122.35,
      south: 37.7,
      north: 37.85,
    };

    const { vertices, indices } = this.createWaterMesh(bounds, 128);
    this.vertices = vertices;
    this.indices = indices;
    this.vertexCount = indices.length;
  }

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    this.gl = gl;

    // Create shader program
    const vertexShader = this.createShader(
      gl,
      gl.VERTEX_SHADER,
      vertexShaderSource
    );
    const fragmentShader = this.createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );

    if (!vertexShader || !fragmentShader) {
      console.error("Failed to create shaders");
      return;
    }

    this.program = gl.createProgram();
    if (!this.program) {
      console.error("Failed to create program");
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
    this.aPosition = gl.getAttribLocation(this.program, "a_position");
    this.uMatrix = gl.getUniformLocation(this.program, "u_matrix");
    this.uWaterLevel = gl.getUniformLocation(this.program, "u_waterLevel");
    this.uTime = gl.getUniformLocation(this.program, "u_time");
    this.uCameraPosition = gl.getUniformLocation(
      this.program,
      "u_cameraPosition"
    );
    this.uTerrain = gl.getUniformLocation(this.program, "u_terrain");
    this.uTerrainSize = gl.getUniformLocation(this.program, "u_terrainSize");

    // Create buffers
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

    // Create terrain texture (placeholder for now)
    this.terrainTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.terrainTexture);

    // Create a dummy terrain texture for now
    const terrainData = new Uint8Array(512 * 512 * 4);
    for (let i = 0; i < terrainData.length; i += 4) {
      terrainData[i] = 0; // R - elevation
      terrainData[i + 1] = 0; // G
      terrainData[i + 2] = 0; // B
      terrainData[i + 3] = 255; // A
    }

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      512,
      512,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      terrainData
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  render(gl: WebGLRenderingContext, matrix: number[]): void {
    if (!this.program || !this.vertexBuffer || !this.indexBuffer) return;

    // Use shader program
    gl.useProgram(this.program);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false); // Don't write to depth buffer for transparent water

    // Bind vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    // Bind index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    // Set uniforms
    gl.uniformMatrix4fv(this.uMatrix, false, matrix);
    gl.uniform1f(this.uWaterLevel, this.waterLevel);
    gl.uniform1f(this.uTime, performance.now() / 1000.0);

    // Camera position (approximate from matrix)
    const cameraPos = [0, 0, 100]; // Placeholder
    gl.uniform3fv(this.uCameraPosition, cameraPos);

    // Bind terrain texture
    if (this.terrainTexture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.terrainTexture);
      gl.uniform1i(this.uTerrain, 0);
      gl.uniform2f(this.uTerrainSize, 512, 512);
    }

    // Draw water surface
    gl.drawElements(gl.TRIANGLES, this.vertexCount, gl.UNSIGNED_SHORT, 0);

    // Restore depth mask
    gl.depthMask(true);
  }

  onRemove(): void {
    if (!this.gl) return;

    if (this.program) {
      this.gl.deleteProgram(this.program);
    }
    if (this.vertexBuffer) {
      this.gl.deleteBuffer(this.vertexBuffer);
    }
    if (this.indexBuffer) {
      this.gl.deleteBuffer(this.indexBuffer);
    }
    if (this.terrainTexture) {
      this.gl.deleteTexture(this.terrainTexture);
    }
  }

  setWaterLevel(level: number): void {
    this.waterLevel = level;
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

  private createWaterMesh(
    bounds: { west: number; east: number; south: number; north: number },
    resolution: number = 128
  ): { vertices: Float32Array; indices: Uint16Array } {
    const vertices: number[] = [];
    const indices: number[] = [];

    // Create grid of vertices
    for (let y = 0; y <= resolution; y++) {
      for (let x = 0; x <= resolution; x++) {
        const u = x / resolution;
        const v = y / resolution;

        // Map to normalized coordinates [-1, 1]
        const nx = u * 2 - 1;
        const ny = v * 2 - 1;

        vertices.push(nx, ny);
      }
    }

    // Create triangles
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const topLeft = y * (resolution + 1) + x;
        const topRight = topLeft + 1;
        const bottomLeft = (y + 1) * (resolution + 1) + x;
        const bottomRight = bottomLeft + 1;

        // First triangle
        indices.push(topLeft, bottomLeft, topRight);
        // Second triangle
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
    };
  }
}
