import type { BoardSize, Matrix3x3, Point } from './types';

const NAMESPACE = 'kanshu';
const SCHEMA_VERSION = 1;

interface StoredEnvelope<T> {
  version: number;
  value: T;
}

function storageKey(name: string): string {
  return `${NAMESPACE}:${name}`;
}

/**
 * `storage` defaults to the browser's real `localStorage` but can be swapped for an in-memory
 * stub in tests, so this whole layer is unit-testable without a browser.
 */
function saveValue<T>(name: string, value: T, storage: Storage = localStorage): void {
  const envelope: StoredEnvelope<T> = { version: SCHEMA_VERSION, value };
  storage.setItem(storageKey(name), JSON.stringify(envelope));
}

function loadValue<T>(name: string, storage: Storage = localStorage): T | null {
  const raw = storage.getItem(storageKey(name));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as StoredEnvelope<T>;
    if (parsed.version !== SCHEMA_VERSION) return null; // stale schema from an older build; ignore
    return parsed.value;
  } catch {
    return null;
  }
}

function clearValue(name: string, storage: Storage = localStorage): void {
  storage.removeItem(storageKey(name));
}

export interface CalibrationData {
  matrix: Matrix3x3;
  boardSize: BoardSize;
  points: Point[];
}

export function saveCalibration(data: CalibrationData, storage?: Storage): void {
  saveValue('calibration', data, storage);
}

export function loadCalibration(storage?: Storage): CalibrationData | null {
  return loadValue('calibration', storage);
}

export function clearCalibration(storage?: Storage): void {
  clearValue('calibration', storage);
}

export interface Settings {
  snapshotIntervalMs: number;
  boardSize: BoardSize;
  voiceAnnouncements: boolean;
  clickSound: boolean;
  cameraFacingMode: 'user' | 'environment';
}

export const DEFAULT_SETTINGS: Settings = {
  snapshotIntervalMs: 1_000,
  boardSize: 19,
  voiceAnnouncements: false,
  clickSound: true,
  cameraFacingMode: 'environment',
};

export function saveSettings(settings: Settings, storage?: Storage): void {
  saveValue('settings', settings, storage);
}

export function loadSettings(storage?: Storage): Settings {
  return loadValue<Settings>('settings', storage) ?? DEFAULT_SETTINGS;
}

export function saveSgfText(text: string, storage?: Storage): void {
  saveValue('sgf', text, storage);
}

export function loadSgfText(storage?: Storage): string | null {
  return loadValue('sgf', storage);
}

export function clearSgfText(storage?: Storage): void {
  clearValue('sgf', storage);
}
