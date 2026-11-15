// packages/ai-ui/src/components/slide-deck.tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon, MonitorPlayIcon, StickyNoteIcon, XIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { MessageContent } from "./message-content.js";

export interface Slide {
  id: string;
  /** Used for the thumbnail label and announcements. */
  title?: string;
  content: ReactNode;
  notes?: ReactNode;
  /** CSS background of the slide. */
  background?: string;
}

/**
 * Splits markdown into slides on lines containing only `---`; text after a
 * line starting with `Note:` becomes speaker notes. The first heading of each
 * slide is its title.
 */
export function slidesFromMarkdown(markdown: string): Slide[] {
  return markdown
    .split(/^\s*---\s*$/m)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const [body, ...noteParts] = part.split(/^Note:\s*/im);
      const title = /^#{1,6}\s+(.+)$/m.exec(body ?? "")?.[1]?.trim();
      const notes = noteParts.join("\n").trim();
      return {
        id: `slide-${index + 1}`,
        ...(title ? { title } : {}),
        content: <MessageContent className="text-[1.6em] leading-snug [&_h1]:text-[2.2em] [&_h2]:text-[1.7em]">{(body ?? "").trim()}</MessageContent>,
        ...(notes ? { notes: <MessageContent>{notes}</MessageContent> } : {}),
      };
    });
}

export interface SlideDeckProps extends Omit<ComponentProps<"section">, "children"> {
  slides: Slide[];
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Width over height of every slide. */
  aspectRatio?: number;
  /** Logical slide width the content is laid out at before scaling. */
  baseWidth?: number;
  label?: string;
  showThumbnails?: boolean;
}

