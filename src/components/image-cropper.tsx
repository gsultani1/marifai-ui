// packages/ai-ui/src/components/image-cropper.tsx
"use client";

import { type ComponentProps, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useId, useRef, useState } from "react";

import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { safeImageSrc } from "../lib/safe-url.js";

export interface CropArea {
  /** In source image pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageCropperProps extends Omit<ComponentProps<"div">, "onError"> {
  src: string;
  alt: string;
  /** Width over height of the crop; 1 for avatars. */
  aspect?: number;
  shape?: "rect" | "round";
  maxZoom?: number;
  /** Width of the output image in pixels. */
  outputWidth?: number;
  outputType?: "image/png" | "image/jpeg" | "image/webp";
  onCrop: (blob: Blob, area: CropArea) => void | Promise<void>;
  onCancel?: () => void;
  applyLabel?: string;
  /** Set when the image is served with CORS headers so it can be exported from another origin. */
  crossOrigin?: "anonymous" | "use-credentials";
}

/** Crop rectangle in source pixels for an image at `scale` offset by (ox, oy) from the frame center. */
export function cropAreaFor(natural: { width: number; height: number }, frame: { width: number; height: number }, scale: number, offset: { x: number; y: number }): CropArea {
  const left = frame.width / 2 + offset.x - (natural.width * scale) / 2;
  const top = frame.height / 2 + offset.y - (natural.height * scale) / 2;
  return { x: Math.max(0, -left / scale), y: Math.max(0, -top / scale), width: Math.min(natural.width, frame.width / scale), height: Math.min(natural.height, frame.height / scale) };
}

function clampOffset(offset: { x: number; y: number }, natural: { width: number; height: number }, frame: { width: number; height: number }, scale: number) {
  const maxX = Math.max(0, (natural.width * scale - frame.width) / 2);
  const maxY = Math.max(0, (natural.height * scale - frame.height) / 2);
  return { x: Math.min(maxX, Math.max(-maxX, offset.x)), y: Math.min(maxY, Math.max(-maxY, offset.y)) };
}

/**
 * Crops an image to a fixed aspect: drag or use arrow keys to position,
 * the slider, wheel or +/− to zoom. The image always covers the frame.
 * Produces a Blob at `outputWidth`; images from other origins without CORS
 * cannot be exported and report an error.
 */
export function ImageCropper({ src, alt, aspect = 1, shape = "rect", maxZoom = 4, outputWidth = 512, outputType = "image/png", onCrop, onCancel, applyLabel = "Apply", crossOrigin, className, ...props }: ImageCropperProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; offset: { x: number; y: number } } | null>(null);
  const [stage, setStage] = useState({ width: 360, height: 360 });
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const safeSrc = safeImageSrc(src);

  useEffect(() => {
    const element = stageRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setStage({ width: element.clientWidth || 360, height: element.clientHeight || 360 }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const frameWidth = Math.min(stage.width * 0.86, stage.height * 0.86 * aspect);
  const frame = { width: frameWidth, height: frameWidth / aspect };
  const baseScale = natural ? Math.max(frame.width / natural.width, frame.height / natural.height) : 1;
  const scale = baseScale * zoom;
  const clamped = natural ? clampOffset(offset, natural, frame, scale) : offset;

  const setZoomClamped = (next: number) => {
    const value = Math.min(maxZoom, Math.max(1, next));
    setZoom(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 20 : 4;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setOffset({ x: clamped.x + move[0], y: clamped.y + move[1] });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoomClamped(zoom + 0.1);
    } else if (event.key === "-") {
      event.preventDefault();
      setZoomClamped(zoom - 0.1);
    }
  };

  const apply = async () => {
    const image = imageRef.current;
    if (!natural || !image || pending) return;
    setError(null);
    const area = cropAreaFor(natural, frame, scale, clamped);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(outputWidth);
    canvas.height = Math.round(outputWidth / aspect);
    const context = canvas.getContext("2d");
    if (!context) {
      setError("This browser cannot crop images.");
      return;
    }
    if (shape === "round") {
      context.beginPath();
      context.ellipse(canvas.width / 2, canvas.height / 2, canvas.width / 2, canvas.height / 2, 0, 0, Math.PI * 2);
      context.clip();
    }
    try {
      context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, shape === "round" ? "image/png" : outputType, 0.92));
      if (!blob) throw new Error("empty");
      setPending(true);
      await onCrop(blob, area);
    } catch {
      setError("The cropped image could not be created. Images from other sites may block it.");
    } finally {
      setPending(false);
    }
  };

  const imageLeft = stage.width / 2 + clamped.x - ((natural?.width ?? 0) * scale) / 2;
  const imageTop = stage.height / 2 + clamped.y - ((natural?.height ?? 0) * scale) / 2;

  return (
    <div data-slot="image-cropper" className={cn("flex flex-col gap-3 text-sm", className)} {...props}>
      <div
        ref={stageRef}
        role="application"
        aria-roledescription="image cropper"
        aria-label={`Crop ${alt}`}
        aria-describedby={`${id}-help`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onWheel={(event) => setZoomClamped(zoom - event.deltaY * 0.002)}
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, offset: clamped };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (start) setOffset({ x: start.offset.x + event.clientX - start.x, y: start.offset.y + event.clientY - start.y });
        }}
        onPointerUp={() => {
          drag.current = null;
          if (natural) setOffset(clampOffset(offset, natural, frame, scale));
        }}
        className={cn("relative h-72 touch-none overflow-hidden rounded-lg bg-neutral-900 select-none", focusRing, "cursor-move")}
      >
        {safeSrc ? (
          <img
            ref={imageRef}
            src={safeSrc}
            alt=""
            crossOrigin={crossOrigin}
            draggable={false}
            onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => setError("The image could not be loaded.")}
            className="pointer-events-none absolute max-w-none origin-top-left"
            style={natural ? { left: imageLeft, top: imageTop, width: natural.width * scale, height: natural.height * scale } : { opacity: 0 }}
          />
        ) : (
          <p className="p-4 text-white/80">This image address is not allowed.</p>
        )}
        <div
          aria-hidden="true"
          className={cn("pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]", shape === "round" && "rounded-full")}
          style={{ width: frame.width, height: frame.height }}
        />
      </div>
      <p id={`${id}-help`} className="sr-only">
        Drag or use the arrow keys to position the image. Use the zoom slider, the mouse wheel, or plus and minus to zoom.
      </p>
      <label className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Zoom</span>
        <input type="range" min={1} max={maxZoom} step={0.01} value={zoom} onChange={(event) => setZoomClamped(Number(event.target.value))} className={cn("flex-1 accent-primary", focusRing)} />
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={cn(button, buttonVariants.outline, focusRing)}>
            Cancel
          </button>
        )}
        <button type="button" aria-disabled={!natural || pending || undefined} onClick={() => void apply()} className={cn(button, buttonVariants.primary, focusRing)}>
          {applyLabel}
        </button>
      </div>
    </div>
  );
}
