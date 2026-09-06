import { describe, expect, it } from 'vitest';
import { orderCorners } from './orderCorners';

describe('orderCorners', () => {
  const topLeft = { x: 10, y: 10 };
  const topRight = { x: 100, y: 12 };
  const bottomRight = { x: 98, y: 100 };
  const bottomLeft = { x: 8, y: 96 };

  it('leaves an already-ordered quad unchanged', () => {
    expect(orderCorners([topLeft, topRight, bottomRight, bottomLeft])).toEqual([
      topLeft,
      topRight,
      bottomRight,
      bottomLeft,
    ]);
  });

  it('re-orders an arbitrarily shuffled click order back to TL, TR, BR, BL', () => {
    expect(orderCorners([bottomRight, topLeft, bottomLeft, topRight])).toEqual([
      topLeft,
      topRight,
      bottomRight,
      bottomLeft,
    ]);
  });
});
