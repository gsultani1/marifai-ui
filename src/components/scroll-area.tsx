// packages/ai-ui/src/components/scroll-area.tsx
"use client";

import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";

import { cn } from "../lib/cn.js";
import type { WithClassName } from "../lib/types.js";

export interface ScrollAreaProps extends WithClassName<BaseScrollArea.Root.Props> {
  /**
   * Accessible name for the scrolling region, such as "Order history". The
   * viewport joins the tab order only while it overflows, so keyboard users can
   * scroll it with the arrow keys.
   */
  label?: string;
  /** Which scrollbars to draw. */
  orientation?: "vertical" | "horizontal" | "both";
  viewportClassName?: string;
  contentClassName?: string;
}

/**
 * Scrolling container on Base UI Scroll Area with thin styled scrollbars that
 * brighten on hover and while scrolling. Give it a height (or max height) and
 * a `label`.
 */
export function ScrollArea({ label, orientation = "vertical", viewportClassName, contentClassName, className, children, ...props }: ScrollAreaProps) {
  const vertical = orientation !== "horizontal";
  const horizontal = orientation !== "vertical";
  return (
    <BaseScrollArea.Root data-slot="scroll-area" className={cn("relative flex min-h-0 flex-col overflow-hidden", className)} {...props}>
      <BaseScrollArea.Viewport
        role={label ? "region" : undefined}
        aria-label={label}
        data-slot="scroll-area-viewport"
        className={cn("min-h-0 flex-1 overscroll-contain rounded-[inherit] outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", viewportClassName)}
      >
        <BaseScrollArea.Content className={contentClassName}>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      {vertical && <ScrollBar orientation="vertical" />}
      {horizontal && <ScrollBar orientation="horizontal" />}
      {vertical && horizontal && <BaseScrollArea.Corner />}
    </BaseScrollArea.Root>
  );
}

function ScrollBar({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <BaseScrollArea.Scrollbar
      orientation={orientation}
      data-slot="scroll-area-scrollbar"
      className={cn(
        "flex touch-none p-0.5 opacity-60 transition-opacity duration-150 select-none data-[hovering]:opacity-100 data-[scrolling]:opacity-100 motion-reduce:transition-none",
        orientation === "vertical" ? "w-2.5 justify-center" : "h-2.5 flex-col justify-center",
      )}
    >
      <BaseScrollArea.Thumb
        className={cn("rounded-full bg-muted-foreground/60 hover:bg-muted-foreground", orientation === "vertical" ? "w-full" : "h-full")}
      />
    </BaseScrollArea.Scrollbar>
  );
}
