// packages/ai-ui/src/components/carousel.tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import {
  Children,
  type ComponentProps,
  type FocusEvent,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useElementSize } from "../hooks/use-element-size.js";
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

/** Slides per view: a fixed number, or a map from minimum container width in pixels to slides per view. */
export type CarouselSlidesPerView = number | Record<number, number>;

/** Resolves responsive slides per view for a container width; the smallest breakpoint applies below every minimum. */
export function resolveSlidesPerView(value: CarouselSlidesPerView, width: number): number {
  if (typeof value === "number") return Math.max(1, Math.floor(value));
  const entries = Object.entries(value)
    .map(([minWidth, slides]) => [Number(minWidth), slides] as const)
    .filter(([minWidth, slides]) => Number.isFinite(minWidth) && Number.isFinite(slides))
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return 1;
  let result = entries[0]![1];
  for (const [minWidth, slides] of entries) if (width >= minWidth) result = slides;
  return Math.max(1, Math.floor(result));
}

export interface CarouselItem {
  id: string;
  content: ReactNode;
  /** Shown in the thumbnail picker. */
  thumbnail?: ReactNode;
  /** Short name such as "Front view", added to the slide and picker names. */
  label?: string;
}

export interface CarouselSlideProps extends ComponentProps<"div"> {
  /** Shown in the thumbnail picker. */
  thumbnail?: ReactNode;
  /** Short name such as "Front view", added to the slide and picker names. */
  label?: string;
}

/** One slide's content when composing a Carousel from children. */
export function CarouselSlide({ thumbnail, label, className, ...props }: CarouselSlideProps) {
  return <div data-slot="carousel-slide-content" className={cn("h-full", className)} {...props} />;
}

export interface CarouselProps extends Omit<ComponentProps<"section">, "children"> {
  /** Accessible name of the carousel, such as "Product photos". */
  label: string;
  /** Slides as data; alternatively pass CarouselSlide children. */
  items?: CarouselItem[];
  children?: ReactNode;
  /** Index of the first visible slide. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Wraps from the last slide to the first and back. */
  loop?: boolean;
  slidesPerView?: CarouselSlidesPerView;
  /** Space between slides in pixels. */
  gap?: number;
  picker?: "dots" | "thumbnails" | "none";
  /** Advances automatically: true for every 5 seconds, or an interval in milliseconds. Never starts on its own under reduced motion. */
  autoplay?: boolean | number;
  /** Shows the previous and next buttons. */
  controls?: boolean;
}

interface Slide {
  key: string;
  content: ReactNode;
  thumbnail?: ReactNode;
  label?: string;
}

interface Swipe {
  pointerId: number;
  x: number;
  y: number;
  active: boolean;
}

function isEditable(target: EventTarget): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * Slide show for product photos, promotions or cards. Previous and next
 * buttons, dot or thumbnail pickers, ArrowLeft, ArrowRight, Home and End
 * while focus is inside, and pointer swipes move between slides; several
 * slides can show at once, responsive to the container width. Inactive
 * slides are inert. Autoplay pauses on hover and focus, has a visible pause
 * button, and never starts under reduced motion; a polite live region names
 * the current slide while it is not rotating.
 */
