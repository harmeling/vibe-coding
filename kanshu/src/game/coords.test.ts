import { describe, expect, it } from 'vitest';
import { formatBoardCoordinate } from './coords';

describe('formatBoardCoordinate', () => {
  it('labels the top-left corner A<boardSize>', () => {
    expect(formatBoardCoordinate(0, 19)).toBe('A19');
  });

  it('labels the top-right corner skipping the letter I', () => {
    // col 8 -> 'J' (I is skipped), row 0 -> 19
    expect(formatBoardCoordinate(8, 19)).toBe('J19');
  });

  it('labels the bottom-left corner A1', () => {
    expect(formatBoardCoordinate(18 * 19, 19)).toBe('A1');
  });

  it('labels the bottom-right corner T1', () => {
    expect(formatBoardCoordinate(18 * 19 + 18, 19)).toBe('T1');
  });
});
