import type { Matrix3x3, Point } from '../types';

type Quad = [Point, Point, Point, Point];

/** Gaussian elimination with partial pivoting. Mutates nothing; returns the solution vector. */
function solveLinearSystem(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivotRow][col])) pivotRow = r;
    }
    if (pivotRow !== col) [m[col], m[pivotRow]] = [m[pivotRow], m[col]];

    const pivotVal = m[col][col];
    if (Math.abs(pivotVal) < 1e-12) {
      throw new Error('Cannot compute homography: source points are degenerate (collinear or duplicated)');
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col] / pivotVal;
      for (let c = col; c <= n; c++) {
        m[r][c] -= factor * m[col][c];
      }
    }
  }

  return m.map((row, i) => row[n] / row[i]);
}

/**
 * Solves the 4-point homography (DLT) that maps each `src[i]` to `dst[i]`,
 * i.e. `applyHomography(result, src[i]) ≈ dst[i]`.
 */
export function computeHomography(src: Quad, dst: Quad): Matrix3x3 {
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: dx, y: dy } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -dx * x, -dx * y]);
    b.push(dx);
    a.push([0, 0, 0, x, y, 1, -dy * x, -dy * y]);
    b.push(dy);
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7] = solveLinearSystem(a, b);
  return [h0, h1, h2, h3, h4, h5, h6, h7, 1];
}

/** Applies a homogeneous 3x3 transform to a point, dividing through by the homogeneous coordinate. */
export function applyHomography(m: Matrix3x3, p: Point): Point {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  return {
    x: (m[0] * p.x + m[1] * p.y + m[2]) / w,
    y: (m[3] * p.x + m[4] * p.y + m[5]) / w,
  };
}

/** Inverts a 3x3 matrix via the adjugate/determinant formula. Throws if singular. */
export function invertMatrix3x3(m: Matrix3x3): Matrix3x3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) {
    throw new Error('Cannot invert a singular matrix');
  }
  const invDet = 1 / det;
  return [
    (e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet,
    (f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet,
    (d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet,
  ];
}
