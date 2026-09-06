import type { Point } from '../types';

function argExtreme(values: number[], isBetter: (candidate: number, current: number) => boolean): number {
  let bestIndex = 0;
  for (let i = 1; i < values.length; i++) {
    if (isBetter(values[i], values[bestIndex])) bestIndex = i;
  }
  return bestIndex;
}

/**
 * Reorders 4 arbitrarily-ordered points into [topLeft, topRight, bottomRight, bottomLeft], so
 * calibration corner clicks (or an auto-detected quad) don't need to follow a specific click
 * order. Same sum/diff trick as the legacy `calibrate.py`'s `order_points`.
 */
export function orderCorners(points: readonly Point[]): [Point, Point, Point, Point] {
  const sums = points.map((p) => p.x + p.y);
  const diffs = points.map((p) => p.y - p.x);
  return [
    points[argExtreme(sums, (a, b) => a < b)], // top-left: smallest x+y
    points[argExtreme(diffs, (a, b) => a < b)], // top-right: smallest y-x (large x, small y)
    points[argExtreme(sums, (a, b) => a > b)], // bottom-right: largest x+y
    points[argExtreme(diffs, (a, b) => a > b)], // bottom-left: largest y-x (small x, large y)
  ];
}
