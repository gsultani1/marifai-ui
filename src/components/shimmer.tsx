// packages/ai-ui/src/components/shimmer.tsx
"use client";

import { type ComponentProps, type ElementType, type ReactNode, useEffect, useState } from "react";

import { shimmerText } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface ShimmerProps extends ComponentProps<"span"> {
  /** Element to render, e.g. "p" or "h3". */
  as?: ElementType;
}

/** Text with a light sweep for in-progress labels such as "Building app…". */
export function Shimmer({ as: Tag = "span", className, ...props }: ShimmerProps) {
  return <Tag data-slot="shimmer" className={cn(shimmerText, className)} {...props} />;
}

export interface ThinkingIndicatorProps extends Omit<ComponentProps<"div">, "children"> {
  /** Rotated every `intervalMs`; a single phrase stays still. */
  phrases?: readonly string[];
  intervalMs?: number;
  icon?: ReactNode;
}

const DEFAULT_PHRASES = ["Thinking", "Reading the context", "Planning the answer", "Writing"] as const;

/** Busy line for the wait before the first token, announced once rather than on every phrase. */
export function ThinkingIndicator({ phrases = DEFAULT_PHRASES, intervalMs = 2000, icon, className, ...props }: ThinkingIndicatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (phrases.length < 2) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % phrases.length), intervalMs);
    return () => clearInterval(timer);
  }, [phrases.length, intervalMs]);

  return (
    <div data-slot="thinking-indicator" className={cn("flex items-center gap-2 text-sm", className)} {...props}>
      <span role="status" className="sr-only">
        {phrases[0]}
      </span>
      {icon ?? <TypingDots />}
      <Shimmer aria-hidden="true">{phrases[index % phrases.length]}…</Shimmer>
    </div>
  );
}

/** Three bouncing dots. Decorative; pair with a text status. */
export function TypingDots({ className, ...props }: ComponentProps<"span">) {
  return (
    <span aria-hidden="true" data-slot="typing-dots" className={cn("inline-flex items-center gap-1", className)} {...props}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          style={{ animationDelay: `${delay}ms` }}
          className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce"
        />
      ))}
    </span>
  );
}
