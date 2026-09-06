import { describe, expect, it } from 'vitest';
import { buildMoveAnnouncement } from './speech';

describe('buildMoveAnnouncement', () => {
  it('announces a plain move with no captures', () => {
    expect(buildMoveAnnouncement('black', 0, 19, 0)).toBe('Black plays at A19');
  });

  it('pluralizes captures correctly', () => {
    expect(buildMoveAnnouncement('white', 8, 19, 1)).toBe('White plays at J19, capturing 1 stone');
    expect(buildMoveAnnouncement('white', 8, 19, 3)).toBe('White plays at J19, capturing 3 stones');
  });
});
