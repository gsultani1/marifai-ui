// packages/ai-ui/src/lib/region-capture.ts
/** A rectangle in CSS pixels. */
export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureOptions {
  type?: "image/png" | "image/jpeg" | "image/webp";
  /** 0 to 1 for lossy types. */
  quality?: number;
}

/** Normalizes a drag from one corner to the other into a rectangle with positive size, kept inside `bounds`. */
export function regionFromPoints(start: { x: number; y: number }, end: { x: number; y: number }, bounds: { width: number; height: number }): CaptureRegion {
  const clampX = (value: number) => Math.min(Math.max(value, 0), bounds.width);
  const clampY = (value: number) => Math.min(Math.max(value, 0), bounds.height);
  const x1 = clampX(Math.min(start.x, end.x));
  const y1 = clampY(Math.min(start.y, end.y));
  const x2 = clampX(Math.max(start.x, end.x));
  const y2 = clampY(Math.max(start.y, end.y));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Maps a viewport rectangle onto a captured frame of the tab. The frame
 * shows the viewport from its top-left corner at one scale (the device
 * pixel ratio, or less when the browser downsizes the capture); a frame
 * cut short by browser chrome clips the region rather than stretching it.
 */
export function regionToFrameRect(region: CaptureRegion, viewport: { width: number; height: number }, frame: { width: number; height: number }): CaptureRegion {
  const scale = frame.width / viewport.width;
  const x = Math.min(frame.width - 1, Math.max(0, Math.round(region.x * scale)));
  const y = Math.min(frame.height - 1, Math.max(0, Math.round(region.y * scale)));
  return {
    x,
    y,
    width: Math.max(1, Math.min(frame.width - x, Math.round(region.width * scale))),
    height: Math.max(1, Math.min(frame.height - y, Math.round(region.height * scale))),
  };
}

async function captureStep<T>(operation: Promise<T>, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Screen capture timed out while ${stage}. Try capturing again.`)), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function nextFrame(): Promise<void> {
  let frame = 0;
  try {
    await captureStep(new Promise<void>((resolve) => {
      frame = requestAnimationFrame(() => resolve());
    }), "waiting for a frame");
  } finally {
    cancelAnimationFrame(frame);
  }
}

/**
 * Screenshots part of the page through screen capture of the current tab,
 * which also captures cross-origin preview frames that can't be drawn any
 * other way. The browser asks the user to share this tab first
 * (`preferCurrentTab` limits the prompt to it in Chromium).
 * `getRegion` runs once sharing starts, so the rectangle reflects any
 * layout shift from the browser's sharing bar.
 */
export async function captureViewportRegion(getRegion: () => CaptureRegion, { type = "image/png", quality }: CaptureOptions = {}): Promise<Blob> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) throw new Error("This browser can't capture the screen.");
  const options = { video: { displaySurface: "browser" }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include" } as DisplayMediaStreamOptions;
  const stream = await navigator.mediaDevices.getDisplayMedia(options);
  let video: HTMLVideoElement | undefined;
  try {
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await captureStep(video.play(), "starting video playback");
    await nextFrame();
    await nextFrame();
    const frame = { width: video.videoWidth, height: video.videoHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    if (!frame.width || !frame.height) throw new Error("The capture produced an empty image.");
    const rect = regionToFrameRect(getRegion(), viewport, frame);
    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can't draw the capture.");
    context.drawImage(video, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return await captureStep(new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The capture couldn't be encoded."))), type, quality)), "encoding the image");
  } finally {
    for (const track of stream.getTracks()) track.stop();
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }
}

/** Screenshots an element, or `region` of it in coordinates relative to its top-left corner. */
export function captureElementRegion(element: Element, region?: CaptureRegion, options?: CaptureOptions): Promise<Blob> {
  return captureViewportRegion(() => {
    const rect = element.getBoundingClientRect();
    return region ? { x: rect.left + region.x, y: rect.top + region.y, width: region.width, height: region.height } : { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }, options);
}
