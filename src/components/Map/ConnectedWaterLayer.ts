import mapboxgl from "mapbox-gl";
import type { BoundsLike } from "./FloodModel";

const vertexShaderSource = `#version 300 es
precision highp float;

in vec3 a_position;
in vec2 a_uv;

uniform mat4 u_matrix;

out vec2 v_uv;

void main() {
  v_uv = a_uv;
  gl_Position = u_matrix * vec4(a_position, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform sampler2D u_mask;
uniform float u_time;
uniform float u_waterLevel;

in vec2 v_uv;
out vec4 outColor;

float ripple(vec2 uv, float time) {
  return sin((uv.x * 120.0) + time * 0.9) * 0.012 +
         cos((uv.y * 150.0) - time * 0.7) * 0.012;
}

void main() {
  float mask = texture(u_mask, v_uv).r;
  if (mask < 0.08) {
    discard;
  }

  float edge = smoothstep(0.08, 0.45, mask);
  float wave = ripple(v_uv, u_time);
  vec3 deepWater = vec3(0.04, 0.16, 0.32);
  vec3 shallowWater = vec3(0.18, 0.42, 0.73);
  float cinematicBlend = clamp((u_waterLevel - 25.0) / 50.0, 0.0, 1.0);
  vec3 waterColor = mix(shallowWater, deepWater, 0.55 + cinematicBlend * 0.3);
  waterColor += vec3(wave * 0.8);

  float alpha = mix(0.52, 0.82, edge);
  outColor = vec4(waterColor, alpha);
}
`;

interface LayerResources {
  program: WebGLProgram;
  vertexBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  maskTexture: WebGLTexture;
  positionLocation: number;
  uvLocation: number;
  matrixLocation: WebGLUniformLocation;
  timeLocation: WebGLUniformLocation;
  waterLevelLocation: WebGLUniformLocation;
  maskLocation: WebGLUniformLocation;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create WebGL shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(log);
  }

  return shader;
}

function createProgram(gl: WebGL2RenderingContext): LayerResources {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );

  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create WebGL program");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "Unknown program link error";
    gl.deleteProgram(program);
    throw new Error(log);
  }

  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  const maskTexture = gl.createTexture();

  if (!vertexBuffer || !indexBuffer || !maskTexture) {
    throw new Error("Failed to allocate connected water layer resources");
  }

  const matrixLocation = gl.getUniformLocation(program, "u_matrix");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const waterLevelLocation = gl.getUniformLocation(program, "u_waterLevel");
  const maskLocation = gl.getUniformLocation(program, "u_mask");

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const uvLocation = gl.getAttribLocation(program, "a_uv");

  if (!matrixLocation || !timeLocation || !waterLevelLocation || !maskLocation) {
    throw new Error("Failed to resolve connected water uniforms");
  }

  return {
    program,
    vertexBuffer,
    indexBuffer,
    maskTexture,
    positionLocation,
    uvLocation,
    matrixLocation,
    timeLocation,
    waterLevelLocation,
    maskLocation,
  };
}

export class ConnectedWaterLayer implements mapboxgl.CustomLayerInterface {
  readonly id = "connected-water-layer";
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;

  private readonly resolution: number;
  private readonly bounds: BoundsLike;
  private waterLevel: number;
  private map: mapboxgl.Map | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private resources: LayerResources | null = null;
  private vertices = new Float32Array();
  private indices = new Uint16Array();
  private indexCount = 0;
  private maskWidth = 0;
  private maskHeight = 0;

  constructor(bounds: BoundsLike, waterLevel: number, resolution: number = 64) {
    this.bounds = bounds;
    this.waterLevel = waterLevel;
    this.resolution = resolution;
  }

  onAdd = (map: mapboxgl.Map, gl: WebGL2RenderingContext): void => {
    this.map = map;
    this.gl = gl;
    this.resources = createProgram(gl);
    this.rebuildMesh();
    this.uploadGeometry();
    this.updateMask(new Uint8Array([0]), 1, 1);
  };

  render = (gl: WebGL2RenderingContext, matrix: Array<number>): void => {
    if (!this.resources) return;

    gl.useProgram(this.resources.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.resources.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.resources.indexBuffer);

    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(this.resources.positionLocation);
    gl.vertexAttribPointer(
      this.resources.positionLocation,
      3,
      gl.FLOAT,
      false,
      stride,
      0
    );

    gl.enableVertexAttribArray(this.resources.uvLocation);
    gl.vertexAttribPointer(
      this.resources.uvLocation,
      2,
      gl.FLOAT,
      false,
      stride,
      3 * Float32Array.BYTES_PER_ELEMENT
    );

    gl.uniformMatrix4fv(this.resources.matrixLocation, false, matrix);
    gl.uniform1f(this.resources.timeLocation, performance.now() / 1000);
    gl.uniform1f(this.resources.waterLevelLocation, this.waterLevel);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.resources.maskTexture);
    gl.uniform1i(this.resources.maskLocation, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);

    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    gl.depthMask(true);
  };

  onRemove = (_map: mapboxgl.Map, gl: WebGL2RenderingContext): void => {
    if (!this.resources) return;

    gl.deleteTexture(this.resources.maskTexture);
    gl.deleteBuffer(this.resources.vertexBuffer);
    gl.deleteBuffer(this.resources.indexBuffer);
    gl.deleteProgram(this.resources.program);

    this.resources = null;
    this.map = null;
    this.gl = null;
  };

  setWaterLevel(waterLevel: number): void {
    this.waterLevel = waterLevel;
    this.rebuildMesh();
    this.uploadGeometry();
    this.map?.triggerRepaint();
  }

  updateMask(mask: Uint8Array, width: number, height: number): void {
    if (!this.gl || !this.resources) return;

    this.maskWidth = width;
    this.maskHeight = height;

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.resources.maskTexture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      width,
      height,
      0,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      mask
    );

    this.map?.triggerRepaint();
  }

  private rebuildMesh(): void {
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y <= this.resolution; y += 1) {
      const v = y / this.resolution;
      const lat = this.bounds.north + (this.bounds.south - this.bounds.north) * v;

      for (let x = 0; x <= this.resolution; x += 1) {
        const u = x / this.resolution;
        const lng = this.bounds.west + (this.bounds.east - this.bounds.west) * u;
        const mercator = mapboxgl.MercatorCoordinate.fromLngLat(
          { lng, lat },
          this.waterLevel
        );

        vertices.push(mercator.x, mercator.y, mercator.z, u, v);
      }
    }

    for (let y = 0; y < this.resolution; y += 1) {
      for (let x = 0; x < this.resolution; x += 1) {
        const topLeft = y * (this.resolution + 1) + x;
        const topRight = topLeft + 1;
        const bottomLeft = (y + 1) * (this.resolution + 1) + x;
        const bottomRight = bottomLeft + 1;

        indices.push(topLeft, bottomLeft, topRight);
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    this.vertices = new Float32Array(vertices);
    this.indices = new Uint16Array(indices);
    this.indexCount = this.indices.length;
  }

  private uploadGeometry(): void {
    if (!this.gl || !this.resources) return;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.resources.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.STATIC_DRAW);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.resources.indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indices, this.gl.STATIC_DRAW);
  }
}
