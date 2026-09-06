# Project Specification: Kanshū (監守) — Web Edition

## 🎯 Vision

A non-intrusive Go game recorder that runs entirely as a webpage. Point a laptop or phone
camera at a physical Go board from a side angle; the page warps that view to a top-down
board, tracks stone placements/captures in real time, and lets you download the game as SGF.

No install, no account, no server. Open the URL, point the camera, play.

## 🧭 Design Principles

- **Fully local processing.** Camera frames never leave the device — there is no backend at
  all, so this is the default rather than something to configure. The whole app is static
  files (HTML/JS/CSS/wasm-free) servable from any static host.
- **No commercial layer.** No accounts, no analytics/telemetry, no ads, free and open. Nothing
  phones home.
- **Good defaults, zero required configuration.** Loading the page and pointing a camera at a
  board should work out of the box. Every default below is user-adjustable, but none should
  need to be touched for the system to work.
- **Accessible.** Optional spoken-move announcements for visually impaired users, so the
  system is useful without looking at the screen.

## 🛠 Tech Stack

- **Build tool:** Vite + TypeScript. No UI framework (React/Vue/Svelte) — the app is a
  `requestAnimationFrame`-driven canvas renderer plus a small settings panel; a component
  framework would fight the render loop more than it would help the panel.
- **Camera:** `navigator.mediaDevices.getUserMedia` (requires a secure context — HTTPS or
  `localhost`). `facingMode: 'environment'` by default on phones (rear camera), front/back
  toggle in settings.
- **Perspective warp:** hand-rolled 4-point homography (DLT) + Canvas 2D (or WebGL if
  perf requires it) — **no OpenCV.js**. The only CV ops this project needs are one warp and
  pixel-patch sampling; pulling in an 8MB wasm build for that isn't worth the download/parse
  cost, especially on phones.
- **Speech:** Web Speech API (`SpeechSynthesis`) for move announcements.
- **Persistence:** `localStorage` for calibration + settings; in-memory SGF text with a
  "download .sgf" button (`Blob` + `<a download>`) since there's no filesystem to write to.
- **Installable/offline:** PWA manifest + service worker, so it can be added to a phone home
  screen and re-used without a network connection after first load.

## ⚙️ Adjustable Settings (defaults in parentheses, all persisted in `localStorage`)

- **Snapshot interval** (**10s**) — how often a frame is grabbed from the live feed and run
  through the detection pipeline. The video preview itself is continuous/live; only the
  *analysis* is periodic. Sparse sampling is deliberate: it's far cheaper on battery/CPU
  (especially on phones) than analyzing every frame, and a Go board doesn't need faster
  reaction time than that.
- **Board size** (**19×19**, with 9×9/13×13 presets)
- **Stone luminance thresholds** relative to a captured empty-board baseline
- **Voice move announcements** (**off**) — one-tap toggle to turn on
- **Click sound on confirmed move** (**on**)
- **Camera facing mode / resolution**

## 📋 Architecture / Phases

Mirrors the original prototype's phase split (see `spec-old.md` for the algorithmic
background); only the runtime changes.

### Phase 1: Calibration

- Live `getUserMedia` feed drawn to a `<canvas>`.
- Interactive 4-point corner selection via `pointerdown` (works for mouse *and* touch, so the
  same code handles laptop trackpad clicks and phone taps).
- Compute homography (DLT, 4-point correspondence) → warp function.
- Persist the matrix + board size + raw points to `localStorage` (replaces `config.json`).

### Phase 2: The Grid Engine

- On a timer (default every 10s, adjustable), grab the current video frame into an offscreen
  canvas, apply the cached warp, and sample a small pixel patch at each grid intersection.
- Classify each intersection against a captured empty-board baseline: `Luminance > High` =
  White, `Luminance < Low` = Black, `Baseline ± Alpha` = Empty.
- **Stability filter, adapted for sparse sampling:** because analysis is periodic rather than
  continuous, a state change is only confirmed once it is observed in **two consecutive
  snapshots** (i.e. it persists across at least one full interval) — this is the sparse-sampling
  analogue of the original "5 consecutive frames" debounce, and serves the same purpose
  (ignoring a hand transiently occluding the board). Users who want faster confirmation can
  shorten the snapshot interval.

### Phase 3: Game Logic & SGF

- Board state as a 2D array, diffed against each confirmed visual reading:
  - `Internal == Empty` AND `Visual == Stone` → **Move Placement**.
  - `Internal == Stone` AND `Visual == Empty` → **Capture/Removal**.
- Build SGF incrementally in memory; cache the current SGF text in `localStorage` so a page
  reload doesn't lose the game; "Download .sgf" button produces the file.

### Phase 4: Visual Overlay & Accessibility

- Dual canvas display: the live de-warped board, and a clean digital board with numbered
  stones.
- HUD: current turn, last move, total captures.
- Optional click sound on confirmed move.
- **Optional spoken announcement** of each confirmed move via `SpeechSynthesis` (e.g. "Black
  plays at D4", "White stone captured at Q16") — the accessibility feature that lets someone
  follow the game without watching the screen. Off by default, one-tap toggle.

## 🚫 Non-goals

- No user accounts, cloud sync, analytics, or monetization of any kind.
- No server-side component.

## 📎 Reference

`spec-old.md` documents the original Python/OpenCV desktop prototype. The core computer-vision
approach (grid sampling over `HoughCircles`, perspective calibration via 4 clicked corners,
debounced state changes) carries over conceptually; only the platform and sampling cadence
changed.
