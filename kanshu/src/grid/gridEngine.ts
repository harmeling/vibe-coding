import type { IntersectionState, PixelBuffer, Point } from '../types';

/** Evenly spaced intersection coordinates for an N x N board, inset from the buffer edges by `margin` px. */
export function intersectionPoints(boardSize: number, width: number, height: number, margin: number): Point[] {
  const points: Point[] = [];
  const usableWidth = width - 2 * margin;
  const usableHeight = height - 2 * margin;
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      points.push({
        x: margin + (usableWidth * col) / (boardSize - 1),
        y: margin + (usableHeight * row) / (boardSize - 1),
      });
    }
  }
  return points;
}

/** Average grayscale luminance (Rec. 601) over a square patch centered at `point`, clamped to the buffer bounds. */
export function sampleLuminance(buffer: PixelBuffer, point: Point, patchRadius: number): number {
  const cx = Math.round(point.x);
  const cy = Math.round(point.y);
  let total = 0;
  let count = 0;

  for (let dy = -patchRadius; dy <= patchRadius; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= buffer.height) continue;
    for (let dx = -patchRadius; dx <= patchRadius; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= buffer.width) continue;
      const idx = (y * buffer.width + x) * 4;
      const r = buffer.data[idx];
      const g = buffer.data[idx + 1];
      const b = buffer.data[idx + 2];
      total += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
  }

  if (count === 0) {
    throw new Error(`sampleLuminance: patch at (${point.x}, ${point.y}) is entirely out of bounds`);
  }
  return total / count;
}

export interface ClassifyThresholds {
  /** Luminance above this is classified as a white stone, regardless of baseline. */
  high: number;
  /** Luminance below this is classified as a black stone, regardless of baseline. */
  low: number;
  /** Max deviation from the per-point baseline still considered "empty". */
  alpha: number;
}

/** Classifies a single luminance reading against its point's empty-board baseline. */
export function classifyLuminance(luminance: number, baseline: number, thresholds: ClassifyThresholds): IntersectionState {
  if (luminance > thresholds.high) return 'white';
  if (luminance < thresholds.low) return 'black';
  if (Math.abs(luminance - baseline) <= thresholds.alpha) return 'empty';
  // Ambiguous (between the black/white thresholds but outside the baseline band): default to
  // empty rather than guessing a stone color, since a false placement is more disruptive than a
  // missed one (it'll be caught on the next confirmed reading if it's real).
  return 'empty';
}

/** Samples and classifies every intersection in one pass. */
export function classifyBuffer(
  buffer: PixelBuffer,
  points: Point[],
  baselines: number[],
  patchRadius: number,
  thresholds: ClassifyThresholds,
): IntersectionState[] {
  return points.map((point, i) => classifyLuminance(sampleLuminance(buffer, point, patchRadius), baselines[i], thresholds));
}

export interface GridEngineState {
  /** Last confirmed state per intersection — the authoritative visual reading. */
  confirmed: IntersectionState[];
  /** A differing reading seen exactly once so far, awaiting a second consecutive snapshot to confirm. */
  pending: (IntersectionState | null)[];
}

export function createInitialState(size: number, initial: IntersectionState = 'empty'): GridEngineState {
  return {
    confirmed: new Array(size).fill(initial),
    pending: new Array(size).fill(null),
  };
}

export interface AdvanceResult {
  state: GridEngineState;
  /** Indices whose confirmed state changed on this snapshot. */
  changedIndices: number[];
}

/**
 * Feeds one raw (unconfirmed) classification snapshot through the two-snapshot debounce: a
 * reading that differs from the confirmed state is only adopted once it's observed on two
 * consecutive snapshots, so a hand transiently occluding an intersection doesn't register as a
 * move. A reading that reverts back to the confirmed state before being confirmed simply clears
 * the pending flag.
 */
export function advance(state: GridEngineState, raw: IntersectionState[]): AdvanceResult {
  const confirmed = [...state.confirmed];
  const pending = [...state.pending];
  const changedIndices: number[] = [];

  for (let i = 0; i < raw.length; i++) {
    const reading = raw[i];
    if (reading === confirmed[i]) {
      pending[i] = null;
      continue;
    }
    if (pending[i] === reading) {
      confirmed[i] = reading;
      pending[i] = null;
      changedIndices.push(i);
    } else {
      pending[i] = reading;
    }
  }

  return { state: { confirmed, pending }, changedIndices };
}
