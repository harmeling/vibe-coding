import { describe, expect, it } from 'vitest';
import {
  advance,
  classifyBuffer,
  classifyLuminance,
  createInitialState,
  intersectionPoints,
  sampleLuminance,
} from './gridEngine';
import type { PixelBuffer } from '../types';

function solidBuffer(width: number, height: number, gray: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = gray;
    data[i * 4 + 1] = gray;
    data[i * 4 + 2] = gray;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function paintPatch(buffer: PixelBuffer, cx: number, cy: number, radius: number, gray: number): void {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) continue;
      const idx = (y * buffer.width + x) * 4;
      buffer.data[idx] = gray;
      buffer.data[idx + 1] = gray;
      buffer.data[idx + 2] = gray;
      buffer.data[idx + 3] = 255;
    }
  }
}

describe('intersectionPoints', () => {
  it('places a 3x3 grid at the four corners and center, inset by the margin', () => {
    const points = intersectionPoints(3, 100, 100, 10);
    expect(points).toHaveLength(9);
    expect(points[0]).toEqual({ x: 10, y: 10 }); // top-left
    expect(points[2]).toEqual({ x: 90, y: 10 }); // top-right
    expect(points[4]).toEqual({ x: 50, y: 50 }); // center
    expect(points[8]).toEqual({ x: 90, y: 90 }); // bottom-right
  });
});

describe('sampleLuminance', () => {
  it('averages a uniform patch to its gray value', () => {
    const buffer = solidBuffer(20, 20, 128);
    expect(sampleLuminance(buffer, { x: 10, y: 10 }, 2)).toBeCloseTo(128, 5);
  });

  it('clamps the patch to the buffer bounds near an edge', () => {
    const buffer = solidBuffer(20, 20, 200);
    expect(sampleLuminance(buffer, { x: 0, y: 0 }, 3)).toBeCloseTo(200, 5);
  });
});

describe('classifyLuminance', () => {
  const thresholds = { high: 180, low: 80, alpha: 20 };

  it('classifies a bright reading as white', () => {
    expect(classifyLuminance(220, 128, thresholds)).toBe('white');
  });

  it('classifies a dark reading as black', () => {
    expect(classifyLuminance(30, 128, thresholds)).toBe('black');
  });

  it('classifies a reading near the baseline as empty', () => {
    expect(classifyLuminance(135, 128, thresholds)).toBe('empty');
  });
});

describe('classifyBuffer', () => {
  it('samples and classifies every intersection in one pass', () => {
    const buffer = solidBuffer(40, 40, 128); // empty-board baseline everywhere
    paintPatch(buffer, 10, 10, 2, 230); // a white stone at the first intersection
    paintPatch(buffer, 30, 10, 2, 20); // a black stone at the second

    const points = intersectionPoints(2, 40, 40, 10);
    const baselines = [128, 128, 128, 128];
    const result = classifyBuffer(buffer, points, baselines, 2, { high: 180, low: 80, alpha: 20 });

    expect(result).toEqual(['white', 'black', 'empty', 'empty']);
  });
});

describe('advance (two-snapshot confirmation debounce)', () => {
  it('does not confirm a transient single-snapshot flip (simulated hand occlusion)', () => {
    let state = createInitialState(3); // all empty
    ({ state } = advance(state, ['black', 'empty', 'empty']));
    expect(state.confirmed[0]).toBe('empty'); // not confirmed yet

    ({ state } = advance(state, ['empty', 'empty', 'empty'])); // hand moved away again
    expect(state.confirmed[0]).toBe('empty'); // never confirmed
    expect(state.pending[0]).toBeNull();
  });

  it('confirms a change sustained across two consecutive snapshots', () => {
    let state = createInitialState(3);
    const first = advance(state, ['black', 'empty', 'empty']);
    state = first.state;
    expect(first.changedIndices).toEqual([]);

    const second = advance(state, ['black', 'empty', 'empty']);
    state = second.state;
    expect(second.changedIndices).toEqual([0]);
    expect(state.confirmed[0]).toBe('black');
  });

  it('confirms a capture (stone -> empty) the same way', () => {
    let state = createInitialState(3);
    state = advance(state, ['black', 'empty', 'empty']).state;
    state = advance(state, ['black', 'empty', 'empty']).state; // stone confirmed placed
    expect(state.confirmed[0]).toBe('black');

    state = advance(state, ['empty', 'empty', 'empty']).state; // removed once
    expect(state.confirmed[0]).toBe('black'); // not confirmed yet
    const result = advance(state, ['empty', 'empty', 'empty']); // removed twice in a row
    expect(result.changedIndices).toEqual([0]);
    expect(result.state.confirmed[0]).toBe('empty');
  });
});
