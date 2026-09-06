import type { IntersectionState, StoneColor } from '../types';

export interface StoneEvent {
  index: number;
  color: StoneColor;
}

export interface BoardDiffResult {
  placements: StoneEvent[];
  removals: StoneEvent[];
}

export function createEmptyBoard(size: number): IntersectionState[] {
  return new Array(size).fill('empty');
}

/**
 * Diffs a confirmed visual reading against the internal board state:
 * empty -> stone is a placement, stone -> empty is a removal (capture). A direct color swap
 * (stone -> different-colored stone) is unusual but treated as a removal followed by a
 * placement rather than silently dropped, since the physical board really did change twice.
 */
export function diffBoard(internal: IntersectionState[], visual: IntersectionState[]): BoardDiffResult {
  const placements: StoneEvent[] = [];
  const removals: StoneEvent[] = [];

  for (let i = 0; i < internal.length; i++) {
    const before = internal[i];
    const after = visual[i];
    if (before === after) continue;

    if (before !== 'empty') removals.push({ index: i, color: before });
    if (after !== 'empty') placements.push({ index: i, color: after });
  }

  return { placements, removals };
}
