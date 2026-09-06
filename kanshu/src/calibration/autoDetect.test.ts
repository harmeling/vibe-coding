import { describe, expect, it } from 'vitest';
import { DEFAULT_DETECTION_CONFIG, detectBoardQuad } from './autoDetect';
import type { PixelBuffer } from '../types';

// Full-density scan for these small synthetic images — avoids stride/edge-band alignment
// artifacts that only matter for performance on real, much larger camera frames.
const DENSE_CONFIG = { ...DEFAULT_DETECTION_CONFIG, downsample: 1 };

function solidBuffer(size: number, gray: number): PixelBuffer {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = gray;
    data[i * 4 + 1] = gray;
    data[i * 4 + 2] = gray;
    data[i * 4 + 3] = 255;
  }
  return { width: size, height: size, data };
}

function setPixel(buffer: PixelBuffer, x: number, y: number, gray: number): void {
  const idx = (y * buffer.width + x) * 4;
  buffer.data[idx] = gray;
  buffer.data[idx + 1] = gray;
  buffer.data[idx + 2] = gray;
  buffer.data[idx + 3] = 255;
}

/** Fills an axis-aligned rectangle [x0,x1] x [y0,y1] (inclusive) at the given gray value. */
function fillRect(buffer: PixelBuffer, x0: number, y0: number, x1: number, y1: number, gray: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setPixel(buffer, x, y, gray);
    }
  }
}

/** Fills a trapezoid with horizontal top/bottom edges and slanted left/right edges. */
function fillTrapezoid(
  buffer: PixelBuffer,
  topLeftX: number,
  topRightX: number,
  bottomLeftX: number,
  bottomRightX: number,
  y0: number,
  y1: number,
  gray: number,
): void {
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / (y1 - y0);
    const leftX = Math.round(topLeftX + (bottomLeftX - topLeftX) * t);
    const rightX = Math.round(topRightX + (bottomRightX - topRightX) * t);
    for (let x = leftX; x <= rightX; x++) {
      setPixel(buffer, x, y, gray);
    }
  }
}

describe('detectBoardQuad', () => {
  it('finds the corners of a bright axis-aligned rectangle on a dark background', () => {
    const buffer = solidBuffer(100, 20);
    fillRect(buffer, 20, 15, 80, 70, 220);

    const quad = detectBoardQuad(buffer, DENSE_CONFIG);
    expect(quad).not.toBeNull();
    const withinTolerance = (actual: number, expected: number) => Math.abs(actual - expected) <= 3;

    expect(withinTolerance(quad!.topLeft.x, 20)).toBe(true);
    expect(withinTolerance(quad!.topLeft.y, 15)).toBe(true);
    expect(withinTolerance(quad!.topRight.x, 80)).toBe(true);
    expect(withinTolerance(quad!.topRight.y, 15)).toBe(true);
    expect(withinTolerance(quad!.bottomRight.x, 80)).toBe(true);
    expect(withinTolerance(quad!.bottomRight.y, 70)).toBe(true);
    expect(withinTolerance(quad!.bottomLeft.x, 20)).toBe(true);
    expect(withinTolerance(quad!.bottomLeft.y, 70)).toBe(true);
  });

  it('finds the corners of a perspective-skewed trapezoid (simulated side-angle board)', () => {
    const buffer = solidBuffer(120, 15);
    // Narrower "far" (top) edge than the "near" (bottom) edge, like a photographed board.
    fillTrapezoid(buffer, 40, 80, 15, 105, 20, 100, 210);

    const quad = detectBoardQuad(buffer, DENSE_CONFIG);
    expect(quad).not.toBeNull();
    const withinTolerance = (actual: number, expected: number) => Math.abs(actual - expected) <= 4;

    expect(withinTolerance(quad!.topLeft.x, 40)).toBe(true);
    expect(withinTolerance(quad!.topLeft.y, 20)).toBe(true);
    expect(withinTolerance(quad!.topRight.x, 80)).toBe(true);
    expect(withinTolerance(quad!.topRight.y, 20)).toBe(true);
    expect(withinTolerance(quad!.bottomLeft.x, 15)).toBe(true);
    expect(withinTolerance(quad!.bottomLeft.y, 100)).toBe(true);
    expect(withinTolerance(quad!.bottomRight.x, 105)).toBe(true);
    expect(withinTolerance(quad!.bottomRight.y, 100)).toBe(true);
  });

  it('returns null for a blank, uniform-color frame', () => {
    expect(detectBoardQuad(solidBuffer(50, 128))).toBeNull();
  });
});
