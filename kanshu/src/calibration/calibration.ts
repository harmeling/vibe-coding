import { computeHomography } from './homography';
import { orderCorners } from './orderCorners';
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
 * Collects 4 pointerdown clicks on `canvas`, in any order — `orderCorners` sorts them into
 * top-left/top-right/bottom-right/bottom-left before computing the homography — and turns them
 * into a homography + persists it. `completeWith` is also called directly (bypassing clicks
 * entirely) when the user accepts an auto-detected quad instead.
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
    if (this.points.length === 4) this.completeWith(this.points as [Point, Point, Point, Point]);
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

  /** Computes and persists the calibration from any 4 corner points, in any order. */
  completeWith(points: readonly [Point, Point, Point, Point]): void {
    const [topLeft, topRight, bottomRight, bottomLeft] = orderCorners(points);
    const size = this.config.targetSize;
    const dst: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: size - 1, y: 0 },
      { x: size - 1, y: size - 1 },
      { x: 0, y: size - 1 },
    ];
    const src: [Point, Point, Point, Point] = [topLeft, topRight, bottomRight, bottomLeft];
    const matrix = computeHomography(src, dst);
    const data: CalibrationData = { matrix, boardSize: this.config.boardSize, points: src };
    saveCalibration(data);
    this.config.onComplete(data);
  }
}
