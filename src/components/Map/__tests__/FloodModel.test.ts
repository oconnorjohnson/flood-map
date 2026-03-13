import { describe, expect, it } from "vitest";
import {
  buildConnectedFloodMaskFromElevations,
  boundsToTileRange,
  decodeTerrainRgb,
  lngLatToWorldPixel,
  SAN_FRANCISCO_MODEL_BOUNDS,
} from "../FloodModel";

describe("FloodModel", () => {
  it("decodes Terrain-RGB values into meters", () => {
    expect(decodeTerrainRgb(1, 135, 144)).toBeCloseTo(24, 1);
  });

  it("maps San Francisco bounds into a valid tile range", () => {
    const range = boundsToTileRange(SAN_FRANCISCO_MODEL_BOUNDS, 13);

    expect(range.minX).toBeLessThanOrEqual(range.maxX);
    expect(range.minY).toBeLessThanOrEqual(range.maxY);
  });

  it("converts coordinates into positive world pixels", () => {
    const point = lngLatToWorldPixel(-122.4194, 37.7749, 13);

    expect(point.x).toBeGreaterThan(0);
    expect(point.y).toBeGreaterThan(0);
  });

  it("only floods low terrain connected to the boundary", () => {
    const width = 5;
    const height = 5;
    const highGround = 100;
    const lowGround = 10;

    const elevations = new Float32Array([
      lowGround,
      lowGround,
      lowGround,
      lowGround,
      lowGround,
      lowGround,
      highGround,
      highGround,
      highGround,
      lowGround,
      lowGround,
      highGround,
      lowGround,
      highGround,
      lowGround,
      lowGround,
      highGround,
      highGround,
      highGround,
      lowGround,
      lowGround,
      lowGround,
      lowGround,
      lowGround,
      lowGround,
    ]);

    const mask = buildConnectedFloodMaskFromElevations(
      elevations,
      width,
      height,
      50
    );

    expect(mask[0]).toBe(255);
    expect(mask[12]).toBe(0);
  });
});
