// packages/ai-ui/src/components/suggestion-rail.tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface SuggestionRailProps {
  children: ReactNode;
  label?: string;
  /** Where the suggestions come from, such as "Based on your recent files". */
  source?: ReactNode;
  className?: string;
}

/**
 * One scrolling row of Suggestion chips with scroll buttons that appear only
 * when there is more to see, Left and Right arrows between chips, and an
 * optional note on where the suggestions came from.
 */
export function SuggestionRail({ children, label = "Suggestions", source, className }: SuggestionRailProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () => setEdges({ start: element.scrollLeft > 1, end: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer?.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);

  const scroll = (direction: 1 | -1) => scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const buttons = [...(scroller.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    const next = buttons[index + (event.key === "ArrowRight" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <div data-slot="suggestion-rail" className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {source && <p className="text-xs text-muted-foreground">{source}</p>}
      <div className="relative flex min-w-0 items-center">
        {edges.start && (
          <button type="button" aria-label={`Scroll ${label.toLowerCase()} left`} onClick={() => scroll(-1)} className={cn(iconButton, "absolute left-0 z-10 rounded-full border border-border bg-background shadow-sm", focusRing)}>
            <ChevronLeftIcon aria-hidden="true" />
          </button>
        )}
        <div ref={scroller} role="group" aria-label={label} onKeyDown={onKeyDown} className="flex min-w-0 snap-x gap-2 overflow-x-auto scroll-smooth py-0.5 [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:snap-start">
          {children}
        </div>
        {edges.end && (
          <button type="button" aria-label={`Scroll ${label.toLowerCase()} right`} onClick={() => scroll(1)} className={cn(iconButton, "absolute right-0 z-10 rounded-full border border-border bg-background shadow-sm", focusRing)}>
            <ChevronRightIcon aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
