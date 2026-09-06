import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  clearCalibration,
  clearSgfText,
  loadCalibration,
  loadSettings,
  loadSgfText,
  saveCalibration,
  saveSettings,
  saveSgfText,
} from './storage';
import type { CalibrationData } from './storage';

/** Minimal in-memory Storage stub so this whole module is testable without a browser. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const sampleCalibration: CalibrationData = {
  matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  boardSize: 19,
  points: [
    { x: 10, y: 10 },
    { x: 90, y: 12 },
    { x: 92, y: 88 },
    { x: 8, y: 90 },
  ],
};

describe('calibration storage', () => {
  it('round-trips through save/load', () => {
    const storage = new MemoryStorage();
    saveCalibration(sampleCalibration, storage);
    expect(loadCalibration(storage)).toEqual(sampleCalibration);
  });

  it('returns null when nothing has been saved', () => {
    expect(loadCalibration(new MemoryStorage())).toBeNull();
  });

  it('clears a saved calibration', () => {
    const storage = new MemoryStorage();
    saveCalibration(sampleCalibration, storage);
    clearCalibration(storage);
    expect(loadCalibration(storage)).toBeNull();
  });

  it('ignores data written under a different schema version', () => {
    const storage = new MemoryStorage();
    storage.setItem('kanshu:calibration', JSON.stringify({ version: 999, value: sampleCalibration }));
    expect(loadCalibration(storage)).toBeNull();
  });

  it('ignores corrupt JSON rather than throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem('kanshu:calibration', '{not json');
    expect(loadCalibration(storage)).toBeNull();
  });
});

describe('settings storage', () => {
  it('falls back to defaults when nothing has been saved', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a custom settings object', () => {
    const storage = new MemoryStorage();
    const custom = { ...DEFAULT_SETTINGS, snapshotIntervalMs: 5_000, voiceAnnouncements: true };
    saveSettings(custom, storage);
    expect(loadSettings(storage)).toEqual(custom);
  });
});

describe('SGF text storage', () => {
  it('round-trips through save/load and clears', () => {
    const storage = new MemoryStorage();
    const sgf = '(;GM[1]FF[4]SZ[9];B[aa])';
    saveSgfText(sgf, storage);
    expect(loadSgfText(storage)).toBe(sgf);
    clearSgfText(storage);
    expect(loadSgfText(storage)).toBeNull();
  });
});
