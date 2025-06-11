import mapboxgl from "mapbox-gl";

// Terrain-RGB decoder function as specified in technical docs
export const decodeTerrainRGB = (r: number, g: number, b: number): number => {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
};

export class FloodOverlayLayer implements mapboxgl.CustomLayerInterface {
  id: string;
  type: "custom" = "custom";
  renderingMode: "2d" = "2d";
  private waterLevel: number;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;

  constructor(id: string, waterLevel: number = 0) {
    this.id = id;
    this.waterLevel = waterLevel;
  }

  setWaterLevel(level: number) {
    this.waterLevel = level;
  }

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
    // Vertex shader
    const vertexSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment shader for flood overlay
    const fragmentSource = `
      precision mediump float;
      uniform float u_waterLevel;
      uniform vec2 u_resolution;
      uniform sampler2D u_terrain;
      uniform mat4 u_matrix;
      
      void main() {
        vec2 texCoord = gl_FragCoord.xy / u_resolution;
        
        // Sample terrain data (we'll implement this when we have actual terrain tiles)
        vec4 terrainData = texture2D(u_terrain, texCoord);
        
        // Decode elevation from RGB
        float elevation = -10000.0 + (terrainData.r * 256.0 * 256.0 + terrainData.g * 256.0 + terrainData.b) * 0.1;
        
        // Show flood if elevation is below water level
        if (elevation < u_waterLevel) {
          // Blue overlay with transparency
          gl_FragColor = vec4(0.2, 0.6, 1.0, 0.6);
        } else {
          // Transparent
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      }
    `;

    // Create shaders
    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentSource
    );

    if (!vertexShader || !fragmentShader) {
      console.error("Failed to create shaders");
      return;
    }

    // Create program
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

    // Create buffer for full-screen quad
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
  }

  render(gl: WebGLRenderingContext, matrix: number[]) {
    // Temporarily disable the custom WebGL layer since it's covering the entire map
    // We're using GeoJSON polygons for flood visualization instead
    // This will be re-enabled when we have proper terrain tiles
    return;
  }

  onRemove() {
    // Cleanup if needed
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
