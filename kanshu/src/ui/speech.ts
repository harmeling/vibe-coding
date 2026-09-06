import { formatBoardCoordinate } from '../game/coords';
import type { StoneColor } from '../types';

export function buildMoveAnnouncement(color: StoneColor, index: number, boardSize: number, capturedCount: number): string {
  const base = `${color === 'black' ? 'Black' : 'White'} plays at ${formatBoardCoordinate(index, boardSize)}`;
  if (capturedCount === 0) return base;
  return `${base}, capturing ${capturedCount} stone${capturedCount === 1 ? '' : 's'}`;
}

/** No-op when disabled or the API is unavailable, so callers don't need to feature-detect. */
export function speak(text: string, enabled: boolean): void {
  if (!enabled) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
