# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

This is a monorepo of small, independent "vibe-coded" web projects — each lives in its own
top-level directory with no shared build system, dependencies, or code between them. There is no
root-level `package.json`, build tool, or test runner. Treat each subdirectory as its own project
and `cd` into it before running anything project-specific.

- **`goban/`** — Peer-to-peer physical Go board simulator. Single-file app (`index.html`, no
  build step). See `goban/spec.md` for the full requirements (this is the design doc, written as a
  running list of feature requests — read it before making UI/behavior changes, since later
  numbered sections amend or override earlier ones).
- **`kanshu/`** (監守) — Browser-based Go game recorder that watches a physical board via camera
  and exports SGF. Has its own `kanshu/CLAUDE.md` with detailed architecture and constraints —
  **read that file before working in `kanshu/`**, it takes precedence over anything below for that
  directory.

## Deployment

The site is published via GitHub Pages, built by `.github/workflows/deploy-pages.yml` on every
push to `main` (or manually via `workflow_dispatch`). The workflow assembles a static `_site/`
directory and deploys it — it does not deploy from a branch/folder directly, so **any new
project's built output must be added to the "Assemble site" step** to actually go live:

- root `index.html` is a landing page linking to each app
- `goban/` is copied in as-is (single static file, no build step)
- `kanshu/` is only built and copied in once it has a `kanshu/package.json` (the workflow checks
  for this and skips it otherwise, since it's currently pre-implementation)

## goban/

- Everything — HTML, CSS, JS — lives in the single `goban/index.html` file. No build step, no
  `npm install`; open the file directly or serve it with any static file server.
- **P2P networking:** PeerJS (via CDN script tag). **QR codes:** qrcode.js (via CDN script tag).
  Both are loaded as external `<script>` tags in the `<head>` — do not add a bundler or move to
  npm-installed versions unless explicitly asked.
- No backend, no build tooling, no persistence beyond what's encoded in the shareable URL — the
  app works by one peer hosting and encoding its PeerJS ID into a `?join=` URL param that the
  other peer connects to.
- The app deliberately enforces no Go rules (no captures, no turn order, no legality checks) —
  it mimics a physical board where players move stones freely by hand. Don't add rule enforcement.
- Stone positions sync as **percentages of board size**, not pixels, for cross-device
  compatibility — preserve this when touching sync logic.
- Straight edges/corners throughout (no rounded corners) is an explicit, repeated design
  requirement in `spec.md` — don't reintroduce `border-radius`.

## kanshu/

See `kanshu/CLAUDE.md`. In short: a fully client-side (no backend, ever) Vite+TypeScript rebuild
of an earlier Python/OpenCV prototype (`calibrate.py`, `spec-old.md`, kept only as algorithmic
reference, not to be extended). As of now the project is pre-implementation — only specs and the
legacy prototype exist, so don't assume any module names or APIs beyond what's in `kanshu/spec.md`.

The legacy prototype runs via:

```bash
cd kanshu
source .venv/bin/activate
python calibrate.py
```
