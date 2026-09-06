import { applyHomography } from './homography';
import type { Matrix3x3, PixelBuffer } from '../types';

/**
 * Produces a `outWidth` x `outHeight` top-down buffer from `source`, by mapping each output
 * pixel through `inverseMatrix` (dst → src) and nearest-neighbor sampling. Using the
 * dst-to-src inverse (rather than warping src pixels forward) avoids gaps in the output.
 * Output pixels that land outside the source frame are fully transparent.
 */
export function warpFrame(source: PixelBuffer, inverseMatrix: Matrix3x3, outWidth: number, outHeight: number): PixelBuffer {
  const data = new Uint8ClampedArray(outWidth * outHeight * 4);

  for (let oy = 0; oy < outHeight; oy++) {
    for (let ox = 0; ox < outWidth; ox++) {
      const outIdx = (oy * outWidth + ox) * 4;
      const src = applyHomography(inverseMatrix, { x: ox, y: oy });
      const sx = Math.round(src.x);
      const sy = Math.round(src.y);

      if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) {
        continue; // leaves this pixel fully transparent (data is zero-initialized)
      }

      const inIdx = (sy * source.width + sx) * 4;
      data[outIdx] = source.data[inIdx];
      data[outIdx + 1] = source.data[inIdx + 1];
      data[outIdx + 2] = source.data[inIdx + 2];
      data[outIdx + 3] = 255;
    }
  }

  return { width: outWidth, height: outHeight, data };
}
