// packages/ai-ui/src/components/popover.tsx
"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";

import { popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import type { WithClassName } from "../lib/types.js";

/**
 * Arrow drawn as a rotated square whose two outer edges carry the popup
 * border; pair it with a surface that uses `bg-popover` and `border-border`.
 */
export const popupArrowClass =
  "size-2.5 rotate-45 border-border bg-popover data-[side=bottom]:-top-[5px] data-[side=bottom]:border-t data-[side=bottom]:border-l data-[side=left]:-right-[5px] data-[side=left]:border-t data-[side=left]:border-r data-[side=right]:-left-[5px] data-[side=right]:border-b data-[side=right]:border-l data-[side=top]:-bottom-[5px] data-[side=top]:border-r data-[side=top]:border-b";

export type PopoverSide = "top" | "right" | "bottom" | "left";
export type PopoverAlign = "start" | "center" | "end";

export type PopoverProps = BasePopover.Root.Props;

/** Non-modal floating panel on Base UI Popover; Escape or an outside press closes it and focus returns to the trigger. */
export function Popover(props: PopoverProps) {
  return <BasePopover.Root {...props} />;
}

export type PopoverTriggerProps = BasePopover.Trigger.Props;

/** Opens the popover on click (or on hover with `openOnHover`); use `render={<Button />}` to style it. */
export function PopoverTrigger(props: PopoverTriggerProps) {
  return <BasePopover.Trigger data-slot="popover-trigger" {...props} />;
}

export interface PopoverContentProps extends WithClassName<BasePopover.Popup.Props> {
  side?: PopoverSide;
  align?: PopoverAlign;
  /** Gap between the trigger and the popup in pixels. */
  sideOffset?: number;
  alignOffset?: number;
  /** Draws an arrow pointing at the trigger. */
  arrow?: boolean;
  /** Minimum distance from the viewport edges in pixels. */
  collisionPadding?: number;
}

/** The popover surface, positioned against the trigger and flipped to stay on screen. */
export function PopoverContent({ side = "bottom", align = "center", sideOffset = 6, alignOffset = 0, arrow = false, collisionPadding = 8, className, children, ...props }: PopoverContentProps) {
  const container = usePortalContainer();
  return (
    <BasePopover.Portal container={container}>
      <BasePopover.Positioner side={side} align={align} sideOffset={arrow ? sideOffset + 4 : sideOffset} alignOffset={alignOffset} collisionPadding={collisionPadding} className="z-50">
        <BasePopover.Popup
          data-slot="popover-content"
          className={cn(popupSurface, "flex w-72 max-w-[var(--available-width)] flex-col gap-2 p-4 text-sm outline-none", className)}
          {...props}
        >
          {arrow && <BasePopover.Arrow data-slot="popover-arrow" className={popupArrowClass} />}
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

export type PopoverTitleProps = WithClassName<BasePopover.Title.Props>;

/** Heading that names the popover. */
export function PopoverTitle({ className, ...props }: PopoverTitleProps) {
  return <BasePopover.Title data-slot="popover-title" className={cn("text-sm leading-snug font-semibold", className)} {...props} />;
}

export type PopoverDescriptionProps = WithClassName<BasePopover.Description.Props>;

export function PopoverDescription({ className, ...props }: PopoverDescriptionProps) {
  return <BasePopover.Description data-slot="popover-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export type PopoverCloseProps = BasePopover.Close.Props;

/** Closes the popover; use `render={<Button />}` to style it. */
export function PopoverClose(props: PopoverCloseProps) {
  return <BasePopover.Close data-slot="popover-close" {...props} />;
}