function ScaledSlide({ slide, aspectRatio, baseWidth, className }: { slide: Slide; aspectRatio: number; baseWidth: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setScale(element.clientWidth / baseWidth || 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [baseWidth]);
  return (
    <div ref={ref} className={cn("relative w-full overflow-hidden bg-white text-neutral-900", className)} style={{ aspectRatio, background: slide.background }}>
      <div className="absolute top-0 left-0 origin-top-left p-[4%]" style={{ width: baseWidth, height: baseWidth / aspectRatio, transform: `scale(${scale})`, fontSize: baseWidth / 60 }}>
        {slide.content}
      </div>
    </div>
  );
}

/**
 * Slide viewer with a thumbnail rail, previous and next controls, a present
 * mode that fills the screen, and speaker notes. Arrow keys, Page Up/Down,
 * Space, Home and End move between slides; Escape leaves present mode.
 */
export function SlideDeck({ slides, index: indexProp, defaultIndex = 0, onIndexChange, aspectRatio = 16 / 9, baseWidth = 1280, label = "Slides", showThumbnails = true, className, ...props }: SlideDeckProps) {
  const [index, setIndex] = useControllableState({ value: indexProp, defaultValue: defaultIndex, onChange: onIndexChange });
  const [presenting, setPresenting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const count = slides.length;
  const current = Math.min(Math.max(0, index), Math.max(0, count - 1));
  const slide = slides[current];

  useEffect(() => {
    if (!presenting) return;
    const element = stageRef.current;
    element?.focus();
    const onChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [presenting]);

  const go = (next: number) => setIndex(Math.min(count - 1, Math.max(0, next)));

  const present = () => {
    setPresenting(true);
    const element = stageRef.current;
    element?.requestFullscreen?.().catch(() => undefined);
  };

  const stop = () => {
    setPresenting(false);
    if (document.fullscreenElement) void document.exitFullscreen?.();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return;
    const forward = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key);
    const back = ["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key);
    if (forward || back) {
      event.preventDefault();
      go(current + (forward ? 1 : -1));
    } else if (event.key === "Home") {
      event.preventDefault();
      go(0);
    } else if (event.key === "End") {
      event.preventDefault();
      go(count - 1);
    } else if (event.key === "Escape" && presenting) {
      event.preventDefault();
      stop();
    }
  };

  if (!slide) return <p className="text-sm text-muted-foreground">No slides yet.</p>;

  return (
    <section aria-label={label} aria-roledescription="slide deck" data-slot="slide-deck" onKeyDown={onKeyDown} className={cn("flex min-h-0 flex-col gap-2 text-sm", className)} {...props}>
      <div className="flex min-h-0 flex-1 gap-3">
        {showThumbnails && !presenting && (
          <ol aria-label="Slides" className="hidden w-36 shrink-0 flex-col gap-2 overflow-y-auto md:flex">
            {slides.map((item, position) => (
              <li key={item.id}>
                <button type="button" aria-current={position === current ? "true" : undefined} onClick={() => go(position)} className={cn("flex w-full flex-col gap-1 rounded-md text-left", focusRing)}>
                  <span aria-hidden="true" className={cn("block overflow-hidden rounded-md border-2", position === current ? "border-primary" : "border-border")}>
                    <ScaledSlide slide={item} aspectRatio={aspectRatio} baseWidth={baseWidth} className="pointer-events-none" />
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {position + 1}. {item.title ?? `Slide ${position + 1}`}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            ref={stageRef}
            tabIndex={-1}
            role="group"
            aria-roledescription="slide"
            aria-label={`${current + 1} of ${count}${slide.title ? `: ${slide.title}` : ""}`}
            className={cn("relative outline-none", presenting && "fixed inset-0 z-50 flex items-center justify-center bg-black p-4")}
          >
            <div className={cn("overflow-hidden rounded-lg border border-border shadow-sm", presenting && "w-full max-w-[calc((100dvh-2rem)*var(--deck-ratio))] border-0")} style={{ ["--deck-ratio" as string]: String(aspectRatio) }}>
              <ScaledSlide slide={slide} aspectRatio={aspectRatio} baseWidth={baseWidth} />
            </div>
            {presenting && (
              <div className="absolute right-4 bottom-4 flex items-center gap-2 rounded-full bg-black/60 px-2 py-1 text-white">
                <button type="button" aria-label="Previous slide" onClick={() => go(current - 1)} disabled={current === 0} className={cn("inline-flex size-8 items-center justify-center rounded-full hover:bg-white/20 disabled:opacity-40", focusRing)}>
                  <ChevronLeftIcon aria-hidden="true" className="size-4" />
                </button>
                <span className="text-xs tabular-nums">
                  {current + 1} / {count}
                </span>
                <button type="button" aria-label="Next slide" onClick={() => go(current + 1)} disabled={current === count - 1} className={cn("inline-flex size-8 items-center justify-center rounded-full hover:bg-white/20 disabled:opacity-40", focusRing)}>
                  <ChevronRightIcon aria-hidden="true" className="size-4" />
                </button>
                <button type="button" aria-label="Exit presentation" onClick={stop} className={cn("inline-flex size-8 items-center justify-center rounded-full hover:bg-white/20", focusRing)}>
                  <XIcon aria-hidden="true" className="size-4" />
                </button>
              </div>
            )}
          </div>
          {!presenting && (
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous slide" onClick={() => go(current - 1)} disabled={current === 0} className={cn(iconButton, focusRing)}>
                <ChevronLeftIcon aria-hidden="true" />
              </button>
              <span aria-live="polite" className="text-xs tabular-nums">
                Slide {current + 1} of {count}
              </span>
              <button type="button" aria-label="Next slide" onClick={() => go(current + 1)} disabled={current === count - 1} className={cn(iconButton, focusRing)}>
                <ChevronRightIcon aria-hidden="true" />
              </button>
              <span className="ml-auto flex gap-1">
                {slides.some((item) => item.notes) && (
                  <button type="button" aria-pressed={showNotes} aria-controls={showNotes ? `${id}-notes` : undefined} onClick={() => setShowNotes(!showNotes)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs hover:bg-accent aria-pressed:bg-accent", focusRing)}>
                    <StickyNoteIcon aria-hidden="true" className="size-4" />
                    Notes
                  </button>
                )}
                <button type="button" onClick={present} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground", focusRing)}>
                  <MonitorPlayIcon aria-hidden="true" className="size-4" />
                  Present
                </button>
              </span>
            </div>
          )}
          {showNotes && !presenting && (
            <div id={`${id}-notes`} role="region" aria-label="Speaker notes" className="rounded-md border border-border bg-muted/40 p-3">
              {slide.notes ?? <p className="text-muted-foreground">No notes for this slide.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
