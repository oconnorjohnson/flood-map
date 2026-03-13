const DEFAULT_TILE_SIZE = 512;
export const DEFAULT_TERRAIN_ZOOM = 13;

export interface BoundsLike {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TerrainModelMetadata {
  zoom: number;
  width: number;
  height: number;
  bounds: BoundsLike;
}

export const SAN_FRANCISCO_MODEL_BOUNDS: BoundsLike = {
  west: -122.56,
  east: -122.32,
  south: 37.68,
  north: 37.84,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function decodeTerrainRgb(r: number, g: number, b: number): number {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

export function lngLatToWorldPixel(
  lng: number,
  lat: number,
  zoom: number,
  tileSize: number = DEFAULT_TILE_SIZE
): { x: number; y: number } {
  const scale = tileSize * 2 ** zoom;
  const clampedLat = clamp(lat, -85.05112878, 85.05112878);
  const x = ((lng + 180) / 360) * scale;
  const latRad = (clampedLat * Math.PI) / 180;
  const mercatorY =
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;

  return {
    x,
    y: mercatorY * scale,
  };
}

export function worldPixelToLngLat(
  x: number,
  y: number,
  zoom: number,
  tileSize: number = DEFAULT_TILE_SIZE
): { lng: number; lat: number } {
  const scale = tileSize * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const y2 = Math.PI * (1 - (2 * y) / scale);
  const lat =
    (180 / Math.PI) * Math.atan(0.5 * (Math.exp(y2) - Math.exp(-y2)));

  return { lng, lat };
}

export function boundsToTileRange(
  bounds: BoundsLike,
  zoom: number,
  tileSize: number = DEFAULT_TILE_SIZE
): TileRange {
  const topLeft = lngLatToWorldPixel(bounds.west, bounds.north, zoom, tileSize);
  const bottomRight = lngLatToWorldPixel(
    bounds.east,
    bounds.south,
    zoom,
    tileSize
  );

  return {
    minX: Math.floor(topLeft.x / tileSize),
    maxX: Math.floor(bottomRight.x / tileSize),
    minY: Math.floor(topLeft.y / tileSize),
    maxY: Math.floor(bottomRight.y / tileSize),
  };
}

export function tileRangeToBounds(
  tileRange: TileRange,
  zoom: number,
  tileSize: number = DEFAULT_TILE_SIZE
): BoundsLike {
  const topLeft = worldPixelToLngLat(
    tileRange.minX * tileSize,
    tileRange.minY * tileSize,
    zoom,
    tileSize
  );
  const bottomRight = worldPixelToLngLat(
    (tileRange.maxX + 1) * tileSize,
    (tileRange.maxY + 1) * tileSize,
    zoom,
    tileSize
  );

  return {
    west: topLeft.lng,
    east: bottomRight.lng,
    north: topLeft.lat,
    south: bottomRight.lat,
  };
}

export function buildConnectedFloodMaskFromElevations(
  elevations: Float32Array,
  width: number,
  height: number,
  waterLevel: number
): Uint8Array {
  const totalCells = width * height;
  const floodMask = new Uint8Array(totalCells);
  const queue = new Uint32Array(totalCells);
  let head = 0;
  let tail = 0;

  const enqueueIfFlooded = (index: number) => {
    if (floodMask[index] === 255) return;

    const elevation = elevations[index];
    if (!Number.isFinite(elevation) || elevation > waterLevel) return;

    floodMask[index] = 255;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfFlooded(x);
    enqueueIfFlooded((height - 1) * width + x);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfFlooded(y * width);
    enqueueIfFlooded(y * width + (width - 1));
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;

    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueueIfFlooded(index - 1);
    if (x < width - 1) enqueueIfFlooded(index + 1);
    if (y > 0) enqueueIfFlooded(index - width);
    if (y < height - 1) enqueueIfFlooded(index + width);

    if (x > 0 && y > 0) enqueueIfFlooded(index - width - 1);
    if (x < width - 1 && y > 0) enqueueIfFlooded(index - width + 1);
    if (x > 0 && y < height - 1) enqueueIfFlooded(index + width - 1);
    if (x < width - 1 && y < height - 1) enqueueIfFlooded(index + width + 1);
  }

  return floodMask;
}

function getTileUrl(token: string, zoom: number, x: number, y: number): string {
  const params = new URLSearchParams({
    access_token: token,
  });

  return `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${x}/${y}.pngraw?${params.toString()}`;
}

async function loadImageBitmap(url: string): Promise<CanvasImageSource> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load terrain tile: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();

  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }

  const imageUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = "anonymous";
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Failed to decode terrain tile image"));
      element.src = imageUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export class TerrainRgbModel {
  readonly metadata: TerrainModelMetadata;

  private readonly token: string;
  private readonly tileSize: number;
  private readonly tileRange: TileRange;
  private elevations: Float32Array | null = null;

  constructor(
    token: string,
    bounds: BoundsLike = SAN_FRANCISCO_MODEL_BOUNDS,
    zoom: number = DEFAULT_TERRAIN_ZOOM,
    tileSize: number = DEFAULT_TILE_SIZE
  ) {
    this.token = token;
    this.tileSize = tileSize;
    this.tileRange = boundsToTileRange(bounds, zoom, tileSize);

    const width = (this.tileRange.maxX - this.tileRange.minX + 1) * tileSize;
    const height = (this.tileRange.maxY - this.tileRange.minY + 1) * tileSize;

    this.metadata = {
      zoom,
      width,
      height,
      bounds: tileRangeToBounds(this.tileRange, zoom, tileSize),
    };
  }

  async load(): Promise<void> {
    if (this.elevations) return;

    const canvas = document.createElement("canvas");
    canvas.width = this.metadata.width;
    canvas.height = this.metadata.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Failed to create terrain canvas context");
    }

    const jobs: Array<Promise<void>> = [];

    for (let tileY = this.tileRange.minY; tileY <= this.tileRange.maxY; tileY += 1) {
      for (let tileX = this.tileRange.minX; tileX <= this.tileRange.maxX; tileX += 1) {
        const url = getTileUrl(this.token, this.metadata.zoom, tileX, tileY);
        const offsetX = (tileX - this.tileRange.minX) * this.tileSize;
        const offsetY = (tileY - this.tileRange.minY) * this.tileSize;

        jobs.push(
          loadImageBitmap(url).then((bitmap) => {
            context.drawImage(bitmap, offsetX, offsetY, this.tileSize, this.tileSize);
            if (bitmap instanceof ImageBitmap) {
              bitmap.close();
            }
          })
        );
      }
    }

    await Promise.all(jobs);

    const imageData = context.getImageData(
      0,
      0,
      this.metadata.width,
      this.metadata.height
    ).data;

    const elevations = new Float32Array(this.metadata.width * this.metadata.height);
    for (let index = 0, pixel = 0; index < elevations.length; index += 1, pixel += 4) {
      const elevation = decodeTerrainRgb(
        imageData[pixel],
        imageData[pixel + 1],
        imageData[pixel + 2]
      );
      elevations[index] = Number.isFinite(elevation) ? elevation : 0;
    }

    this.elevations = elevations;
  }

  isLoaded(): boolean {
    return this.elevations !== null;
  }

  buildFloodMask(waterLevel: number): Uint8Array {
    if (!this.elevations) {
      throw new Error("Terrain RGB model has not been loaded yet");
    }

    return buildConnectedFloodMaskFromElevations(
      this.elevations,
      this.metadata.width,
      this.metadata.height,
      waterLevel
    );
  }

  getElevation(lng: number, lat: number): number | null {
    if (!this.elevations) return null;

    const world = lngLatToWorldPixel(lng, lat, this.metadata.zoom, this.tileSize);
    const localX = Math.round(world.x - this.tileRange.minX * this.tileSize);
    const localY = Math.round(world.y - this.tileRange.minY * this.tileSize);

    if (
      localX < 0 ||
      localY < 0 ||
      localX >= this.metadata.width ||
      localY >= this.metadata.height
    ) {
      return null;
    }

    return this.elevations[localY * this.metadata.width + localX] ?? null;
  }
}
