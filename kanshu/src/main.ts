import { startCamera, stopCamera } from './camera';
import { captureVideoFrame, drawPixelBuffer } from './frame';
import { detectBoardQuad } from './calibration/autoDetect';
import type { DetectedQuad } from './calibration/autoDetect';
import { CalibrationController } from './calibration/calibration';
import { invertMatrix3x3 } from './calibration/homography';
import { warpFrame } from './calibration/warp';
import { advance, classifyBuffer, createInitialState, intersectionPoints, sampleLuminance } from './grid/gridEngine';
import type { GridEngineState } from './grid/gridEngine';
import { isMotionDetected } from './grid/motion';
import { createEmptyBoard, diffBoard } from './game/boardState';
import type { BoardDiffResult } from './game/boardState';
import { buildSgf, parseSgf } from './game/sgf';
import { replayTurns } from './game/replay';
import { formatMoveLog } from './game/moveLog';
import type { MoveLogEntry } from './game/moveLog';
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
import { renderCalibrationOverlay, renderDashedQuad, renderDigitalBoard } from './ui/render';
import { updateHud } from './ui/hud';
import { playClick } from './ui/sound';
import { buildMoveAnnouncement, speak } from './ui/speech';
import type { BoardSize, Matrix3x3, PixelBuffer, StoneColor } from './types';

type AppPhase = 'idle' | 'calibrating' | 'running';
/** How often to re-run auto-detection while calibrating (ms) — cheap enough at this cadence. */
const AUTO_DETECT_INTERVAL_MS = 300;

/** Side length, in pixels, of the square top-down buffer calibration warps into. */
const ANALYSIS_SIZE = 480;
const PATCH_RADIUS = 4;
const GRID_MARGIN = ANALYSIS_SIZE * 0.08;
/**
 * Starting thresholds only — real values depend on lighting and camera, and tuning them
 * against an actual board is exactly the postponed Step 10 in PLAN.md.
 */
const DEFAULT_THRESHOLDS = { high: 175, low: 70, alpha: 22 };
/**
 * Average per-pixel luminance difference (0-255 scale) above which two consecutive snapshots
 * are considered "something is moving" (a hand, most likely) and this tick's classification is
 * skipped rather than risk reading a blurry/occluded frame. Starting value only — see
 * DEFAULT_THRESHOLDS above for the same caveat.
 */
