// packages/ai-ui/src/components/typing-indicator.tsx
"use client";

import type { ComponentProps } from "react";

import { cn } from "../lib/cn.js";
import { TypingDots } from "./shimmer.js";

/** "Ana is typing", "Ana and Ben are typing", "Ana, Ben and 3 others are typing". */
export function formatTypingNames(names: string[], max = 2): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length <= max) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} are typing`;
  const others = names.length - max;
  return `${names.slice(0, max).join(", ")} and ${others} ${others === 1 ? "other" : "others"} are typing`;
}

export interface TypingIndicatorProps extends Omit<ComponentProps<"div">, "children"> {
  /** Names of the people or agents typing; empty hides the indicator. */
  names: string[];
  /** Names listed before collapsing into "N others". */
  max?: number;
}

/**
 * Animated dots with who is typing. The live region stays mounted while
 * empty so screen readers announce people as they start.
 */
export function TypingIndicator({ names, max = 2, className, ...props }: TypingIndicatorProps) {
  const text = formatTypingNames(names, max);
  return (
    <div role="status" data-slot="typing-indicator" className={cn("flex min-h-5 items-center gap-2 text-xs text-muted-foreground", className)} {...props}>
      {text && (
        <>
          <TypingDots className="gap-0.5" />
          <span className="truncate">{text}</span>
        </>
      )}
    </div>
  );
}
