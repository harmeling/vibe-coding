import { createEmptyBoard } from './boardState';
import type { BoardDiffResult } from './boardState';
import { formatBoardCoordinate } from './coords';
import type { MoveLogEntry } from './moveLog';
import type { BoardSize, IntersectionState, StoneColor } from '../types';

export interface ReplayResult {
  board: IntersectionState[];
  moveNumbers: (number | null)[];
  moveLogEntries: MoveLogEntry[];
  moveCounter: number;
  blackCaptures: number;
  whiteCaptures: number;
  nextColor: StoneColor;
}

/**
 * Reconstructs the full derived game state by replaying an ordered list of turns from scratch.
 * Both the camera pipeline (append one new turn, replay) and a hand-edited SGF (re-parse into
 * turns, replay) go through this same function, so the two ways of changing history always
 * agree on what the resulting board/HUD/move-log should look like.
 */
export function replayTurns(turns: readonly BoardDiffResult[], boardSize: BoardSize): ReplayResult {
  const gridSize = boardSize * boardSize;
  const board = createEmptyBoard(gridSize);
  const moveNumbers: (number | null)[] = new Array(gridSize).fill(null);
  const moveLogEntries: MoveLogEntry[] = [];
  let moveCounter = 0;
  let blackCaptures = 0;
  let whiteCaptures = 0;
  let nextColor: StoneColor = 'black';

  for (const turn of turns) {
    for (const removal of turn.removals) {
      // The actually-removed color comes from the board being replayed, not the event itself --
      // an SGF `AE` node (and hence a hand-edited one) doesn't encode what was there before.
      const actualColor = board[removal.index];
      if (actualColor === 'black') blackCaptures++;
      else if (actualColor === 'white') whiteCaptures++;
      board[removal.index] = 'empty';
      moveNumbers[removal.index] = null;
    }

    turn.placements.forEach((placement, i) => {
      moveCounter++;
      board[placement.index] = placement.color;
      moveNumbers[placement.index] = moveCounter;
      // Captures ride along on the first placement of the turn, same convention as buildSgf.
      const capturedCount = i === 0 ? turn.removals.length : 0;
      moveLogEntries.push({
        number: moveCounter,
        color: placement.color,
        coordinate: formatBoardCoordinate(placement.index, boardSize),
        capturedCount,
      });
      nextColor = placement.color === 'black' ? 'white' : 'black';
    });
  }

  return { board, moveNumbers, moveLogEntries, moveCounter, blackCaptures, whiteCaptures, nextColor };
}
