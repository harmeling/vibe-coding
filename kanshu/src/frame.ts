import type { PixelBuffer } from './types';

let scratchCanvas: HTMLCanvasElement | null = null;

/** Grabs the current video frame at its native resolution as a plain, warp/classify-ready buffer. */
export function captureVideoFrame(video: HTMLVideoElement): PixelBuffer {
  const width = video.videoWidth;
  const height = video.videoHeight;

  scratchCanvas ??= document.createElement('canvas');
  if (scratchCanvas.width !== width) scratchCanvas.width = width;
  if (scratchCanvas.height !== height) scratchCanvas.height = height;

  const ctx = scratchCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(video, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}

export function drawPixelBuffer(canvas: HTMLCanvasElement, buffer: PixelBuffer): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (canvas.width !== buffer.width) canvas.width = buffer.width;
  if (canvas.height !== buffer.height) canvas.height = buffer.height;
  ctx.putImageData(new ImageData(buffer.data, buffer.width, buffer.height), 0, 0);
}
