// packages/ai-ui/src/components/pull-to-refresh.tsx
"use client";

import { ArrowDownIcon, LoaderCircleIcon } from "lucide-react";
import { type ReactNode, type TouchEvent, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  /** Pull distance that triggers a refresh. */
  threshold?: number;
  /** Furthest the content moves. */
  maxPull?: number;
  disabled?: boolean;
  /** Names the scrolling region, which is focusable so keyboard users can scroll it. */
  label?: string;
  className?: string;
}

/**
 * Touch pull-to-refresh for a scrolling area: works only from the top, moves
 * with resistance (half the finger travel) up to `maxPull`, refreshes past
 * `threshold`, and announces "Refreshing" while it runs. Offer another way
 * to refresh for mouse and keyboard users.
 */
export function PullToRefresh({ onRefresh, children, threshold = 80, maxPull = 120, disabled = false, label = "Refreshable content", className }: PullToRefreshProps) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (disabled || refreshing || event.currentTarget.scrollTop > 0) return;
    const touch = event.touches[0]!;
    setStart({ x: touch.clientX, y: touch.clientY });
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!start) return;
    const touch = event.touches[0]!;
    const dy = touch.clientY - start.y;
    const dx = touch.clientX - start.x;
    if (dy <= 0 || Math.abs(dx) > dy) {
      setPull(0);
      return;
    }
    setPull(Math.min(maxPull, dy * 0.5));
  };

  const onTouchEnd = async () => {
    if (!start) return;
    setStart(null);
    if (pull < threshold) {
      setPull(0);
      return;
    }
    setPull(threshold * 0.6);
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  const ready = pull >= threshold;
  return (
    <div data-slot="pull-to-refresh" role="region" aria-label={label} tabIndex={0} className={cn("relative min-h-0 overflow-y-auto overscroll-y-contain", focusRing, className)} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => void onTouchEnd()} onTouchCancel={() => {
        setStart(null);
        setPull(0);
      }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex justify-center" style={{ height: pull, opacity: pull ? 1 : 0 }}>
        <span className="mt-2 flex size-8 items-center justify-center rounded-full border border-border bg-background shadow-sm [&_svg]:size-4">
          {refreshing ? <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" /> : <ArrowDownIcon className={cn("transition-transform motion-reduce:transition-none", ready && "rotate-180")} />}
        </span>
      </div>
      <div className={cn(!start && "transition-transform duration-200 motion-reduce:transition-none")} style={{ transform: pull ? `translateY(${pull}px)` : undefined }}>
        {children}
      </div>
      <span role="status" className="sr-only">
        {refreshing ? "Refreshing" : ""}
      </span>
    </div>
  );
}
