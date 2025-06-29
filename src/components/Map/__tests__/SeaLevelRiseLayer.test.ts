import { describe, it, expect, vi, beforeEach } from "vitest";
import { SeaLevelRiseLayer } from "../SeaLevelRiseLayer";

// Mock WebGL context
const createMockGL = () => {
  return {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    LINK_STATUS: 35714,
    COMPILE_STATUS: 35713,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TRIANGLES: 4,
    UNSIGNED_SHORT: 5123,
    TEXTURE_2D: 3553,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    LINEAR: 9729,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    CLAMP_TO_EDGE: 33071,
    TEXTURE0: 33984,
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
    DEPTH_TEST: 2929,

    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ""),
    getShaderInfoLog: vi.fn(() => ""),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    useProgram: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    depthMask: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform2f: vi.fn(),
    uniform3fv: vi.fn(),
    activeTexture: vi.fn(),
    drawElements: vi.fn(),
    deleteProgram: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteTexture: vi.fn(),
  };
};

// Mock Mapbox map
const createMockMap = () => {
  return {
    getCanvas: vi.fn(() => ({ width: 800, height: 600 })),
    getZoom: vi.fn(() => 12),
    getCenter: vi.fn(() => ({ lng: -122.45, lat: 37.75 })),
    getBounds: vi.fn(() => ({
      getNorthEast: () => ({ lng: -122.35, lat: 37.85 }),
      getSouthWest: () => ({ lng: -122.55, lat: 37.65 }),
    })),
  };
};

