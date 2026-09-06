# Kanshū build plan

Work through these one at a time, top to bottom. Don't start a step until the previous one's
verification passes. Check off each box as it's verified.

Checkbox convention: `[x]` with no `⚠️` means actually verified (usually by an automated test).
`[x] ⚠️ not yet manually verified` means the code is written and compiles/builds cleanly but the
manual browser (and/or camera) smoke test it needs hasn't been run by anyone yet — treat those
as "implemented, please go try it" rather than "done."

Design principle behind this ordering: the interesting logic (homography math, grid
classification, debounce, board-state diffing, SGF generation) is written as pure functions over
plain data (points, typed pixel buffers, board arrays) instead of live `getUserMedia`/`Canvas`
objects, so it can be unit-tested with synthetic inputs — no camera or board required. Only the
thin glue layers (camera capture, corner picking, rendering, speech/sound) need manual browser
smoke tests, and only the very last step needs an actual physical board.

- [x] **Step 0 — Scaffold.** Vite + TypeScript + Vitest project, no framework (per `spec.md`).
      *Verified by:* `npm install && npm run build && npm run test` all succeed.

- [x] **Step 1 — Homography math** (`src/calibration/homography.ts`). Hand-rolled 4-point DLT
      solve + `applyHomography(matrix, point)` + `invertMatrix3x3`. Pure math, no DOM.
      *Verified:* Vitest (`homography.test.ts`, 5 tests) — identity case, skewed-quad → square
      mapping, round-trip via inversion, degenerate/singular-input error cases. No hardware
      needed.

- [x] **Step 2 — Grid engine** (`src/grid/gridEngine.ts`). Classify each grid intersection
      (empty/black/white) from a synthetic `PixelBuffer` against a baseline + luminance
      thresholds; two-consecutive-snapshot confirmation state machine (`advance`).
      Bonus, same reason it fits here: `src/calibration/warp.ts`'s `warpFrame` (the actual
      perspective-warp pixel remap) turned out to be pure too (buffer in, buffer out via the
      inverse homography), so it's implemented and tested now instead of waiting for Step 7.
      *Verified:* Vitest (`gridEngine.test.ts` + `warp.test.ts`, 13 tests) — transient flip
      does NOT confirm (simulated hand occlusion), sustained flip over two snapshots does,
      capture (stone→empty) confirms the same way, warp reproduces identity, marks
      out-of-bounds pixels transparent, and un-skews a synthetic perspective-distorted
      checkerboard. No hardware needed.

- [x] **Step 3 — Board-state diff** (`src/game/boardState.ts`). Flat board array; `diffBoard`
      diffs confirmed visual state against internal state → placements vs. captures.
      *Verified:* Vitest (`boardState.test.ts`, 5 tests) — single placement, multi-stone
      capture, a placement that captures neighbors in the same diff, direct color swap. No
      hardware needed.

- [x] **Step 4 — SGF builder** (`src/game/sgf.ts`). Builds SGF text from a list of confirmed
      `BoardDiffResult` turns (hand-rolled, no external library); captures ride along as `AE`
      on the placement node, or their own node if there was no placement.
      *Verified:* Vitest (`sgf.test.ts`, 6 tests) — coordinate mapping, empty game, alternating
      placements, capture-attached-to-placement, removal-only node. No hardware needed.

- [x] **Step 5 — Storage layer** (`src/storage.ts`). `localStorage` wrappers (`storage`
      parameter, defaults to the real `localStorage`) for calibration matrix, settings
      (with defaults), and cached SGF text; namespaced (`kanshu:*`) and schema-versioned.
      *Verified:* Vitest (`storage.test.ts`, 10 tests) with an in-memory `Storage` stub —
      round-trip, missing-key fallback, stale-schema and corrupt-JSON handling. No hardware
      needed.

- [x] **Step 6 — Camera + calibration UI** (`src/camera.ts`, `src/frame.ts`,
      `src/calibration/calibration.ts`, `src/calibration/orderCorners.ts`,
      `src/calibration/autoDetect.ts`). `getUserMedia` wrapper; a single button that walks
      "Start camera" → "Auto calibrate" → "Stop camera" through the app's 3 phases; 4-corner
      picking in **any click order** (`orderCorners` sorts them, same sum/diff trick as the
      legacy `calibrate.py`'s `order_points`); a hand-rolled Sobel-edge auto-detector
      (`detectBoardQuad`) that continuously proposes a board quad (drawn as a dashed overlay)
      while calibrating, which "Auto calibrate" accepts, or which manual corner clicks
      override.
      *Verified:* Vitest (`orderCorners.test.ts`, `autoDetect.test.ts`, 5 tests) — reordering a
      shuffled click sequence, and `detectBoardQuad` finding known corners of a synthetic
      rectangle and a perspective-skewed trapezoid, plus a null result on a blank frame.
      *Implemented, ⚠️ not yet manually verified* for everything camera-facing — same caveat as
      before: `npm run typecheck`/`build` are clean and `npm run dev` serves every element
      `main.ts` expects, but nobody has tried this with a live camera yet, and
      `detectBoardQuad`'s thresholds are tuned against clean synthetic images, not a real messy
      photo — expect it to need iteration once tried for real (that's the point of the
      synthetic tests: proving the *logic* works, not that the *thresholds* are right).
      **Do this smoke test yourself**: `npm run dev`, click "Start camera", watch for a dashed
      outline to appear over whatever the camera sees; try clicking "Auto calibrate" to accept
      it, and separately try clicking 4 corners manually in a scrambled order, confirming both
      paths produce a plausible warped preview that survives a reload.

- [x] **Step 7 — Pipeline wiring** (`src/main.ts`). Timer loop: frame capture → cached warp →
      grid sample → confirm → board diff → SGF update → storage persist. The empty-board
      baseline is captured from the first analysis tick after calibrating (assumes the board
      is empty at that moment) rather than a separate dedicated step — flagged as a
      simplification to revisit in Step 10 if it proves fragile.
      *Implemented, ⚠️ not yet manually verified* — same caveat as Step 6. **Smoke test**:
      after calibrating, point the camera at any grid-like stand-in (paper with drawn
      intersections + coins as stones) and confirm placements/removals show up on the digital
      board within one snapshot interval. Real-board accuracy tuning is deferred to Step 10.

- [x] **Step 8 — UI/HUD/accessibility** (`src/ui/render.ts`, `hud.ts`, `sound.ts`, `speech.ts`).
      Dual canvas render (live/warped + numbered digital board), HUD (turn/last
      move/captures), synthesized click sound (WebAudio, no asset file), optional
      `SpeechSynthesis` announcements (off by default, toggle in the header).
      *Verified:* Vitest (`hud.test.ts`, `speech.test.ts`, 5 tests) for the pure formatting
      helpers. *Implemented, not yet manually verified* for the actual canvas
      rendering/sound/speech playback — needs the same browser smoke test as Steps 6-7.

- [x] **Step 9 — PWA installability.** `public/manifest.json` + `public/icon.svg` +
      `public/sw.js` (cache-first app shell), registered from `main.ts`.
      *Implemented, ⚠️ not yet manually verified* — confirmed the built `dist/` includes all
      three files at the right paths, but nobody has run the Chrome DevTools Application tab /
      Lighthouse PWA audit or tried an offline reload yet.

- [ ] **Step 10 — 🚧 POSTPONED — real-board validation.** Calibrate against an actual physical
      board from a side angle, play through a real game including captures, tune default
      luminance thresholds/snapshot interval for real lighting conditions. Explicitly out of
      scope until a physical board is available.
