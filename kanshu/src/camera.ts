export interface CameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

export async function startCamera(video: HTMLVideoElement, options: CameraOptions = {}): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: options.facingMode ?? 'environment',
      ...(options.width ? { width: { ideal: options.width } } : {}),
      ...(options.height ? { height: { ideal: options.height } } : {}),
    },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