describe("SeaLevelRiseLayer", () => {
  let layer: SeaLevelRiseLayer;
  let mockGL: any;
  let mockMap: any;

  beforeEach(() => {
    layer = new SeaLevelRiseLayer(10);
    mockGL = createMockGL();
    mockMap = createMockMap();
  });

  describe("constructor", () => {
    it("should initialize with default water level", () => {
      const defaultLayer = new SeaLevelRiseLayer();
      expect(defaultLayer.id).toBe("sea-level-rise");
      expect(defaultLayer.type).toBe("custom");
      expect(defaultLayer.renderingMode).toBe("3d");
    });

    it("should initialize with specified water level", () => {
      expect(layer.id).toBe("sea-level-rise");
      // Water level is private, but we can test its effect in render
    });

    it("should create mesh data on initialization", () => {
      // The layer should have vertices and indices created
      // We can't directly access private properties, but we can verify
      // the layer is ready to be added to the map
      expect(layer.onAdd).toBeDefined();
      expect(layer.render).toBeDefined();
      expect(layer.onRemove).toBeDefined();
    });
  });

  describe("onAdd", () => {
    it("should create shader program", () => {
      layer.onAdd(mockMap as any, mockGL);

      expect(mockGL.createShader).toHaveBeenCalledTimes(2);
      expect(mockGL.createProgram).toHaveBeenCalled();
      expect(mockGL.attachShader).toHaveBeenCalledTimes(2);
      expect(mockGL.linkProgram).toHaveBeenCalled();
    });

    it("should create buffers", () => {
      layer.onAdd(mockMap as any, mockGL);

      expect(mockGL.createBuffer).toHaveBeenCalledTimes(2); // vertex and index buffers
      expect(mockGL.bindBuffer).toHaveBeenCalled();
      expect(mockGL.bufferData).toHaveBeenCalled();
    });

    it("should create terrain texture", () => {
      layer.onAdd(mockMap as any, mockGL);

      expect(mockGL.createTexture).toHaveBeenCalled();
      expect(mockGL.bindTexture).toHaveBeenCalled();
      expect(mockGL.texImage2D).toHaveBeenCalled();
      expect(mockGL.texParameteri).toHaveBeenCalled();
    });

    it("should handle shader compilation failure", () => {
      mockGL.getShaderParameter = vi.fn(() => false);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      layer.onAdd(mockMap as any, mockGL);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create shaders")
      );
      consoleSpy.mockRestore();
    });

    it("should handle program linking failure", () => {
      mockGL.getProgramParameter = vi.fn(() => false);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      layer.onAdd(mockMap as any, mockGL);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to link program:"),
        ""
      );
      consoleSpy.mockRestore();
    });
  });

  describe("render", () => {
    beforeEach(() => {
      layer.onAdd(mockMap as any, mockGL);
    });

    it("should set up GL state correctly", () => {
      const matrix = new Float32Array(16);
      layer.render(mockGL, matrix as any);

      expect(mockGL.useProgram).toHaveBeenCalled();
      expect(mockGL.enable).toHaveBeenCalledWith(mockGL.BLEND);
      expect(mockGL.enable).toHaveBeenCalledWith(mockGL.DEPTH_TEST);
      expect(mockGL.blendFunc).toHaveBeenCalledWith(
        mockGL.SRC_ALPHA,
        mockGL.ONE_MINUS_SRC_ALPHA
      );
      expect(mockGL.depthMask).toHaveBeenCalledWith(false);
    });

    it("should set uniforms", () => {
      const matrix = new Float32Array(16);
      layer.render(mockGL, matrix as any);

      expect(mockGL.uniformMatrix4fv).toHaveBeenCalled();
      expect(mockGL.uniform1f).toHaveBeenCalled(); // water level and time
      expect(mockGL.uniform3fv).toHaveBeenCalled(); // camera position
      expect(mockGL.uniform1i).toHaveBeenCalled(); // texture sampler
      expect(mockGL.uniform2f).toHaveBeenCalled(); // terrain size
    });

    it("should draw elements", () => {
      const matrix = new Float32Array(16);
      layer.render(mockGL, matrix as any);

      expect(mockGL.drawElements).toHaveBeenCalledWith(
        mockGL.TRIANGLES,
        expect.any(Number),
        mockGL.UNSIGNED_SHORT,
        0
      );
    });

    it("should restore depth mask after rendering", () => {
      const matrix = new Float32Array(16);
      layer.render(mockGL, matrix as any);

      expect(mockGL.depthMask).toHaveBeenCalledWith(false);
      expect(mockGL.depthMask).toHaveBeenCalledWith(true);
    });

    it("should handle missing program gracefully", () => {
      // Simulate failed initialization
      layer = new SeaLevelRiseLayer();
      const matrix = new Float32Array(16);

      // Should not throw
      expect(() => layer.render(mockGL, matrix as any)).not.toThrow();
      expect(mockGL.useProgram).not.toHaveBeenCalled();
    });
  });

  describe("onRemove", () => {
    it("should clean up resources", () => {
      layer.onAdd(mockMap as any, mockGL);
      layer.onRemove();

      expect(mockGL.deleteProgram).toHaveBeenCalled();
      expect(mockGL.deleteBuffer).toHaveBeenCalledTimes(2);
      expect(mockGL.deleteTexture).toHaveBeenCalled();
    });

    it("should handle removal without initialization", () => {
      // Should not throw
      expect(() => layer.onRemove()).not.toThrow();
    });
  });

  describe("setWaterLevel", () => {
    it("should update water level", () => {
      const newLevel = 25;
      layer.setWaterLevel(newLevel);

      // We can't directly test the private waterLevel property,
      // but we can verify it's used in render
      layer.onAdd(mockMap as any, mockGL);
      const matrix = new Float32Array(16);
      layer.render(mockGL, matrix as any);

      // Check that uniform1f was called with the new water level
      expect(mockGL.uniform1f).toHaveBeenCalledWith(
        expect.anything(),
        newLevel
      );
    });
  });

  describe("mesh generation", () => {
    it("should create appropriate number of vertices", () => {
      // With resolution 128, we should have (128+1)*(128+1)*2 vertex components
      const expectedVertices = 129 * 129 * 2;

      // We can verify this indirectly through buffer creation
      layer.onAdd(mockMap as any, mockGL);

      // Find the call to bufferData for vertex buffer
      const vertexBufferCall = mockGL.bufferData.mock.calls.find(
        (call: any[]) => call[0] === mockGL.ARRAY_BUFFER
      );

      expect(vertexBufferCall).toBeDefined();
      expect(vertexBufferCall[1]).toBeInstanceOf(Float32Array);
      expect(vertexBufferCall[1].length).toBe(expectedVertices);
    });

    it("should create appropriate number of indices", () => {
      // With resolution 128, we should have 128*128*2*3 indices
      const expectedIndices = 128 * 128 * 2 * 3;

      layer.onAdd(mockMap as any, mockGL);

      // Find the call to bufferData for index buffer
      const indexBufferCall = mockGL.bufferData.mock.calls.find(
        (call: any[]) => call[0] === mockGL.ELEMENT_ARRAY_BUFFER
      );

      expect(indexBufferCall).toBeDefined();
      expect(indexBufferCall[1]).toBeInstanceOf(Uint16Array);
      expect(indexBufferCall[1].length).toBe(expectedIndices);
    });
  });
});
