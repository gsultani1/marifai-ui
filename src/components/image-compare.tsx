// packages/ai-ui/src/components/image-compare.tsx
"use client";

import { useId, useState } from "react";

import { cn } from "../lib/cn.js";
import { SegmentedControl } from "./segmented-control.js";

export interface CompareImage {
  src: string;
  alt: string;
  /** Caption such as "Before" or "v2". */
  label?: string;
}

export type ImageCompareMode = "slider" | "side-by-side" | "overlay";

export interface ImageCompareProps {
  before: CompareImage;
  after: CompareImage;
  defaultMode?: ImageCompareMode;
  /** Width over height, e.g. 16 / 9. */
  aspectRatio?: number;
  className?: string;
}

/** Before and after images compared with a draggable divider, side by side or as a fading overlay; the divider and fade are keyboard sliders. */
export function ImageCompare({ before, after, defaultMode = "slider", aspectRatio = 16 / 10, className }: ImageCompareProps) {
  const [mode, setMode] = useState<ImageCompareMode>(defaultMode);
  const [position, setPosition] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const id = useId();
  const beforeLabel = before.label ?? "Before";
  const afterLabel = after.label ?? "After";
  const frame = "relative w-full overflow-hidden rounded-lg border border-border bg-muted";

  return (
    <div data-slot="image-compare" className={cn("flex flex-col gap-2", className)}>
      <SegmentedControl
        label="Compare"
        size="sm"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "slider", label: "Slider" },
          { value: "side-by-side", label: "Side by side" },
          { value: "overlay", label: "Overlay" },
        ]}
        className="self-start"
      />
      {mode === "side-by-side" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[before, after].map((image, index) => (
            <figure key={index} className="flex flex-col gap-1">
              <div className={frame} style={{ aspectRatio }}>
                <img src={image.src} alt={image.alt} className="absolute inset-0 size-full object-contain" />
              </div>
              <figcaption className="text-xs text-muted-foreground">{index === 0 ? beforeLabel : afterLabel}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={frame} style={{ aspectRatio }}>
            <img src={after.src} alt={after.alt} className="absolute inset-0 size-full object-contain" />
            <img
              src={before.src}
              alt={before.alt}
              className="absolute inset-0 size-full object-contain"
              style={mode === "slider" ? { clipPath: `inset(0 ${100 - position}% 0 0)` } : { opacity: (100 - opacity) / 100 }}
            />
            {mode === "slider" && (
              <>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={position}
                  onChange={(event) => setPosition(Number(event.target.value))}
                  aria-label={`Divider between ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
                  aria-valuetext={`${position}% ${beforeLabel.toLowerCase()}`}
                  className="peer absolute inset-0 z-10 size-full cursor-ew-resize opacity-0"
                />
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-background shadow-[0_0_0_1px_var(--border)] peer-focus-visible:w-1 peer-focus-visible:bg-ring" style={{ left: `${position}%` }} />
                <span aria-hidden="true" className="pointer-events-none absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background shadow-md peer-focus-visible:ring-2 peer-focus-visible:ring-ring" style={{ left: `${position}%` }} />
                <span aria-hidden="true" className="pointer-events-none absolute top-2 left-2 rounded bg-background/90 px-1.5 text-xs font-medium">
                  {beforeLabel}
                </span>
                <span aria-hidden="true" className="pointer-events-none absolute top-2 right-2 rounded bg-background/90 px-1.5 text-xs font-medium">
                  {afterLabel}
                </span>
              </>
            )}
          </div>
          {mode === "overlay" && (
            <label htmlFor={`${id}-fade`} className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{beforeLabel}</span>
              <input id={`${id}-fade`} type="range" min={0} max={100} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} aria-valuetext={`${opacity}% ${afterLabel.toLowerCase()}`} className="flex-1 accent-primary" />
              <span className="text-muted-foreground">{afterLabel}</span>
              <span className="sr-only">Fade between {beforeLabel.toLowerCase()} and {afterLabel.toLowerCase()}</span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
