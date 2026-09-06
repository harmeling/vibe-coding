import { describe, expect, it } from 'vitest';
import { buildSgf, parseSgf, pointToSgf } from './sgf';
import type { BoardDiffResult } from './boardState';

describe('pointToSgf', () => {
  it('converts a flat index to SGF coordinates, top-left origin', () => {
    expect(pointToSgf(0, 9)).toBe('aa'); // row 0, col 0
    expect(pointToSgf(1, 9)).toBe('ba'); // row 0, col 1
    expect(pointToSgf(9, 9)).toBe('ab'); // row 1, col 0
    expect(pointToSgf(3 * 9 + 3, 9)).toBe('dd'); // row 3, col 3
  });
});

describe('buildSgf', () => {
  it('renders an empty game as just the header', () => {
    expect(buildSgf([], 9)).toBe('(;GM[1]FF[4]CA[UTF-8]AP[Kanshu]SZ[9])');
  });

  it('renders a few alternating placements', () => {
    const turns: BoardDiffResult[] = [
      { placements: [{ index: 0, color: 'black' }], removals: [] },
      { placements: [{ index: 1, color: 'white' }], removals: [] },
    ];
    expect(buildSgf(turns, 9)).toBe('(;GM[1]FF[4]CA[UTF-8]AP[Kanshu]SZ[9];B[aa];W[ba])');
  });

  it('attaches a capture from the same diff as AE on the placement node', () => {
    const turns: BoardDiffResult[] = [
      {
        placements: [{ index: 0, color: 'black' }],
        removals: [
          { index: 1, color: 'white' },
          { index: 2, color: 'white' },
        ],
      },
    ];
    expect(buildSgf(turns, 9)).toBe('(;GM[1]FF[4]CA[UTF-8]AP[Kanshu]SZ[9];B[aa]AE[ba][ca])');
  });

  it('renders a removal-only diff (no placement) as its own AE node', () => {
    const turns: BoardDiffResult[] = [{ placements: [], removals: [{ index: 4, color: 'black' }] }];
    expect(buildSgf(turns, 9)).toBe('(;GM[1]FF[4]CA[UTF-8]AP[Kanshu]SZ[9];AE[ea])');
  });

  it('uses a custom header when given one, instead of the default', () => {
    expect(buildSgf([], 9, 'GM[1]FF[4]SZ[9]PB[Alice]PW[Bob]')).toBe('(;GM[1]FF[4]SZ[9]PB[Alice]PW[Bob])');
  });
});

describe('parseSgf', () => {
  it('recovers placements from generated SGF text (round-trip with buildSgf)', () => {
    const turns: BoardDiffResult[] = [
      { placements: [{ index: 0, color: 'black' }], removals: [] },
      { placements: [{ index: 1, color: 'white' }], removals: [] },
    ];
    const parsed = parseSgf(buildSgf(turns, 9), 9);
    expect(parsed.turns).toEqual(turns);
  });

  it('recovers a capture attached to a placement node', () => {
    const text = '(;GM[1]FF[4]SZ[9];B[aa]AE[ba][ca])';
    const parsed = parseSgf(text, 9);
    expect(parsed.turns).toEqual([
      {
        placements: [{ index: 0, color: 'black' }],
        // Removal color is a placeholder (see parseSgf) -- only the index is meaningful here.
        removals: [
          { index: 1, color: 'black' },
          { index: 2, color: 'black' },
        ],
      },
    ]);
  });

  it('preserves hand-added header properties like player names for round-tripping', () => {
    const text = '(;GM[1]FF[4]SZ[9]PB[Alice]PW[Bob];B[aa])';
    const parsed = parseSgf(text, 9);
    expect(parsed.header).toBe('GM[1]FF[4]SZ[9]PB[Alice]PW[Bob]');
    expect(buildSgf(parsed.turns, 9, parsed.header)).toBe(text);
  });

  it('is lenient about a missing header, parsing bare move nodes directly', () => {
    const parsed = parseSgf(';B[aa];W[ba]', 9);
    expect(parsed.header).toBe('');
    expect(parsed.turns).toEqual([
      { placements: [{ index: 0, color: 'black' }], removals: [] },
      { placements: [{ index: 1, color: 'white' }], removals: [] },
    ]);
  });

  it('throws on an out-of-range coordinate', () => {
    expect(() => parseSgf('(;B[zz])', 9)).toThrow();
  });
});