const MOTION_THRESHOLD = 12;

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
  const moveLogEl = byId<HTMLTextAreaElement>('moveLog');
  const editSgfBtn = byId<HTMLButtonElement>('editSgfBtn');
  const sgfEditor = byId<HTMLTextAreaElement>('sgfEditor');

  let settings = loadSettings();
  boardSizeSelect.value = String(settings.boardSize);
  intervalInput.value = String(Math.round(settings.snapshotIntervalMs / 1000));
  facingSelect.value = settings.cameraFacingMode;
  voiceToggle.checked = settings.voiceAnnouncements;
  soundToggle.checked = settings.clickSound;

  let boardSize: BoardSize = settings.boardSize;
  let phase: AppPhase = 'idle';
  let stream: MediaStream | null = null;
  let inverseMatrix: Matrix3x3 | null = null;
  let calibrationController: CalibrationController | null = null;
  let analysisTimer: ReturnType<typeof setInterval> | null = null;
  let autoDetectTimer: ReturnType<typeof setInterval> | null = null;
  let latestDetectedQuad: DetectedQuad | null = null;
  let previewRafHandle: number | null = null;
  let downloadUrl: string | null = null;

  let gridSize = boardSize * boardSize;
  let gridState: GridEngineState = createInitialState(gridSize);
  let baselines: number[] | null = null;
  let previousWarpedFrame: PixelBuffer | null = null;
  let internalBoard = createEmptyBoard(gridSize);
  let moveNumbers: (number | null)[] = new Array(gridSize).fill(null);
  const turns: BoardDiffResult[] = [];
  const moveLogEntries: MoveLogEntry[] = [];
  let nextColor: StoneColor = 'black';
  let blackCaptures = 0;
  let whiteCaptures = 0;
  let sgfText = loadSgfText() ?? '';
  let lastMoveDescription: string | null = null;
  // Custom game-info properties (e.g. hand-added PB[]/PW[] player names) found by parseSgf
  // after a hand-edit; undefined means "use buildSgf's default header". Preserved across later
  // regenerations so a hand-edit's metadata survives new camera-detected moves.
  let sgfHeader: string | undefined = undefined;

  function persistSettings(): void {
    settings = {
      snapshotIntervalMs: Math.max(1, Number(intervalInput.value) || 1) * 1000,
      boardSize,
      voiceAnnouncements: voiceToggle.checked,
      clickSound: soundToggle.checked,
      cameraFacingMode: facingSelect.value === 'user' ? 'user' : 'environment',
    };
    saveSettings(settings);
  }

  function setPhase(next: AppPhase): void {
    phase = next;
    startBtn.disabled = false;
    startBtn.textContent = next === 'idle' ? 'Start camera' : next === 'calibrating' ? 'Calibrate' : 'Stop camera';
  }

  function refreshHud(): void {
    updateHud(
      { turn: hudTurn, lastMove: hudLastMove, captures: hudCaptures },
      { turn: nextColor, lastMoveDescription, blackCaptures, whiteCaptures },
    );
  }

  function renderMoveLog(): void {
    moveLogEl.value = formatMoveLog(moveLogEntries);
  }

  function updateDownloadLink(): void {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const blob = new Blob([sgfText || '(;)'], { type: 'application/x-go-sgf' });
    downloadUrl = URL.createObjectURL(blob);
    downloadBtn.href = downloadUrl;
  }

  function formatLastMoveDescription(entry: MoveLogEntry): string {
    return `${entry.color === 'black' ? 'Black' : 'White'} played ${entry.coordinate}`;
  }

  /**
   * Recomputes all derived state (board, move numbers, captures, HUD, SGF text) from `turns`
   * by replaying it from scratch. Both the camera pipeline (push one new turn) and a
   * successful hand-edit of the SGF (replace `turns` by re-parsing) call this afterwards, so
   * the two ways of changing history always converge on the same result.
   */
  function applyReplay(): void {
    const replay = replayTurns(turns, boardSize);
    internalBoard = replay.board;
    moveNumbers = replay.moveNumbers;
    moveLogEntries.length = 0;
    moveLogEntries.push(...replay.moveLogEntries);
    blackCaptures = replay.blackCaptures;
    whiteCaptures = replay.whiteCaptures;
    nextColor = replay.nextColor;
    lastMoveDescription =
      replay.moveLogEntries.length > 0 ? formatLastMoveDescription(replay.moveLogEntries[replay.moveLogEntries.length - 1]) : null;

    sgfText = buildSgf(turns, boardSize, sgfHeader);
    saveSgfText(sgfText);
    updateDownloadLink();
    renderDigitalBoard(boardCanvas, internalBoard, boardSize, moveNumbers);
    renderMoveLog();
    refreshHud();
  }

  function applyBoardSize(newSize: BoardSize): void {
    boardSize = newSize;
    gridSize = boardSize * boardSize;
    gridState = createInitialState(gridSize);
    baselines = null;
    turns.length = 0;
    sgfHeader = undefined;
    sgfEditor.value = '';
    sgfEditor.hidden = true;
    editSgfBtn.textContent = 'Edit raw SGF';
    applyReplay();
  }

  function drawPreviewFrame(): void {
    if (stream) {
      try {
        const raw = captureVideoFrame(video);
        if (inverseMatrix) {
          drawPixelBuffer(liveCanvas, warpFrame(raw, inverseMatrix, ANALYSIS_SIZE, ANALYSIS_SIZE));
        } else {
          drawPixelBuffer(liveCanvas, raw);
          if (latestDetectedQuad) renderDashedQuad(liveCanvas, latestDetectedQuad);
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

    if (previousWarpedFrame && isMotionDetected(previousWarpedFrame, warped, MOTION_THRESHOLD)) {
      previousWarpedFrame = warped;
      statusEl.textContent = 'Motion detected (hand over the board?) — waiting for it to settle…';
      return;
    }
    previousWarpedFrame = warped;
    if (baselines) statusEl.textContent = 'Watching the board…';

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

    turns.push(diff);
    applyReplay();

    // Announce/click only for what THIS tick added, not the whole replayed history.
    diff.placements.forEach((placement, i) => {
      const capturedCount = i === 0 ? diff.removals.length : 0;
      speak(buildMoveAnnouncement(placement.color, placement.index, boardSize, capturedCount), settings.voiceAnnouncements);
    });
    playClick(settings.clickSound);
  }

  function stopAutoDetect(): void {
    if (autoDetectTimer) {
      clearInterval(autoDetectTimer);
      autoDetectTimer = null;
    }
    latestDetectedQuad = null;
  }

  function startPipeline(data: CalibrationData): void {
    inverseMatrix = invertMatrix3x3(data.matrix);
    baselines = null;
    previousWarpedFrame = null;
    calibrationController?.dispose();
    calibrationController = null;
    stopAutoDetect();
    statusEl.textContent = 'Watching the board…';
    if (analysisTimer) clearInterval(analysisTimer);
    analysisTimer = setInterval(runAnalysisTick, settings.snapshotIntervalMs);
    setPhase('running');
  }

  function startCalibrationFlow(): void {
    inverseMatrix = null;
    if (analysisTimer) {
      clearInterval(analysisTimer);
      analysisTimer = null;
    }
    statusEl.textContent =
      'Auto-detecting the board — click "Calibrate" to accept the dashed outline, or click 4 corners directly on the video (any order).';
    calibrationController?.dispose();
    calibrationController = new CalibrationController(liveCanvas, {
      boardSize,
      targetSize: ANALYSIS_SIZE,
      onComplete: startPipeline,
    });
    setPhase('calibrating');

    stopAutoDetect();
    autoDetectTimer = setInterval(() => {
      if (!stream) return;
      try {
        latestDetectedQuad = detectBoardQuad(captureVideoFrame(video));
      } catch {
        // Video metadata not ready yet this tick; try again next tick.
      }
    }, AUTO_DETECT_INTERVAL_MS);
  }

  function handleCalibrateClick(): void {
    if (!latestDetectedQuad || !calibrationController) {
      statusEl.textContent = 'No board detected yet — adjust the camera angle/lighting, or click 4 corners manually.';
      return;
    }
    const { topLeft, topRight, bottomRight, bottomLeft } = latestDetectedQuad;
    calibrationController.completeWith([topLeft, topRight, bottomRight, bottomLeft]);
  }

  function handleStopCamera(): void {
    stopAutoDetect();
    if (analysisTimer) {
      clearInterval(analysisTimer);
      analysisTimer = null;
    }
    calibrationController?.dispose();
    calibrationController = null;
    inverseMatrix = null;
    stopCamera(stream);
    stream = null;
    video.srcObject = null;
    setPhase('idle');
    statusEl.textContent = 'Click "Start camera" to begin.';
  }

  function handleStartCamera(): void {
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
  }

  startBtn.addEventListener('click', () => {
    if (phase === 'idle') handleStartCamera();
    else if (phase === 'calibrating') handleCalibrateClick();
    else handleStopCamera();
  });

  // No separate "Recalibrate" button: Reset clears the stored calibration, so the next
  // "Start camera" naturally goes through "Calibrate" again instead of resuming straight to
  // "Watching the board...".
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

  editSgfBtn.addEventListener('click', () => {
    sgfEditor.hidden = !sgfEditor.hidden;
    if (!sgfEditor.hidden) {
      sgfEditor.value = sgfText;
      sgfEditor.focus();
      editSgfBtn.textContent = 'Hide SGF editor';
    } else {
      editSgfBtn.textContent = 'Edit raw SGF';
    }
  });

  // Fires on blur (not every keystroke) so incomplete-bracket typing mid-edit never triggers a
  // parse attempt. On success, the edited text becomes the new authoritative `turns` — so
  // deleting a move node here really does undo it, and later camera-detected moves keep
  // appending to this same history afterwards, same as if they'd always been there.
  sgfEditor.addEventListener('change', () => {
    try {
      const parsed = parseSgf(sgfEditor.value, boardSize);
      turns.length = 0;
      turns.push(...parsed.turns);
      sgfHeader = parsed.header || undefined;
      applyReplay();
      statusEl.textContent = 'Board updated from your SGF edit.';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      statusEl.textContent = `Could not parse the edited SGF: ${message}`;
    }
  });

  // Restore from whatever SGF was last persisted, by parsing it back into turns rather than
  // just redisplaying the raw text -- this also restores the board/HUD/move-log across a
  // reload, which just redisplaying the text wouldn't.
  if (sgfText) {
    try {
      const parsed = parseSgf(sgfText, boardSize);
      turns.push(...parsed.turns);
      sgfHeader = parsed.header || undefined;
    } catch {
      // Corrupt/incompatible persisted SGF; start fresh rather than crash on load.
    }
  }
  applyReplay();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Offline/installability is a nice-to-have; ignore registration failures.
      });
    });
  }
}

initApp();