export function Carousel({
  label,
  items,
  children,
  index,
  defaultIndex = 0,
  onIndexChange,
  loop = false,
  slidesPerView = 1,
  gap = 12,
  picker = "dots",
  autoplay = false,
  controls = true,
  className,
  onKeyDown,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: CarouselProps) {
  const id = useId();
  const slides = useMemo<Slide[]>(() => {
    if (items) return items.map((item) => ({ key: item.id, content: item.content, thumbnail: item.thumbnail, ...(item.label ? { label: item.label } : {}) }));
    return Children.toArray(children)
      .filter(isValidElement)
      .map((child, position) => {
        const slideProps = isValidElement<CarouselSlideProps>(child) && child.type === CarouselSlide ? child.props : undefined;
        return { key: String(child.key ?? position), content: child, thumbnail: slideProps?.thumbnail, ...(slideProps?.label ? { label: slideProps.label } : {}) };
      });
  }, [items, children]);
  const count = slides.length;
  const [viewportRef, viewportSize] = useElementSize<HTMLDivElement>();
  const perView = Math.min(Math.max(1, count), resolveSlidesPerView(slidesPerView, viewportSize.width));
  const maxIndex = Math.max(0, count - perView);
  const [rawIndex, setIndex] = useControllableState({ value: index, defaultValue: defaultIndex, onChange: onIndexChange });
  const current = Math.min(maxIndex, Math.max(0, Math.floor(rawIndex)));

  const reducedMotion = usePrefersReducedMotion();
  const interval = autoplay === true ? 5000 : typeof autoplay === "number" && autoplay > 0 ? autoplay : 0;
  const [playState, setPlayState] = useState<"auto" | "playing" | "paused">(interval > 0 ? "auto" : "paused");
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const playing = interval > 0 && maxIndex > 0 && (playState === "playing" || (playState === "auto" && !reducedMotion));
  const rotating = playing && !hovered && !focusWithin;

  const [dragOffset, setDragOffset] = useState(0);
  const swipe = useRef<Swipe | null>(null);
  const suppressClick = useRef(false);
  const indexRef = useRef(current);

  useEffect(() => {
    indexRef.current = current;
  }, [current]);

  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => {
      const next = indexRef.current >= maxIndex ? 0 : indexRef.current + 1;
      indexRef.current = next;
      setIndex(next);
    }, interval);
    return () => clearInterval(timer);
  }, [rotating, interval, maxIndex, setIndex]);

  const goTo = (target: number) => {
    let next = target;
    if (loop) {
      if (next > maxIndex) next = 0;
      else if (next < 0) next = maxIndex;
    }
    next = Math.min(maxIndex, Math.max(0, next));
    if (next !== current) setIndex(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
    const target = event.key === "ArrowLeft" ? current - 1 : event.key === "ArrowRight" ? current + 1 : event.key === "Home" ? 0 : event.key === "End" ? maxIndex : null;
    if (target === null) return;
    event.preventDefault();
    goTo(target);
  };

  const onSwipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || count < 2) return;
    swipe.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false };
  };

  const onSwipeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = swipe.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.active) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      state.active = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const atEdge = !loop && ((current === 0 && dx > 0) || (current === maxIndex && dx < 0));
    setDragOffset(atEdge ? dx / 3 : dx);
  };

  const onSwipeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = swipe.current;
    swipe.current = null;
    if (!state?.active || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const threshold = Math.min(80, Math.max(24, viewportSize.width * 0.15));
    suppressClick.current = true;
    setDragOffset(0);
    if (event.type === "pointercancel") return;
    if (dx <= -threshold) goTo(current + 1);
    else if (dx >= threshold) goTo(current - 1);
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    onFocus?.(event);
    if (!(event.target instanceof HTMLElement && event.target.dataset.carouselRotation !== undefined)) setFocusWithin(true);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    onBlur?.(event);
    const next = event.relatedTarget;
    if (!(next instanceof Node && event.currentTarget.contains(next)) || (next instanceof HTMLElement && next.dataset.carouselRotation !== undefined)) setFocusWithin(false);
  };

  const positions = maxIndex + 1;
  const visibleEnd = Math.min(count, current + perView);
  const status = count === 0 ? "" : perView > 1 && visibleEnd - current > 1 ? `Slides ${current + 1} to ${visibleEnd} of ${count}` : `Slide ${current + 1} of ${count}${slides[current]?.label ? `: ${slides[current]?.label}` : ""}`;
  const trackId = `${id}-track`;
  const keyboardOnly = !controls && picker === "none";
  const navButton = cn(
    "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
    focusRing,
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      data-slot="carousel"
      data-playing={rotating ? "" : undefined}
      className={cn("flex min-w-0 flex-col gap-3", className)}
      onKeyDown={handleKeyDown}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        setHovered(false);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    >
      <div className="relative">
        <div
          ref={viewportRef}
          tabIndex={keyboardOnly ? 0 : undefined}
          aria-label={keyboardOnly ? `${label}, use the arrow keys to change slides` : undefined}
          role={keyboardOnly ? "group" : undefined}
          className={cn("overflow-hidden rounded-lg", keyboardOnly && focusRing)}
          style={{ touchAction: "pan-y" }}
          onPointerDown={onSwipeStart}
          onPointerMove={onSwipeMove}
          onPointerUp={onSwipeEnd}
          onPointerCancel={onSwipeEnd}
          onClickCapture={onClickCapture}
          onDragStart={(event) => event.preventDefault()}
        >
          <div
            id={trackId}
            data-slot="carousel-track"
            className={cn("flex", dragOffset === 0 && !reducedMotion && "transition-transform duration-300 ease-out motion-reduce:transition-none")}
            style={{ gap, transform: `translateX(calc(${-current} * (100% + ${gap}px) / ${perView} + ${dragOffset}px))` }}
          >
            {slides.map((slide, position) => {
              const visible = position >= current && position < visibleEnd;
              return (
                <div
                  key={slide.key}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${slide.label ? `${slide.label}, ` : ""}${position + 1} of ${count}`}
                  aria-hidden={visible ? undefined : true}
                  inert={!visible}
                  data-slot="carousel-slide"
                  data-active={visible ? "" : undefined}
                  className="min-w-0 shrink-0"
                  style={{ flexBasis: `calc((100% - ${gap * (perView - 1)}px) / ${perView})` }}
                >
                  {slide.content}
                </div>
              );
            })}
          </div>
        </div>
        {controls && count > 1 && (
          <>
            <button type="button" aria-label="Previous slide" aria-controls={trackId} disabled={!loop && current === 0} onClick={() => goTo(current - 1)} className={cn(navButton, "absolute top-1/2 left-2 -translate-y-1/2")}>
              <ChevronLeftIcon aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next slide" aria-controls={trackId} disabled={!loop && current === maxIndex} onClick={() => goTo(current + 1)} className={cn(navButton, "absolute top-1/2 right-2 -translate-y-1/2")}>
              <ChevronRightIcon aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {(picker !== "none" || interval > 0) && count > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {interval > 0 && maxIndex > 0 && (
            <button
              type="button"
              data-carousel-rotation=""
              aria-label={playing ? "Pause automatic slide show" : "Start automatic slide show"}
              onClick={() => setPlayState(playing ? "paused" : "playing")}
              className={cn("inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-4", focusRing)}
            >
              {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
            </button>
          )}
          {picker === "dots" && (
            <div role="group" aria-label="Choose slide" className="flex flex-wrap items-center justify-center">
              {Array.from({ length: positions }, (_, position) => (
                <button
                  key={position}
                  type="button"
                  aria-label={`Show slide ${position + 1}${slides[position]?.label ? `: ${slides[position]?.label}` : ""}`}
                  aria-current={position === current ? "true" : undefined}
                  aria-controls={trackId}
                  onClick={() => goTo(position)}
                  className={cn("group inline-flex size-6 items-center justify-center rounded-full", focusRing)}
                >
                  <span aria-hidden="true" className={cn("size-2 rounded-full bg-muted-foreground transition-all group-hover:bg-foreground motion-reduce:transition-none", position === current && "w-5 bg-foreground")} />
                </button>
              ))}
            </div>
          )}
          {picker === "thumbnails" && (
            <div role="group" aria-label="Choose slide" className="flex max-w-full gap-2 overflow-x-auto p-1">
              {slides.map((slide, position) => (
                <button
                  key={slide.key}
                  type="button"
                  aria-label={`Show slide ${position + 1}${slide.label ? `: ${slide.label}` : ""}`}
                  aria-current={position >= current && position < visibleEnd ? "true" : undefined}
                  aria-controls={trackId}
                  onClick={() => goTo(Math.min(position, maxIndex))}
                  className={cn(
                    "size-14 shrink-0 overflow-hidden rounded-md border-2 border-border transition-colors hover:border-muted-foreground aria-[current=true]:border-foreground motion-reduce:transition-none",
                    focusRing,
                  )}
                >
                  <span aria-hidden="true" className="flex size-full items-center justify-center bg-muted text-xs">
                    {slide.thumbnail ?? position + 1}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div aria-live={rotating ? "off" : "polite"} aria-atomic="true" className="sr-only">
        {status}
      </div>
    </section>
  );
}
