// packages/ai-ui/src/components/region-capture.tsx
"use client";

import { CameraIcon } from "lucide-react";
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { captureElementRegion, type CaptureOptions, type CaptureRegion, regionFromPoints } from "../lib/region-capture.js";

export interface RegionCaptureProps {
  children: ReactNode;
  /** Selection mode is on. */
  active?: boolean;
  defaultActive?: boolean;
  onActiveChange?: (active: boolean) => void;
  /** Receives the image and the area relative to the wrapped content. */
  onCapture: (image: Blob, region: CaptureRegion) => void;
  onError?: (error: Error) => void;
  /** Replaces screen capture, e.g. to render the region another way or in tests. */
  capture?: (element: HTMLElement, region: CaptureRegion, options: CaptureOptions) => Promise<Blob>;
  options?: CaptureOptions;
  className?: string;
}

const MIN_DRAG = 8;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Wraps content, such as a preview, so the user can drag out an area and
 * get a screenshot of it, or capture all of it from the keyboard; Escape
 * cancels. The overlay hides before capturing so it never appears in the
 * image.
 */
export function RegionCapture({ children, active: activeProp, defaultActive = false, onActiveChange, onCapture, onError, capture = captureElementRegion, options = {}, className }: RegionCaptureProps) {
  const [active, setActive] = useControllableState({ value: activeProp, defaultValue: defaultActive, onChange: onActiveChange });
  const [selection, setSelection] = useState<CaptureRegion | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (active && !capturing) overlayRef.current?.focus();
  }, [active, capturing]);

  const finish = () => {
    start.current = null;
    setSelection(null);
    setActive(false);
  };

  const run = async (region: CaptureRegion) => {
    const element = rootRef.current;
    if (!element) return;
    setCapturing(true);
    setMessage("Capturing…");
    await nextFrame();
    await nextFrame();
    try {
      const image = await capture(element, region, options);
      onCapture(image, region);
      setMessage("Area captured");
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      setMessage(error.name === "NotAllowedError" ? "Capture canceled" : `Couldn't capture: ${error.message}`);
      onError?.(error);
    } finally {
      setCapturing(false);
      finish();
    }
  };

  const point = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const bounds = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  };

  const captureAll = () => {
    const size = bounds();
    void run({ x: 0, y: 0, width: size.width, height: size.height });
  };

  return (
    <div ref={rootRef} data-slot="region-capture" className={cn("relative", className)}>
      {children}
      {active && !capturing && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="false"
          aria-label="Select an area to capture"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              finish();
            } else if (event.key === "Enter" && event.target === event.currentTarget) {
              event.preventDefault();
              captureAll();
            }
          }}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            start.current = point(event);
            setSelection({ ...start.current, width: 0, height: 0 });
          }}
          onPointerMove={(event) => {
            if (!start.current) return;
            setSelection(regionFromPoints(start.current, point(event), bounds()));
          }}
          onPointerUp={(event) => {
            if (!start.current) return;
            const region = regionFromPoints(start.current, point(event), bounds());
            start.current = null;
            if (region.width < MIN_DRAG || region.height < MIN_DRAG) {
              setSelection(null);
              return;
            }
            void run(region);
          }}
          className={cn("absolute inset-0 z-20 cursor-crosshair touch-none outline-none select-none", !selection && "bg-black/40")}
        >
          {selection && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute border-2 border-background shadow-[0_0_0_9999px_rgb(0_0_0/0.4)]"
              style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }}
            >
              <span className="absolute -top-6 left-0 rounded bg-foreground px-1.5 font-mono text-xs text-background tabular-nums">
                {Math.round(selection.width)} × {Math.round(selection.height)}
              </span>
            </span>
          )}
          {!selection && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
                <CameraIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                <span>Drag to select an area</span>
                <button type="button" onClick={captureAll} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
                  Capture all
                </button>
                <button type="button" onClick={finish} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <span role="status" className="sr-only">
        {message}
      </span>
    </div>
  );
}
