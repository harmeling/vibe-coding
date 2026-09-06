import { intersectionPoints } from '../grid/gridEngine';
import type { DetectedQuad } from '../calibration/autoDetect';
import type { BoardSize, IntersectionState } from '../types';

/** Draws the clean digital board: grid lines, stones, and each stone's move number. */
export function renderDigitalBoard(
  canvas: HTMLCanvasElement,
  board: IntersectionState[],
  boardSize: BoardSize,
  moveNumbers: (number | null)[],
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;

  ctx.fillStyle = '#e6cfa7';
  ctx.fillRect(0, 0, width, height);

  const margin = Math.min(width, height) * 0.06;
  const points = intersectionPoints(boardSize, width, height, margin);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 1;
  for (let row = 0; row < boardSize; row++) {
    const rowStart = points[row * boardSize];
    const rowEnd = points[row * boardSize + boardSize - 1];
    ctx.beginPath();
    ctx.moveTo(rowStart.x, rowStart.y);
    ctx.lineTo(rowEnd.x, rowEnd.y);
    ctx.stroke();
  }
  for (let col = 0; col < boardSize; col++) {
    const colStart = points[col];
    const colEnd = points[(boardSize - 1) * boardSize + col];
    ctx.beginPath();
    ctx.moveTo(colStart.x, colStart.y);
    ctx.lineTo(colEnd.x, colEnd.y);
    ctx.stroke();
  }

  const spacing = boardSize > 1 ? points[1].x - points[0].x : Math.min(width, height);
  const stoneRadius = Math.max(spacing * 0.45, 4);

  board.forEach((state, i) => {
    if (state === 'empty') return;
    const p = points[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, stoneRadius, 0, Math.PI * 2);
    ctx.fillStyle = state === 'black' ? '#1a1a1a' : '#f5f5f0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.stroke();

    const number = moveNumbers[i];
    if (number != null) {
      ctx.fillStyle = state === 'black' ? '#f5f5f0' : '#1a1a1a';
      ctx.font = `${Math.round(stoneRadius)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), p.x, p.y);
    }
  });
}

/** Draws small numbered markers over the corners picked so far, during calibration. */
export function renderCalibrationOverlay(canvas: HTMLCanvasElement, points: readonly { x: number; y: number }[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.strokeStyle = '#00e5c0';
  ctx.fillStyle = '#00e5c0';
  ctx.lineWidth = 2;

  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '14px sans-serif';
    ctx.fillText(String(i + 1), p.x + 8, p.y - 8);
  });

  for (let i = 0; i < points.length - 1; i++) {
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[i + 1].x, points[i + 1].y);
    ctx.stroke();
  }
}

/** Draws the live auto-detected board quad as a dashed outline, so the user can see what "Auto calibrate" would accept. */
export function renderDashedQuad(canvas: HTMLCanvasElement, quad: DetectedQuad): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#ff5c8a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(quad.topLeft.x, quad.topLeft.y);
  ctx.lineTo(quad.topRight.x, quad.topRight.y);
  ctx.lineTo(quad.bottomRight.x, quad.bottomRight.y);
  ctx.lineTo(quad.bottomLeft.x, quad.bottomLeft.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
