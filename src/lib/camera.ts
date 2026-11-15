// packages/ai-ui/src/lib/camera.ts
const CAMERA_MESSAGES: Record<string, string> = {
  NotAllowedError: "Camera access is blocked. Allow it in your browser's site settings.",
  NotFoundError: "No camera was found on this device.",
  OverconstrainedError: "No camera was found on this device.",
  NotReadableError: "The camera is in use by another app. Close it and try again.",
  SecurityError: "The camera needs a secure (https) page.",
  AbortError: "The camera stopped unexpectedly. Try again.",
};

/** Plain-language message for a getUserMedia failure, with an optional next step such as "Or type the code below." */
export function cameraErrorMessage(error: unknown, fallback?: string): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  const message = CAMERA_MESSAGES[name] ?? "The camera couldn't start.";
  return fallback ? `${message} ${fallback}` : message;
}

/** True when the user dismissed a permission or picker prompt, which should not be reported as an error. */
export function isUserCancel(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError");
}

/**
 * Opens a camera, preferring the given facing mode at 1280×720 and falling
 * back to any camera when that is not available.
 */
export async function openCamera(facingMode: "environment" | "user" = "environment"): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "OverconstrainedError" || error.name === "NotFoundError")) return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    throw error;
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Draws the current video frame to a canvas and returns it as a Blob. */
export async function captureVideoFrame(video: HTMLVideoElement, type = "image/jpeg", quality = 0.8): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || !canvas.width) throw new Error("The camera image isn't ready yet");
  context.drawImage(video, 0, 0);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't capture the image"))), type, quality));
}
