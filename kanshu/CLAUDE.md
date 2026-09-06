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
  detect/classify pipeline only runs on a timer (default every 10s, adjustable). A state change
  is only confirmed once it persists across **two consecutive snapshots** — the sparse-sampling
  analogue of debouncing hand occlusion.
- **No OpenCV.js.** The perspective warp and pixel sampling are hand-rolled (Canvas 2D/WebGL);
  don't pull in a wasm CV library for this.

## Current state

All of `PLAN.md`'s Steps 0-9 are implemented; Step 10 (real-board validation/threshold tuning)
is intentionally postponed until a physical board is available for testing. The pure-logic
layer (homography, warp, grid classification/debounce, board diffing, SGF, storage — Steps
1-5) is fully covered by Vitest (44 tests). The browser-glue layer (camera, calibration UI,
pipeline wiring, canvas rendering, sound/speech, PWA manifest — Steps 6-9) type-checks and
builds cleanly but **has not been manually smoke-tested with a live camera by anyone yet** —
see the `⚠️` markers in `PLAN.md` for exactly what to try first. Read `PLAN.md` before assuming
any module or behavior is more finished than it says.

The legacy `calibrate.py`/`spec-old.md` Python prototype is reference-only, not to be extended.

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
   `config.json` from the old prototype).
2. **Grid engine** — on a timer (default 10s), samples each grid intersection of the warped
   frame against a captured empty-board baseline; luminance thresholds classify
   empty/black/white; confirms a change only after two consecutive snapshots agree.
3. **Game engine & SGF** — authoritative 2D board-state array; diffs confirmed visual state
   against internal state to detect placement vs. capture; builds SGF in memory, mirrors it to
   `localStorage`, and offers it as a downloadable file (no filesystem to write to in-browser).
4. **UI & accessibility** — dual canvas (live de-warped feed + clean digital board with numbered
   stones), HUD (turn/last move/captures), optional click sound, and an optional
   `SpeechSynthesis`-based spoken move announcement for visually impaired users (off by default).

Keep the same separation of concerns as the phases above when implementing — e.g. the grid
engine should not know about SGF, and the game engine should not touch pixels or the DOM.
