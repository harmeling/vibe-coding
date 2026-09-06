import type { BoardDiffResult } from './boardState';
import type { BoardSize } from '../types';

/** SGF point coordinates run a=0, b=1, ... from the top-left, x (column) before y (row). */
function sgfCoord(n: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + n);
}

export function pointToSgf(index: number, boardSize: BoardSize): string {
  const row = Math.floor(index / boardSize);
  const col = index % boardSize;
  return sgfCoord(col) + sgfCoord(row);
}

/**
 * Builds SGF text for a game recorded as a sequence of confirmed board diffs (one per
 * snapshot that produced a change). Each placement becomes its own `;B[xy]`/`;W[xy]` node;
 * any stones the same diff removed (a capture, or a corrective removal) ride along as an
 * `AE` (add-empty) property on the first such node, or their own `;AE[...]` node if the diff
 * had no placement at all (e.g. a manual correction).
 */
export function buildSgf(turns: BoardDiffResult[], boardSize: BoardSize): string {
  const header = `(;GM[1]FF[4]CA[UTF-8]AP[Kanshu]SZ[${boardSize}]`;
  const nodes: string[] = [];

  for (const turn of turns) {
    const removedCoords = turn.removals.map((r) => `[${pointToSgf(r.index, boardSize)}]`).join('');

    if (turn.placements.length === 0) {
      if (removedCoords) nodes.push(`;AE${removedCoords}`);
      continue;
    }

    turn.placements.forEach((placement, i) => {
      const coord = pointToSgf(placement.index, boardSize);
      const moveProp = placement.color === 'black' ? `B[${coord}]` : `W[${coord}]`;
      const ae = i === 0 ? removedCoords : '';
      nodes.push(`;${moveProp}${ae ? `AE${ae}` : ''}`);
    });
  }

  return `${header}${nodes.join('')})`;
}
