# Lab Notes — vibe-coding

Running log of agent-session setup and activity for this repo, on the
`agent` branch, per the `start-agent` skill.

## 2026-11-04

- No `agent` branch existed (locally or on `origin`) — created it from
  `main`.
- `CLAUDE.md` already present (monorepo of independent "vibe-coded" web
  projects: `goban/` — P2P Go board simulator; `kanshu/` — camera-based Go
  game recorder exporting SGF, with its own nested CLAUDE.md. Deployed via
  GitHub Pages on push to `main`) — skipped `/init`.

## 2026-11-04 08:43 — vibe-coding-1 launch (idle, Remote Control), tmux-on-ls8-slurm scheme

- Launched idle — no task given, standing by for Remote Control.
- Session name: `vibe-coding-1`
- Claude Code session ID (transcript UUID, for `--resume`):
  `287b825d-ec27-4326-8e66-c2d28a83517d`
- Hit the first-run "trust this folder" prompt (new clone location on this
  host); confirmed with explicit user permission.
- Launch command used (run locally, already on `ls8-slurm`):
  `tmux new-session -d -s vibe-coding-1 -c ~/git/vibe-coding 'claude --remote-control vibe-coding-1'`
- Monitor: `tmux capture-pane -t vibe-coding-1 -p | tail -n 50`
- Attach: `tmux attach -t vibe-coding-1`
- Resume (after a kill or restart): use the `resume-agent` skill.
- Cancel: `tmux kill-session -t vibe-coding-1`
