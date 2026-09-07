export interface CameraOptions {
  /** A specific device to use, from `listVideoInputDevices`. Takes precedence over `facingMode`. */
  deviceId?: string;
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

export async function startCamera(video: HTMLVideoElement, options: CameraOptions = {}): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      ...(options.deviceId ? { deviceId: { exact: options.deviceId } } : { facingMode: options.facingMode ?? 'environment' }),
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

/**
 * Lists available cameras (built-in, external USB webcams, a phone connected as a webcam,
 * ...). Device labels are only populated once camera permission has been granted at least
 * once on this origin — before that, callers should still show the list (deviceId-only), it'll
 * just show generic labels until permission is granted.
 */
export async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
}
