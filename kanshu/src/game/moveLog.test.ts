import { describe, expect, it } from 'vitest';
import { formatMoveLog, formatMoveLogEntry } from './moveLog';

describe('formatMoveLogEntry', () => {
  it('formats a plain move with no captures', () => {
    expect(formatMoveLogEntry({ number: 1, color: 'black', coordinate: 'D4', capturedCount: 0 })).toBe('1. Black D4');
  });

  it('formats a move that captured stones', () => {
    expect(formatMoveLogEntry({ number: 7, color: 'white', coordinate: 'Q16', capturedCount: 2 })).toBe(
      '7. White Q16 (captures 2)',
    );
  });
});

describe('formatMoveLog', () => {
  it('joins entries one per line, in order', () => {
    const entries = [
      { number: 1, color: 'black' as const, coordinate: 'D4', capturedCount: 0 },
      { number: 2, color: 'white' as const, coordinate: 'Q16', capturedCount: 0 },
      { number: 3, color: 'black' as const, coordinate: 'C3', capturedCount: 1 },
    ];
    expect(formatMoveLog(entries)).toBe('1. Black D4\n2. White Q16\n3. Black C3 (captures 1)');
  });

  it('renders an empty log as an empty string', () => {
    expect(formatMoveLog([])).toBe('');
  });
});
