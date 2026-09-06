let sharedContext: AudioContext | null = null;

/**
 * Synthesizes a short click tone via WebAudio rather than shipping an audio asset — this is a
 * single-file-ish app and the sound doesn't need to be more than "a click".
 */
export function playClick(enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') return;
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return;

  sharedContext ??= new AudioContextCtor();
  const ctx = sharedContext;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.08);
}
