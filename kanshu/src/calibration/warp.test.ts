import { describe, expect, it } from 'vitest';
import { computeHomography, invertMatrix3x3 } from './homography';
import { warpFrame } from './warp';
import type { PixelBuffer, Point } from '../types';

function makeCheckerboard(size: number): PixelBuffer {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const isLeftHalf = x < size / 2;
      const gray = isLeftHalf ? 20 : 220;
      data[idx] = gray;
      data[idx + 1] = gray;
      data[idx + 2] = gray;
      data[idx + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

function pixelAt(buffer: PixelBuffer, x: number, y: number): [number, number, number, number] {
  const idx = (y * buffer.width + x) * 4;
  return [buffer.data[idx], buffer.data[idx + 1], buffer.data[idx + 2], buffer.data[idx + 3]];
}

describe('warpFrame', () => {
  it('reproduces the source unchanged under an identity mapping', () => {
    const source = makeCheckerboard(8);
    const identity: [number, number, number, number, number, number, number, number, number] = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];
    const warped = warpFrame(source, identity, 8, 8);
    expect(Array.from(warped.data)).toEqual(Array.from(source.data));
  });

  it('marks out-of-bounds output pixels as transparent', () => {
    const source = makeCheckerboard(4);
    const identity: [number, number, number, number, number, number, number, number, number] = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];
    // Requesting a larger output than the source means the extra area has no source pixel.
    const warped = warpFrame(source, identity, 8, 8);
    expect(pixelAt(warped, 6, 6)[3]).toBe(0);
  });

  it('un-skews a perspective-distorted quad back into an axis-aligned board', () => {
    const size = 40;
    const source = makeCheckerboard(size);

    // Pretend `source` is itself the side-angle camera frame, and these four points are where
    // the board's corners appear in it (a trapezoid, narrower/higher on the "far" edge).
    const src: [Point, Point, Point, Point] = [
      { x: 6, y: 4 },
      { x: 34, y: 6 },
      { x: 36, y: 36 },
      { x: 4, y: 32 },
    ];
    const outSize = 20;
    const dst: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: outSize - 1, y: 0 },
      { x: outSize - 1, y: outSize - 1 },
      { x: 0, y: outSize - 1 },
    ];

    const forward = computeHomography(src, dst);
    const inverse = invertMatrix3x3(forward);
    const warped = warpFrame(source, inverse, outSize, outSize);

    // The warped board's corners should sample back close to the original quad's corners, i.e.
    // roughly reproduce the left/right halves of the checkerboard as a clean vertical split.
    const [topLeftGray] = pixelAt(warped, 1, 1);
    const [topRightGray] = pixelAt(warped, outSize - 2, 1);
    expect(topLeftGray).toBeLessThan(100); // left half of the checkerboard is dark
    expect(topRightGray).toBeGreaterThan(150); // right half is light
  });
});
