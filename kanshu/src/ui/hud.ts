import type { StoneColor } from '../types';

export interface HudState {
  turn: StoneColor;
  lastMoveDescription: string | null;
  blackCaptures: number;
  whiteCaptures: number;
}

export function formatTurn(turn: StoneColor): string {
  return turn === 'black' ? 'Black to play' : 'White to play';
}

export function formatCaptures(blackCaptures: number, whiteCaptures: number): string {
  return `Captures — Black: ${blackCaptures}, White: ${whiteCaptures}`;
}

export interface HudElements {
  turn: HTMLElement;
  lastMove: HTMLElement;
  captures: HTMLElement;
}

export function updateHud(elements: HudElements, state: HudState): void {
  elements.turn.textContent = formatTurn(state.turn);
  elements.lastMove.textContent = state.lastMoveDescription ?? 'No moves yet';
  elements.captures.textContent = formatCaptures(state.blackCaptures, state.whiteCaptures);
}
