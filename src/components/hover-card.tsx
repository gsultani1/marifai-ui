// packages/ai-ui/src/components/hover-card.tsx
"use client";

import { PreviewCard as BasePreviewCard } from "@base-ui/react/preview-card";

import { focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import type { WithClassName } from "../lib/types.js";
import { popupArrowClass } from "./popover.js";

export type HoverCardProps = BasePreviewCard.Root.Props;

/**
 * Rich preview of a link on hover or keyboard focus, built on Base UI
 * Preview Card. Keep the link useful on its own: touch and screen reader
 * users follow it rather than open the card.
 */
export function HoverCard(props: HoverCardProps) {
  return <BasePreviewCard.Root {...props} />;
}

export type HoverCardTriggerProps = WithClassName<BasePreviewCard.Trigger.Props>;

/** The link that opens the card; `delay` and `closeDelay` tune the hover timing. */
export function HoverCardTrigger({ className, ...props }: HoverCardTriggerProps) {
  return (
    <BasePreviewCard.Trigger
      data-slot="hover-card-trigger"
      className={cn("rounded-sm font-medium text-foreground underline underline-offset-4 decoration-muted-foreground hover:decoration-foreground", focusRing, className)}
      {...props}
    />
  );
}

export interface HoverCardContentProps extends WithClassName<BasePreviewCard.Popup.Props> {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  arrow?: boolean;
}

export function HoverCardContent({ side = "bottom", align = "center", sideOffset = 6, arrow = false, className, children, ...props }: HoverCardContentProps) {
  const container = usePortalContainer();
  return (
    <BasePreviewCard.Portal container={container}>
      <BasePreviewCard.Positioner side={side} align={align} sideOffset={arrow ? sideOffset + 4 : sideOffset} collisionPadding={8} className="z-50">
        <BasePreviewCard.Popup
          data-slot="hover-card-content"
          className={cn(popupSurface, "flex w-72 max-w-[var(--available-width)] flex-col gap-2 p-4 text-sm outline-none", className)}
          {...props}
        >
          {arrow && <BasePreviewCard.Arrow data-slot="hover-card-arrow" className={popupArrowClass} />}
          {children}
        </BasePreviewCard.Popup>
      </BasePreviewCard.Positioner>
    </BasePreviewCard.Portal>
  );
}
