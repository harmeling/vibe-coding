/** Conventional Go column labels: A-T left to right, skipping 'I' to avoid confusion with '1'. */
const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

/**
 * Human-readable board coordinate (e.g. "D16"), distinct from `pointToSgf`'s internal SGF
 * encoding. Row 0 is the top edge; by Go convention row numbers count up from 1 at the bottom.
 */
export function formatBoardCoordinate(index: number, boardSize: number): string {
  const row = Math.floor(index / boardSize);
  const col = index % boardSize;
  const letter = COLUMN_LETTERS[col] ?? '?';
  const number = boardSize - row;
  return `${letter}${number}`;
}
