import { startCamera } from './camera';
import { captureVideoFrame, drawPixelBuffer } from './frame';
import { CalibrationController } from './calibration/calibration';
import { invertMatrix3x3 } from './calibration/homography';
import { warpFrame } from './calibration/warp';
import { advance, classifyBuffer, createInitialState, intersectionPoints, sampleLuminance } from './grid/gridEngine';
import type { GridEngineState } from './grid/gridEngine';
import { createEmptyBoard, diffBoard } from './game/boardState';
import type { BoardDiffResult } from './game/boardState';
import { buildSgf } from './game/sgf';
import { formatBoardCoordinate } from './game/coords';
import {
  clearCalibration,
  clearSgfText,
  loadCalibration,
  loadSettings,
  saveSettings,
  saveSgfText,
  loadSgfText,
} from './storage';
import type { CalibrationData } from './storage';
import { renderCalibrationOverlay, renderDigitalBoard } from './ui/render';
import { updateHud } from './ui/hud';
import { playClick } from './ui/sound';
import { buildMoveAnnouncement, speak } from './ui/speech';
import type { BoardSize, Matrix3x3, StoneColor } from './types';

/** Side length, in pixels, of the square top-down buffer calibration warps into. */
const ANALYSIS_SIZE = 480;
const PATCH_RADIUS = 4;
const GRID_MARGIN = ANALYSIS_SIZE * 0.08;
/**
 * Starting thresholds only — real values depend on lighting and camera, and tuning them
 * against an actual board is exactly the postponed Step 10 in PLAN.md.
 */
const DEFAULT_THRESHOLDS = { high: 175, low: 70, alpha: 22 };

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

function isBoardSize(n: number): n is BoardSize {
  return n === 9 || n === 13 || n === 19;
}

