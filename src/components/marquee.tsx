// packages/ai-ui/src/components/marquee.tsx
"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useElementSize } from "../hooks/use-element-size.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion.js";

export interface MarqueeProps extends Omit<ComponentProps<"div">, "children"> {
  children: ReactNode;
  /** Accessible name, such as "Our suppliers". */
  label: string;
  /** Direction the content travels. Vertical directions need a height on the marquee. */
  direction?: "left" | "right" | "up" | "down";
  /** Pixels per second. */
  speed?: number;
  /** Space between items and between repeats, in pixels. */
  gap?: number;
  /** Pauses while the pointer is over the marquee or focus is inside it. */
  pauseOnHover?: boolean;
  /** Fades the leading and trailing edges. */
  fade?: boolean;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
}

/**
 * Continuously scrolling strip of logos, announcements or cards, in any of
 * four directions at a set speed. It pauses on hover and focus and has a
 * visible pause button; the repeated copies that make the loop seamless
 * are hidden from assistive technology and inert. Under reduced motion it
 * shows the items as a static wrapped list instead.
 */
export function Marquee({
  children,
  label,
  direction = "left",
  speed = 40,
  gap = 32,
  pauseOnHover = true,
  fade = true,
  paused,
  defaultPaused = false,
  onPausedChange,
  className,
  ...props
}: MarqueeProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [isPaused, setPaused] = useControllableState({ value: paused, defaultValue: defaultPaused, onChange: onPausedChange });
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [viewportRef, viewport] = useElementSize<HTMLDivElement>();
  const [contentRef, content] = useElementSize<HTMLDivElement>();
  const track = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const vertical = direction === "up" || direction === "down";
  const period = vertical ? content.height : content.width;
  const span = vertical ? viewport.height : viewport.width;
  const copies = period > 0 ? Math.max(2, Math.ceil(span / period) + 1) : 2;
  const running = !reducedMotion && !isPaused && !(pauseOnHover && (hovered || focusWithin)) && period > 0 && speed > 0;

  useEffect(() => {
    const element = track.current;
    if (!element || reducedMotion || period <= 0) return;
    const forward = direction === "left" || direction === "up";
    const apply = () => {
      const distance = forward ? -offset.current : offset.current - period;
      element.style.transform = vertical ? `translate3d(0, ${distance}px, 0)` : `translate3d(${distance}px, 0, 0)`;
    };
    offset.current %= period;
    apply();
    if (!running || typeof requestAnimationFrame === "undefined") return;
    let frame = 0;
    let last: number | null = null;
    const step = (time: number) => {
      if (last !== null) offset.current = (offset.current + ((time - last) / 1000) * speed) % period;
      last = time;
      apply();
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, period, speed, direction, vertical, reducedMotion]);

  if (reducedMotion) {
    return (
      <div role="group" aria-label={label} data-slot="marquee" data-static="" className={cn("flex flex-wrap items-center", vertical && "flex-col items-start", className)} style={{ gap }} {...props}>
        {children}
      </div>
    );
  }

  const fadeMask = vertical
    ? "[mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
    : "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]";

  return (
    <div
      role="group"
      aria-label={label}
      data-slot="marquee"
      data-running={running ? "" : undefined}
      className={cn("relative flex items-center gap-2", vertical && "flex-col items-stretch", className)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={(event) => {
        if (!(event.target instanceof HTMLElement && event.target.dataset.marqueeToggle !== undefined)) setFocusWithin(true);
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node && event.currentTarget.contains(next)) || (next instanceof HTMLElement && next.dataset.marqueeToggle !== undefined)) setFocusWithin(false);
      }}
      {...props}
    >
      <div ref={viewportRef} className={cn("min-w-0 flex-1 overflow-hidden", vertical && "min-h-0", fade && fadeMask)}>
        <div ref={track} data-slot="marquee-track" className={cn("flex will-change-transform", vertical ? "h-max flex-col" : "w-max")}>
          {Array.from({ length: copies }, (_, copy) => (
            <div
              key={copy}
              ref={copy === 0 ? contentRef : undefined}
              aria-hidden={copy === 0 ? undefined : true}
              inert={copy !== 0}
              data-slot={copy === 0 ? "marquee-content" : "marquee-copy"}
              className={cn("flex shrink-0 items-center", vertical && "flex-col")}
              style={{ gap }}
            >
              {children}
              <span aria-hidden="true" className="shrink-0" style={vertical ? { height: 0 } : { width: 0 }} />
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        data-marquee-toggle=""
        aria-label={isPaused ? `Play ${label}` : `Pause ${label}`}
        onClick={() => setPaused(!isPaused)}
        className={cn("inline-flex size-8 shrink-0 items-center justify-center self-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-4", focusRing)}
      >
        {isPaused ? <PlayIcon aria-hidden="true" /> : <PauseIcon aria-hidden="true" />}
      </button>
    </div>
  );
}
