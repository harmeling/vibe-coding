import { describe, expect, it } from 'vitest';
import { applyHomography, computeHomography, invertMatrix3x3 } from './homography';
import type { Matrix3x3, Point } from '../types';

function expectPointClose(actual: Point, expected: Point, digits = 6): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
}

describe('computeHomography / applyHomography', () => {
  it('maps a square to itself as the identity', () => {
    const square: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const matrix = computeHomography(square, square);
    for (const p of square) {
      expectPointClose(applyHomography(matrix, p), p);
    }
    expectPointClose(applyHomography(matrix, { x: 0.5, y: 0.5 }), { x: 0.5, y: 0.5 });
  });

  it('maps a skewed quad (simulated side-angle photo of a board) to a top-down square', () => {
    // A trapezoid: the "far" edge of the board looks narrower and higher in the photo.
    const src: [Point, Point, Point, Point] = [
      { x: 120, y: 40 }, // top-left
      { x: 360, y: 60 }, // top-right
      { x: 400, y: 300 }, // bottom-right
      { x: 60, y: 280 }, // bottom-left
    ];
    const boardSize = 800;
    const dst: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: boardSize, y: 0 },
      { x: boardSize, y: boardSize },
      { x: 0, y: boardSize },
    ];

    const matrix = computeHomography(src, dst);
    for (let i = 0; i < 4; i++) {
      expectPointClose(applyHomography(matrix, src[i]), dst[i], 3);
    }
  });

  it('throws on degenerate (collinear) source points', () => {
    const collinear: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    const dst: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(() => computeHomography(collinear, dst)).toThrow();
  });
});

describe('invertMatrix3x3', () => {
  it('composes with the original to the identity transform', () => {
    const src: [Point, Point, Point, Point] = [
      { x: 120, y: 40 },
      { x: 360, y: 60 },
      { x: 400, y: 300 },
      { x: 60, y: 280 },
    ];
    const dst: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 800, y: 0 },
      { x: 800, y: 800 },
      { x: 0, y: 800 },
    ];

    const forward = computeHomography(src, dst);
    const inverse = invertMatrix3x3(forward);

    // Round-trip: forward then inverse should recover every source corner...
    for (let i = 0; i < 4; i++) {
      const warped = applyHomography(forward, src[i]);
      const restored = applyHomography(inverse, warped);
      expectPointClose(restored, src[i], 3);
    }

    // ...and an interior point too, not just the calibration corners themselves.
    const interior = { x: 200, y: 150 };
    const restoredInterior = applyHomography(inverse, applyHomography(forward, interior));
    expectPointClose(restoredInterior, interior, 3);
  });

  it('throws on a singular matrix', () => {
    const singular: Matrix3x3 = [
      1, 2, 3,
      2, 4, 6,
      1, 1, 1,
    ];
    expect(() => invertMatrix3x3(singular)).toThrow();
  });
});
