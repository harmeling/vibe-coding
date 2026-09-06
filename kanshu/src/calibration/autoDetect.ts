import type { Point, PixelBuffer } from '../types';

export interface DetectionConfig {
  /** Minimum Sobel gradient magnitude to count a pixel as an edge. */
  gradientThreshold: number;
  /** Scan stride in both axes — trades detection density for speed on large frames. */
  downsample: number;
  /** Minimum edge pixels seen before trusting a detection at all (rejects blank/uniform frames). */
  minEdgePixels: number;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  gradientThreshold: 40,
  downsample: 3,
  minEdgePixels: 50,
};

export interface DetectedQuad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

function toGrayscale(buffer: PixelBuffer): Float32Array {
  const gray = new Float32Array(buffer.width * buffer.height);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * buffer.data[idx] + 0.587 * buffer.data[idx + 1] + 0.114 * buffer.data[idx + 2];
  }
  return gray;
}

function sobelMagnitude(gray: Float32Array, width: number, x: number, y: number): number {
  const at = (dx: number, dy: number) => gray[(y + dy) * width + (x + dx)];
  const gx = -at(-1, -1) - 2 * at(-1, 0) - at(-1, 1) + at(1, -1) + 2 * at(1, 0) + at(1, 1);
  const gy = -at(-1, -1) - 2 * at(0, -1) - at(1, -1) + at(-1, 1) + 2 * at(0, 1) + at(1, 1);
  return Math.sqrt(gx * gx + gy * gy);
}

/**
 * Best-effort automatic board-corner detection: builds a Sobel edge map, then picks the 4
 * "extreme" edge points (min/max of x+y and y-x) as the board's corners — the same trick
 * `orderCorners` uses to sort clicked points, just applied to every edge pixel instead of 4
 * known ones. This assumes the board is the dominant high-contrast, roughly-centered
 * quadrilateral in frame; it is NOT a proper contour/Hough-based detector, and it will need
 * real-camera tuning (thresholds, region-of-interest, lighting) — that's PLAN.md Step 10.
 * Returns null when too few edge pixels are found to trust any detection.
 */
export function detectBoardQuad(buffer: PixelBuffer, config: DetectionConfig = DEFAULT_DETECTION_CONFIG): DetectedQuad | null {
  const gray = toGrayscale(buffer);
  const { width, height } = buffer;

  let edgeCount = 0;
  let topLeft: Point | null = null;
  let topLeftScore = Infinity;
  let bottomRight: Point | null = null;
  let bottomRightScore = -Infinity;
  let topRight: Point | null = null;
  let topRightScore = Infinity;
  let bottomLeft: Point | null = null;
  let bottomLeftScore = -Infinity;

  for (let y = 1; y < height - 1; y += config.downsample) {
    for (let x = 1; x < width - 1; x += config.downsample) {
      if (sobelMagnitude(gray, width, x, y) < config.gradientThreshold) continue;
      edgeCount++;

      const sum = x + y;
      const diff = y - x;
      if (sum < topLeftScore) {
        topLeftScore = sum;
        topLeft = { x, y };
      }
      if (sum > bottomRightScore) {
        bottomRightScore = sum;
        bottomRight = { x, y };
      }
      if (diff < topRightScore) {
        topRightScore = diff;
        topRight = { x, y };
      }
      if (diff > bottomLeftScore) {
        bottomLeftScore = diff;
        bottomLeft = { x, y };
      }
    }
  }

  if (edgeCount < config.minEdgePixels || !topLeft || !topRight || !bottomRight || !bottomLeft) return null;
  return { topLeft, topRight, bottomRight, bottomLeft };
}
