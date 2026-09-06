import { describe, expect, it } from 'vitest';
import { createEmptyBoard, diffBoard } from './boardState';
import type { IntersectionState } from '../types';

describe('diffBoard', () => {
  it('reports no changes when internal and visual match', () => {
    const board = createEmptyBoard(9);
    board[4] = 'black';
    expect(diffBoard(board, board)).toEqual({ placements: [], removals: [] });
  });

  it('detects a single placement', () => {
    const before = createEmptyBoard(4);
    const after: IntersectionState[] = [...before];
    after[1] = 'white';
    expect(diffBoard(before, after)).toEqual({
      placements: [{ index: 1, color: 'white' }],
      removals: [],
    });
  });

  it('detects a multi-stone capture in one diff', () => {
    const before: IntersectionState[] = ['black', 'white', 'white', 'empty'];
    const after: IntersectionState[] = ['black', 'empty', 'empty', 'empty']; // two white stones captured
    expect(diffBoard(before, after)).toEqual({
      placements: [],
      removals: [
        { index: 1, color: 'white' },
        { index: 2, color: 'white' },
      ],
    });
  });

  it('detects a placement that immediately captures neighboring stones in the same diff', () => {
    // Black plays at 0, capturing white stones at 1 and 2 — all observed in one confirmed reading.
    const before: IntersectionState[] = ['empty', 'white', 'white', 'black'];
    const after: IntersectionState[] = ['black', 'empty', 'empty', 'black'];
    expect(diffBoard(before, after)).toEqual({
      placements: [{ index: 0, color: 'black' }],
      removals: [
        { index: 1, color: 'white' },
        { index: 2, color: 'white' },
      ],
    });
  });

  it('treats a direct color swap as a removal followed by a placement', () => {
    const before: IntersectionState[] = ['black'];
    const after: IntersectionState[] = ['white'];
    expect(diffBoard(before, after)).toEqual({
      placements: [{ index: 0, color: 'white' }],
      removals: [{ index: 0, color: 'black' }],
    });
  });
});
