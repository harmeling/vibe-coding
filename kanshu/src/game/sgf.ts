import type { BoardDiffResult, StoneEvent } from './boardState';
import type { BoardSize, StoneColor } from '../types';

const DEFAULT_HEADER_PREFIX = 'GM[1]FF[4]CA[UTF-8]AP[Kanshu]';

/** SGF point coordinates run a=0, b=1, ... from the top-left, x (column) before y (row). */
function sgfCoord(n: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + n);
}

export function pointToSgf(index: number, boardSize: BoardSize): string {
  const row = Math.floor(index / boardSize);
  const col = index % boardSize;
  return sgfCoord(col) + sgfCoord(row);
}

function sgfToIndex(coord: string, boardSize: BoardSize): number {
  if (coord.length !== 2) throw new Error(`Invalid SGF coordinate "${coord}"`);
  const col = coord.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = coord.charCodeAt(1) - 'a'.charCodeAt(0);
  if (col < 0 || col >= boardSize || row < 0 || row >= boardSize) {
    throw new Error(`Coordinate "${coord}" is outside the ${boardSize}x${boardSize} board`);
  }
  return row * boardSize + col;
}

/**
 * Builds SGF text for a game recorded as a sequence of confirmed board diffs (one per
 * snapshot that produced a change). Each placement becomes its own `;B[xy]`/`;W[xy]` node;
 * any stones the same diff removed (a capture, or a corrective removal) ride along as an
 * `AE` (add-empty) property on the first such node, or their own `;AE[...]` node if the diff
 * had no placement at all (e.g. a manual correction).
 *
 * `header` overrides the default game-info properties — normally left unset, but set to
 * whatever `parseSgf` found after a hand-edit, so custom additions like `PB[]`/`PW[]` (player
 * names) survive future regenerations instead of being silently dropped.
 */
export function buildSgf(turns: readonly BoardDiffResult[], boardSize: BoardSize, header?: string): string {
  const headerProps = header && header.length > 0 ? header : `${DEFAULT_HEADER_PREFIX}SZ[${boardSize}]`;
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

  return `(;${headerProps}${nodes.join('')})`;
}

interface SgfNodeProperty {
  name: string;
  values: string[];
}

function parseNodeProperties(segment: string): SgfNodeProperty[] {
  const props: SgfNodeProperty[] = [];
  const propPattern = /([A-Za-z]+)((?:\[[^\]]*\])+)/g;
  for (const match of segment.matchAll(propPattern)) {
    const values = Array.from(match[2].matchAll(/\[([^\]]*)\]/g), (m) => m[1]);
    props.push({ name: match[1].toUpperCase(), values });
  }
  return props;
}

export interface ParsedSgf {
  /** Raw game-info property text of the header/setup node (if any), for round-tripping via `buildSgf`. */
  header: string;
  turns: BoardDiffResult[];
}

/**
 * Parses SGF text of the shape `buildSgf` produces back into turns — the inverse operation,
 * so a hand-edited SGF (adding/removing move nodes, adding player names, ...) can become the
 * new authoritative history. Deliberately lenient (no strict SGF grammar validation): a node is
 * treated as a move/removal node if it contains a `B[`, `W[`, or `AE[` property, and anything
 * else is treated as header/game-info text and preserved verbatim rather than parsed further.
 */
export function parseSgf(text: string, boardSize: BoardSize): ParsedSgf {
  let trimmed = text.trim();
  if (trimmed.startsWith('(')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith(')')) trimmed = trimmed.slice(0, -1);

  const segments = trimmed
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let header = '';
  const turns: BoardDiffResult[] = [];

  for (const segment of segments) {
    if (!/\b(?:B|W|AE)\[/.test(segment)) {
      header = segment;
      continue;
    }

    const placements: StoneEvent[] = [];
    const removals: StoneEvent[] = [];

    for (const prop of parseNodeProperties(segment)) {
      if (prop.name === 'B' || prop.name === 'W') {
        const color: StoneColor = prop.name === 'B' ? 'black' : 'white';
        for (const coord of prop.values) {
          placements.push({ index: sgfToIndex(coord, boardSize), color });
        }
      } else if (prop.name === 'AE') {
        for (const coord of prop.values) {
          // Color is a placeholder: AE doesn't encode what was removed, and replaying turns
          // recomputes the actual color from the board state at that point instead.
          removals.push({ index: sgfToIndex(coord, boardSize), color: 'black' });
        }
      }
    }

    turns.push({ placements, removals });
  }

  return { header, turns };
}
