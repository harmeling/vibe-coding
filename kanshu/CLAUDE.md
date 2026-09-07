# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Kanshū (監守)

A non-intrusive Go game recorder that runs entirely as a webpage. It watches a side-angle view
of a physical Go board (via laptop or phone camera), warps it to a top-down view, detects stone
placements/captures via periodic grid-based intensity sampling, and exports the game to SGF.

The full design is in `spec.md` — read it before making architectural changes. `PLAN.md` is the
step-by-step build sequence derived from it — work through it in order, one checked-off step at
a time, rather than implementing ahead. An earlier
Python/OpenCV desktop prototype (`calibrate.py`, `spec-old.md`) explored the same problem but is
no longer being developed; the project is being rebuilt as a browser-only app. Keep `calibrate.py`
and `spec-old.md` around as algorithmic reference, but don't extend them.

Non-negotiable constraints from `spec.md`:

- **Fully client-side.** No backend, no camera data ever leaves the device. This is not a
  configuration toggle — there is no server component at all, by design.
- **No commercial layer.** No accounts, analytics/telemetry, ads, or monetization.
- **Zero-config defaults.** Loading the page and pointing a camera at a board must work without
  the user touching a settings panel. Every parameter (snapshot interval, thresholds, board size)
  is adjustable, but none should be *required*.
- **Detection method is grid-based intensity sampling, not circle detection** — the camera is at
  a side angle, so shadows and perspective distortion make circle detection unreliable.
- **Analysis is periodic, not per-frame.** The video preview is continuous, but the
  detect/classify pipeline only runs on a timer (default every 1s — see `src/main.ts`'s
  `runAnalysisTick`/`src/storage.ts`'s `DEFAULT_SETTINGS`; adjustable down to 1s in the UI).
  A state change is only confirmed once it persists across **two consecutive snapshots** — the
  sparse-sampling analogue of debouncing hand occlusion — and each tick is additionally skipped
  outright (via `src/grid/motion.ts`'s `isMotionDetected`) if the current frame differs too much
  from the previous one, on the assumption that a hand is currently moving across the board.
  Note this default was lowered from spec.md's original 10s once the two-snapshot debounce
  alone turned out to tolerate a hand resting still for a whole interval; a 1s interval makes
  that far less likely without changing the debounce logic itself.
- **No OpenCV.js.** The perspective warp and pixel sampling are hand-rolled (Canvas 2D/WebGL);
  don't pull in a wasm CV library for this.

## Current state

All of `PLAN.md`'s Steps 0-9 are implemented; Step 10 (real-board validation/threshold tuning)
is intentionally postponed until a physical board is available for testing. The pure-logic
layer (homography, warp, grid classification/debounce, board diffing, SGF parse/build, replay,
storage, corner ordering, auto-detection, motion detection — Steps 1-6) is fully covered by
Vitest (69 tests). The
browser-glue
layer (camera, calibration UI,
pipeline wiring, canvas rendering, sound/speech, PWA manifest — Steps 6-9) type-checks and
builds cleanly but **has not been manually smoke-tested with a live camera by anyone yet** —
see the `⚠️` markers in `PLAN.md` for exactly what to try first. Read `PLAN.md` before assuming
any module or behavior is more finished than it says.

The legacy `calibrate.py`/`spec-old.md` Python prototype is reference-only, not to be extended.

## Known limitations (by design, for now)

- **No camera-movement tracking.** Calibration computes one homography matrix and caches it;
  every later frame reuses that same fixed matrix until it's recalibrated (Reset, then Start
  camera again). If the camera
  or board moves after calibrating, the cached warp silently becomes wrong — there's no
  drift detection or re-localization. Matches the spec's assumption of a fixed camera position
  for the session; revisit only if real-world testing shows this is too fragile.
- **No automatic distinction between a capture and a manual correction.** `diffBoard` (Step 3)
  treats every stone→empty transition as a removal and records it — correctly, for actual
  captures. It can't tell a legitimate capture apart from someone picking up a misplaced stone
  to fix it; both look identical from the camera's perspective. There's no automatic undo.
  **Manual undo does exist** via "Edit raw SGF" (`parseSgf` → `replayTurns`, see
  `src/game/{sgf,replay}.ts`): deleting a move node from the text and blurring the field
  re-derives the board/HUD/move-log from the edited history, and later camera-detected moves
  keep appending to that same (edited) history afterwards. Caveat: if the real stone is still
  physically on the board, the next snapshot will just notice the discrepancy and re-record it
  — this system has no way to know you *intend* it gone versus a camera glitch. Another caveat:
  editing is DOM-state-only (no debounce/lock against the background analysis timer), so
  leaving the editor open for a long time while the camera is actively also recording moves
  can lose whichever change is applied second on blur — fine for the intended use (tweak
  metadata or fix history between moves), a known rough edge for editing concurrently with
  active play.

## Environment / commands

```bash
npm install       # first time / after dependency changes
npm run dev       # local dev server
npm run build     # tsc --noEmit && vite build
npm run test      # vitest run (single pass)
npm run test:watch
npm run typecheck # tsc --noEmit only
```

The legacy Python prototype still runs via:

```bash
source .venv/bin/activate
python calibrate.py
```

## Architecture

Per `spec.md`, the pipeline is split into one module per phase, data flowing one direction each
cycle: raw video frame → warped frame (cached calibration matrix) → periodic grid sample →
two-snapshot-confirmed visual state → engine diff against internal board state → SGF update +
UI/HUD update + optional spoken announcement.

1. **Calibration** — `pointerdown`-based 4-corner selection on the live `getUserMedia` feed,
   homography via hand-rolled DLT, warp cached and persisted to `localStorage` (replaces
   `config.json` from the old prototype). One merged, persisted "Camera" choice covers "auto
   (rear-facing default)", "front-facing", and every enumerated real device — built-in, external
   USB, a phone connected as a webcam (`listVideoInputDevices`/`resolveCameraSelection` in
   `src/camera.ts`/`src/main.ts`) — rather than two separate controls. Switching cameras forces
   recalibration, since a different camera is a different physical framing.
2. **Grid engine** — on a timer (default 1s), first skips the tick entirely if
   `isMotionDetected` says the frame has changed too much since the last one (hand likely over
   the board); otherwise samples each grid intersection of the warped frame against a captured
   empty-board baseline, classifies empty/black/white via luminance thresholds, and confirms a
   change only after two consecutive snapshots agree.
3. **Game engine & SGF** — authoritative 2D board-state array; diffs confirmed visual state
   against internal state to detect placement vs. capture; builds SGF in memory, mirrors it to
   `localStorage`, and offers it as a downloadable file (no filesystem to write to in-browser).
4. **UI & accessibility** — dual canvas (live de-warped feed + clean digital board with numbered
   stones), HUD (turn/last move/captures), optional click sound, and an optional
   `SpeechSynthesis`-based spoken move announcement for visually impaired users (off by default).

Keep the same separation of concerns as the phases above when implementing — e.g. the grid
engine should not know about SGF, and the game engine should not touch pixels or the DOM.
