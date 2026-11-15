// packages/ai-ui/src/components/branch-navigator.tsx
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

/** aria-disabled rather than disabled keeps focus on the button at either end. */
const navButton = "size-7 aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent";

export interface BranchNavigatorProps extends Omit<ComponentProps<"div">, "children"> {
  /** Zero-based index of the visible branch. */
  index: number;
  count: number;
  onIndexChange: (index: number) => void;
}

/** Switches between alternative versions of a message. Renders nothing for a single branch. */
export function BranchNavigator({
  index,
  count,
  onIndexChange,
  className,
  onKeyDown,
  ...props
}: BranchNavigatorProps) {
  if (count <= 1) return null;
  const go = (next: number) => {
    if (next >= 0 && next < count && next !== index) onIndexChange(next);
  };

  return (
    <div
      role="group"
      aria-label="Message versions"
      data-slot="branch-navigator"
      className={cn("inline-flex items-center gap-0.5 text-xs text-muted-foreground", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "ArrowLeft") go(index - 1);
        else if (event.key === "ArrowRight") go(index + 1);
        else return;
        event.preventDefault();
      }}
      {...props}
    >
      <button
        type="button"
        aria-label="Previous version"
        aria-disabled={index <= 0}
        onClick={() => go(index - 1)}
        className={cn(iconButton, navButton, focusRing)}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </button>
      <span aria-live="polite" aria-atomic="true" className="min-w-10 text-center tabular-nums">
        <span className="sr-only">Version </span>
        {index + 1}
        <span aria-hidden="true"> / </span>
        <span className="sr-only"> of </span>
        {count}
      </span>
      <button
        type="button"
        aria-label="Next version"
        aria-disabled={index >= count - 1}
        onClick={() => go(index + 1)}
        className={cn(iconButton, navButton, focusRing)}
      >
        <ChevronRightIcon aria-hidden="true" />
      </button>
    </div>
  );
}
