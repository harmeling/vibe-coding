import { computeHomography } from './homography';
import { saveCalibration } from '../storage';
import type { CalibrationData } from '../storage';
import type { BoardSize, Point } from '../types';

export interface CalibrationConfig {
  boardSize: BoardSize;
  /** Side length, in pixels, of the square warped/analysis output this calibration targets. */
  targetSize: number;
  onComplete: (data: CalibrationData) => void;
}

/**
 * Collects 4 pointerdown clicks on `canvas` — click order matters: top-left, top-right,
 * bottom-right, bottom-left (same convention as the legacy `calibrate.py` prototype) — and
 * turns them into a homography + persists it. Corner-order auto-detection (like the old
 * prototype's `order_points`) was left out for this first pass; if strict click ordering turns
 * out to be error-prone with a real camera, add it then (postponed, needs real-board testing).
 */
export class CalibrationController {
  private points: Point[] = [];

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.points.length >= 4) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.points.push({
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    });
    if (this.points.length === 4) this.finish();
  };

  constructor(private readonly canvas: HTMLCanvasElement, private readonly config: CalibrationConfig) {
    canvas.addEventListener('pointerdown', this.handlePointerDown);
  }

  get pendingPoints(): readonly Point[] {
    return this.points;
  }

  get isComplete(): boolean {
    return this.points.length === 4;
  }

  reset(): void {
    this.points = [];
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
  }

  private finish(): void {
    const src = this.points as [Point, Point, Point, Point];
    const size = this.config.targetSize;
    const dst: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: size - 1, y: 0 },
      { x: size - 1, y: size - 1 },
      { x: 0, y: size - 1 },
    ];
    const matrix = computeHomography(src, dst);
    const data: CalibrationData = { matrix, boardSize: this.config.boardSize, points: src };
    saveCalibration(data);
    this.config.onComplete(data);
  }
}
