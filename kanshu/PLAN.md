# Kanshū build plan

Work through these one at a time, top to bottom. Don't start a step until the previous one's
verification passes. Check off each box as it's verified.

Design principle behind this ordering: the interesting logic (homography math, grid
classification, debounce, board-state diffing, SGF generation) is written as pure functions over
plain data (points, typed pixel buffers, board arrays) instead of live `getUserMedia`/`Canvas`
objects, so it can be unit-tested with synthetic inputs — no camera or board required. Only the
thin glue layers (camera capture, corner picking, rendering, speech/sound) need manual browser
smoke tests, and only the very last step needs an actual physical board.

- [x] **Step 0 — Scaffold.** Vite + TypeScript + Vitest project, no framework (per `spec.md`).
      *Verified by:* `npm install && npm run build && npm run test` all succeed.

- [ ] **Step 1 — Homography math** (`src/calibration/homography.ts`). Hand-rolled 4-point DLT
      solve + `applyHomography(matrix, point)`. Pure math, no DOM.
      *Verify:* Vitest — known quad → known target mapping; round-trip (apply then invert
      recovers the original point) within floating-point tolerance. No hardware needed.

- [ ] **Step 2 — Grid engine** (`src/grid/gridEngine.ts`). Classify each grid intersection
      (empty/black/white) from a synthetic `PixelBuffer` against a baseline + luminance
      thresholds; two-consecutive-snapshot confirmation state machine.
      *Verify:* Vitest with hand-built synthetic buffers — a transient flip that reverts must
      NOT confirm (simulates a hand passing over the board); a flip sustained across two
      snapshots must confirm. No hardware needed.

- [ ] **Step 3 — Board-state diff** (`src/game/boardState.ts`). 2D board array; diff confirmed
      visual state against internal state → placements vs. captures.
      *Verify:* Vitest — scripted move sequences including a multi-stone capture. No hardware
      needed.

- [ ] **Step 4 — SGF builder** (`src/game/sgf.ts`). Incrementally build SGF text from the move
      list (hand-rolled, no external library).
      *Verify:* Vitest — generated SGF string matches expected output for a few scripted games.
      No hardware needed.

- [ ] **Step 5 — Storage layer** (`src/storage.ts`). `localStorage` wrappers for calibration
      matrix, settings, and cached SGF text, namespaced and schema-versioned.
      *Verify:* Vitest with a small in-memory `localStorage` stub. No hardware needed.

- [ ] **Step 6 — Camera + calibration UI** (`src/camera.ts`, `src/calibration/calibration.ts`).
      `getUserMedia` wrapper; pointerdown 4-corner picker over the live feed, wired to
      `homography.ts` + `storage.ts`.
      *Verify:* manual smoke test via `npm run dev` — click 4 corners with **any** camera
      pointed at **any** surface, confirm a plausible warped preview renders and persists
      across reload. Doesn't require a physical Go board yet, just a camera.

- [ ] **Step 7 — Pipeline wiring** (`src/main.ts`). Timer loop: frame capture → cached warp →
      grid sample → confirm → board diff → SGF update → storage persist.
      *Verify:* manual smoke test — point the camera at any grid-like stand-in (e.g. paper with
      drawn intersections and coins/counters as stones) and confirm the pipeline fires
      end-to-end. Real-board accuracy tuning is deferred to Step 10.

- [ ] **Step 8 — UI/HUD/accessibility** (`src/ui/render.ts`, `hud.ts`, `sound.ts`, `speech.ts`).
      Dual canvas render, HUD (turn/last move/captures), click sound, optional
      `SpeechSynthesis` announcements (off by default).
      *Verify:* manual smoke test in browser; any pure formatting helpers (e.g. move →
      coordinate string like "D4") get Vitest coverage. No hardware needed.

- [ ] **Step 9 — PWA installability.** Manifest + service worker.
      *Verify:* manual — Chrome DevTools Application tab / Lighthouse PWA audit, reload while
      offline. No hardware needed.

- [ ] **Step 10 — 🚧 POSTPONED — real-board validation.** Calibrate against an actual physical
      board from a side angle, play through a real game including captures, tune default
      luminance thresholds/snapshot interval for real lighting conditions. Explicitly out of
      scope until a physical board is available.
