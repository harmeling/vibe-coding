export interface Point {
  x: number;
  y: number;
}

/** Row-major 3x3 homogeneous transform matrix, flattened to 9 numbers. */
export type Matrix3x3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

export type StoneColor = 'black' | 'white';
export type IntersectionState = StoneColor | 'empty';

export type BoardSize = 9 | 13 | 19;

/**
 * Canvas-API-independent stand-in for ImageData (same field layout) so
 * pixel-sampling logic can be unit-tested with synthetic buffers, without a
 * browser or a real camera.
 */
export interface PixelBuffer {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8ClampedArray;
}
