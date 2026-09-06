import { describe, expect, it } from 'vitest';
import { replayTurns } from './replay';
import type { BoardDiffResult } from './boardState';

describe('replayTurns', () => {
  it('replays a couple of placements onto an otherwise-empty board', () => {
    const turns: BoardDiffResult[] = [
      { placements: [{ index: 0, color: 'black' }], removals: [] },
      { placements: [{ index: 1, color: 'white' }], removals: [] },
    ];
    const result = replayTurns(turns, 9);
    expect(result.board[0]).toBe('black');
    expect(result.board[1]).toBe('white');
    expect(result.board[2]).toBe('empty');
    expect(result.moveNumbers[0]).toBe(1);
    expect(result.moveNumbers[1]).toBe(2);
    expect(result.moveNumbers[2]).toBeNull();
    expect(result.moveCounter).toBe(2);
    expect(result.nextColor).toBe('black'); // 2 moves played, black is up again
  });

  it('recomputes the captured color from board state, not the (placeholder) event color', () => {
    const turns: BoardDiffResult[] = [
      { placements: [{ index: 0, color: 'black' }], removals: [] },
      { placements: [{ index: 1, color: 'white' }], removals: [] },
      // AE-derived removal with a meaningless placeholder color -- replay must ignore it and
      // look at what's actually on the board at index 0 (black).
      { placements: [], removals: [{ index: 0, color: 'white' }] },
    ];
    const result = replayTurns(turns, 9);
    expect(result.board[0]).toBe('empty');
    expect(result.blackCaptures).toBe(1);
    expect(result.whiteCaptures).toBe(0);
  });

  it('attributes a capture to the first placement of the same turn, in the move log', () => {
    const turns: BoardDiffResult[] = [
      { placements: [{ index: 0, color: 'black' }], removals: [] },
      { placements: [{ index: 1, color: 'white' }], removals: [] },
      {
        placements: [{ index: 2, color: 'black' }],
        removals: [{ index: 1, color: 'black' }],
      },
    ];
    const result = replayTurns(turns, 9);
    expect(result.moveLogEntries[2]).toEqual({ number: 3, color: 'black', coordinate: 'C9', capturedCount: 1 });
    expect(result.whiteCaptures).toBe(1);
  });

  it('replaying no turns at all yields a clean, empty board', () => {
    const result = replayTurns([], 9);
    expect(result.board.every((s) => s === 'empty')).toBe(true);
    expect(result.moveCounter).toBe(0);
    expect(result.nextColor).toBe('black');
  });
});
