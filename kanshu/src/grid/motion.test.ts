import { describe, expect, it } from 'vitest';
import { frameDifference, isMotionDetected } from './motion';
import type { PixelBuffer } from '../types';

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

describe('frameDifference', () => {
  it('is zero for identical frames', () => {
    const a = solidBuffer(20, 100);
    const b = solidBuffer(20, 100);
    expect(frameDifference(a, b)).toBe(0);
  });

  it('reflects the actual luminance gap between two uniform frames', () => {
    const a = solidBuffer(20, 50);
    const b = solidBuffer(20, 200);
    expect(frameDifference(a, b)).toBeCloseTo(150, 5);
  });

  it('throws when comparing frames of different dimensions', () => {
    expect(() => frameDifference(solidBuffer(10, 50), solidBuffer(20, 50))).toThrow();
  });
});

describe('isMotionDetected', () => {
  it('is false when frames are identical', () => {
    const a = solidBuffer(20, 100);
    const b = solidBuffer(20, 100);
    expect(isMotionDetected(a, b, 10)).toBe(false);
  });

  it('is true when the difference exceeds the threshold (simulated hand passing over)', () => {
    const before = solidBuffer(20, 100);
    const during = solidBuffer(20, 20); // e.g. a dark hand covering the board
    expect(isMotionDetected(before, during, 10)).toBe(true);
  });

  it('is false when the difference is within the threshold (minor lighting flicker)', () => {
    const before = solidBuffer(20, 100);
    const after = solidBuffer(20, 104);
    expect(isMotionDetected(before, after, 10)).toBe(false);
  });
});
