import { describe, expect, it } from 'vitest';
import { formatCaptures, formatTurn } from './hud';

describe('formatTurn', () => {
  it('formats each color', () => {
    expect(formatTurn('black')).toBe('Black to play');
    expect(formatTurn('white')).toBe('White to play');
  });
});

describe('formatCaptures', () => {
  it('formats both counts', () => {
    expect(formatCaptures(0, 0)).toBe('Captures — Black: 0, White: 0');
    expect(formatCaptures(2, 5)).toBe('Captures — Black: 2, White: 5');
  });
});
