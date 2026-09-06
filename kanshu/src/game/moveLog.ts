import type { StoneColor } from '../types';

export interface MoveLogEntry {
  number: number;
  color: StoneColor;
  /** Human-readable board coordinate, e.g. "D4" — see `formatBoardCoordinate`. */
  coordinate: string;
  capturedCount: number;
}

export function formatMoveLogEntry(entry: MoveLogEntry): string {
  const base = `${entry.number}. ${entry.color === 'black' ? 'Black' : 'White'} ${entry.coordinate}`;
  return entry.capturedCount === 0 ? base : `${base} (captures ${entry.capturedCount})`;
}

/** Renders the full move log as one line per entry, in order. */
export function formatMoveLog(entries: readonly MoveLogEntry[]): string {
  return entries.map(formatMoveLogEntry).join('\n');
}