function initApp(): void {
  const video = byId<HTMLVideoElement>('video');
  const liveCanvas = byId<HTMLCanvasElement>('liveCanvas');
  const boardCanvas = byId<HTMLCanvasElement>('boardCanvas');
  const statusEl = byId<HTMLParagraphElement>('status');
  const startBtn = byId<HTMLButtonElement>('startBtn');
  const recalibrateBtn = byId<HTMLButtonElement>('recalibrateBtn');
  const resetBtn = byId<HTMLButtonElement>('resetBtn');
  const downloadBtn = byId<HTMLAnchorElement>('downloadBtn');
  const boardSizeSelect = byId<HTMLSelectElement>('boardSizeSelect');
  const intervalInput = byId<HTMLInputElement>('snapshotInterval');
  const facingSelect = byId<HTMLSelectElement>('facingMode');
  const voiceToggle = byId<HTMLInputElement>('voiceToggle');
  const soundToggle = byId<HTMLInputElement>('soundToggle');
  const hudTurn = byId<HTMLElement>('hudTurn');
  const hudLastMove = byId<HTMLElement>('hudLastMove');
  const hudCaptures = byId<HTMLElement>('hudCaptures');

  let settings = loadSettings();
  boardSizeSelect.value = String(settings.boardSize);
  intervalInput.value = String(Math.round(settings.snapshotIntervalMs / 1000));
  facingSelect.value = settings.cameraFacingMode;
  voiceToggle.checked = settings.voiceAnnouncements;
  soundToggle.checked = settings.clickSound;

  let boardSize: BoardSize = settings.boardSize;
  let stream: MediaStream | null = null;
  let inverseMatrix: Matrix3x3 | null = null;
  let calibrationController: CalibrationController | null = null;
  let analysisTimer: ReturnType<typeof setInterval> | null = null;
  let previewRafHandle: number | null = null;
  let downloadUrl: string | null = null;

  let gridSize = boardSize * boardSize;
  let gridState: GridEngineState = createInitialState(gridSize);
  let baselines: number[] | null = null;
  let internalBoard = createEmptyBoard(gridSize);
  let moveNumbers: (number | null)[] = new Array(gridSize).fill(null);
  const turns: BoardDiffResult[] = [];
  let moveCounter = 0;
  let nextColor: StoneColor = 'black';
  let blackCaptures = 0;
  let whiteCaptures = 0;
  let sgfText = loadSgfText() ?? '';
  let lastMoveDescription: string | null = null;

  function persistSettings(): void {
    settings = {
      snapshotIntervalMs: Math.max(2, Number(intervalInput.value) || 10) * 1000,
      boardSize,
      voiceAnnouncements: voiceToggle.checked,
      clickSound: soundToggle.checked,
      cameraFacingMode: facingSelect.value === 'user' ? 'user' : 'environment',
    };
    saveSettings(settings);
  }

  function refreshHud(): void {
    updateHud(
      { turn: hudTurn, lastMove: hudLastMove, captures: hudCaptures },
      { turn: nextColor, lastMoveDescription, blackCaptures, whiteCaptures },
    );
  }

  function updateDownloadLink(): void {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const blob = new Blob([sgfText || '(;)'], { type: 'application/x-go-sgf' });
    downloadUrl = URL.createObjectURL(blob);
    downloadBtn.href = downloadUrl;
  }

  function applyBoardSize(newSize: BoardSize): void {
    boardSize = newSize;
    gridSize = boardSize * boardSize;
    gridState = createInitialState(gridSize);
    baselines = null;
    internalBoard = createEmptyBoard(gridSize);
    moveNumbers = new Array(gridSize).fill(null);
    turns.length = 0;
    moveCounter = 0;
    nextColor = 'black';
    blackCaptures = 0;
    whiteCaptures = 0;
    lastMoveDescription = null;
    sgfText = '';
    saveSgfText(sgfText);
    updateDownloadLink();
    refreshHud();
    renderDigitalBoard(boardCanvas, internalBoard, boardSize, moveNumbers);
  }

  function drawPreviewFrame(): void {
    if (stream) {
      try {
        const raw = captureVideoFrame(video);
        if (inverseMatrix) {
          drawPixelBuffer(liveCanvas, warpFrame(raw, inverseMatrix, ANALYSIS_SIZE, ANALYSIS_SIZE));
        } else {
          drawPixelBuffer(liveCanvas, raw);
          if (calibrationController) renderCalibrationOverlay(liveCanvas, calibrationController.pendingPoints);
        }
      } catch {
        // Video metadata not ready yet this tick; try again next frame.
      }
    }
    previewRafHandle = requestAnimationFrame(drawPreviewFrame);
  }

  function runAnalysisTick(): void {
    if (!stream || !inverseMatrix) return;

    let raw;
    try {
      raw = captureVideoFrame(video);
    } catch {
      return;
    }

    const warped = warpFrame(raw, inverseMatrix, ANALYSIS_SIZE, ANALYSIS_SIZE);
    const points = intersectionPoints(boardSize, ANALYSIS_SIZE, ANALYSIS_SIZE, GRID_MARGIN);

    if (!baselines) {
      // First tick after (re)calibrating: assume the board is empty right now and capture this
      // as the empty-board baseline. A dedicated "capture baseline on demand" control is a
      // real-board-testing follow-up (Step 10) if this assumption proves too fragile.
      baselines = points.map((p) => sampleLuminance(warped, p, PATCH_RADIUS));
      statusEl.textContent = 'Baseline captured — watching the board…';
      return;
    }

    const classified = classifyBuffer(warped, points, baselines, PATCH_RADIUS, DEFAULT_THRESHOLDS);
    const result = advance(gridState, classified);
    gridState = result.state;
    if (result.changedIndices.length === 0) return;

    const visualBoard = gridState.confirmed;
    const diff = diffBoard(internalBoard, visualBoard);
    if (diff.placements.length === 0 && diff.removals.length === 0) return;

    internalBoard = [...visualBoard];
    turns.push(diff);

    for (const removal of diff.removals) {
      moveNumbers[removal.index] = null;
      if (removal.color === 'black') blackCaptures++;
      else whiteCaptures++;
    }

    for (const placement of diff.placements) {
      moveCounter++;
      moveNumbers[placement.index] = moveCounter;
      lastMoveDescription = `${placement.color === 'black' ? 'Black' : 'White'} played ${formatBoardCoordinate(placement.index, boardSize)}`;
      speak(buildMoveAnnouncement(placement.color, placement.index, boardSize, diff.removals.length), settings.voiceAnnouncements);
      nextColor = placement.color === 'black' ? 'white' : 'black';
    }

    sgfText = buildSgf(turns, boardSize);
    saveSgfText(sgfText);
    updateDownloadLink();
    playClick(settings.clickSound);
    renderDigitalBoard(boardCanvas, internalBoard, boardSize, moveNumbers);
    refreshHud();
  }

  function startPipeline(data: CalibrationData): void {
    inverseMatrix = invertMatrix3x3(data.matrix);
    baselines = null;
    calibrationController?.dispose();
    calibrationController = null;
    recalibrateBtn.disabled = false;
    statusEl.textContent = 'Watching the board…';
    if (analysisTimer) clearInterval(analysisTimer);
    analysisTimer = setInterval(runAnalysisTick, settings.snapshotIntervalMs);
  }

  function startCalibrationFlow(): void {
    inverseMatrix = null;
    if (analysisTimer) {
      clearInterval(analysisTimer);
      analysisTimer = null;
    }
    statusEl.textContent = 'Click the board’s 4 corners, in order: top-left, top-right, bottom-right, bottom-left.';
    calibrationController?.dispose();
    calibrationController = new CalibrationController(liveCanvas, {
      boardSize,
      targetSize: ANALYSIS_SIZE,
      onComplete: startPipeline,
    });
  }

  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    persistSettings();
    startCamera(video, { facingMode: settings.cameraFacingMode })
      .then((mediaStream) => {
        stream = mediaStream;
        if (previewRafHandle === null) previewRafHandle = requestAnimationFrame(drawPreviewFrame);
        const stored = loadCalibration();
        if (stored) startPipeline(stored);
        else startCalibrationFlow();
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        statusEl.textContent = `Could not start the camera: ${message}`;
        startBtn.disabled = false;
      });
  });

  recalibrateBtn.addEventListener('click', () => {
    clearCalibration();
    startCalibrationFlow();
  });

  resetBtn.addEventListener('click', () => {
    clearCalibration();
    clearSgfText();
    applyBoardSize(boardSize);
    if (stream) startCalibrationFlow();
    else statusEl.textContent = 'Click "Start camera" to begin.';
  });

  boardSizeSelect.addEventListener('change', () => {
    const parsed = Number(boardSizeSelect.value);
    if (isBoardSize(parsed)) {
      applyBoardSize(parsed);
      persistSettings();
    }
  });

  intervalInput.addEventListener('change', () => {
    persistSettings();
    if (analysisTimer) {
      clearInterval(analysisTimer);
      analysisTimer = setInterval(runAnalysisTick, settings.snapshotIntervalMs);
    }
  });

  facingSelect.addEventListener('change', persistSettings);
  voiceToggle.addEventListener('change', persistSettings);
  soundToggle.addEventListener('change', persistSettings);

  renderDigitalBoard(boardCanvas, internalBoard, boardSize, moveNumbers);
  refreshHud();
  updateDownloadLink();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Offline/installability is a nice-to-have; ignore registration failures.
      });
    });
  }
}

initApp();
