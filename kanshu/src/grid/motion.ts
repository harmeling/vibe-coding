import type { PixelBuffer } from '../types';

/**
 * Average per-sampled-pixel luminance difference between two same-sized frames. `stride`
 * samples every Nth pixel in both axes, trading precision for speed on large buffers.
 */
export function frameDifference(a: PixelBuffer, b: PixelBuffer, stride = 4): number {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error('frameDifference: buffers must have the same dimensions');
  }

  let total = 0;
  let count = 0;
  for (let y = 0; y < a.height; y += stride) {
    for (let x = 0; x < a.width; x += stride) {
      const idx = (y * a.width + x) * 4;
      const grayA = 0.299 * a.data[idx] + 0.587 * a.data[idx + 1] + 0.114 * a.data[idx + 2];
      const grayB = 0.299 * b.data[idx] + 0.587 * b.data[idx + 1] + 0.114 * b.data[idx + 2];
      total += Math.abs(grayA - grayB);
      count++;
    }
  }

  return count === 0 ? 0 : total / count;
}

/**
 * Whether something (a hand, most likely) is currently moving across the board between two
 * consecutive snapshots — used to skip a classification pass on a blurry/occluded frame rather
 * than risk a bad reading, complementing the two-snapshot confirmation debounce in
 * `gridEngine.ts` (which only catches a hand that's gone again by the *next* snapshot).
 * `threshold` is a starting value only — real cameras/lighting need real-world tuning
 * (PLAN.md Step 10).
 */
export function isMotionDetected(a: PixelBuffer, b: PixelBuffer, threshold: number, stride = 4): boolean {
  return frameDifference(a, b, stride) > threshold;
}
